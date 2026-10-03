import html
import json
import secrets
from contextlib import asynccontextmanager
from datetime import timedelta
from pathlib import Path
from typing import Annotated
from urllib.parse import urlparse
from fastapi import FastAPI, Request, Response, HTTPException, Depends, UploadFile, File, Form, Query
from fastapi.exceptions import RequestValidationError
from fastapi.responses import FileResponse, HTMLResponse, PlainTextResponse, JSONResponse
from starlette.middleware.trustedhost import TrustedHostMiddleware
from starlette.middleware.gzip import GZipMiddleware
from sqlalchemy import select, or_, func, delete
from sqlalchemy.exc import IntegrityError
from .config import Settings
from .db import create_database
from .models import Base, User, Session, ResetToken, Report, Claim, Conversation, Message, Notification, Abuse, MatchNotice, Analytics, now
from .schemas import Credentials, Registration, Forgot, Reset, Account, PasswordChange, AccountDeletion, ReportInput, ClaimInput, Decision, MessageInput, Review, RoleChange, CATEGORIES
from .security import hasher, DUMMY_HASH, verify_password, token, digest, Limiter, verify_bot
from .uploads import save_image, clean_image, MAX_UPLOAD
from .matching import ClipEmbedder, EmbeddingsUnavailable, ranked_matches, cosine


def public_user(user):
    return {"id": user.id, "name": user.name, "role": user.role}


def report_json(report):
    return {name: getattr(report, name) for name in ("id", "kind", "title", "description", "category", "color", "brand", "area", "latitude", "longitude", "event_date", "status", "review_status", "embedding_status", "created_at")} | {"photos": [f"/api/photos/{report.id}/{name}" for name in report.photos]}


class PublicGZip(GZipMiddleware):
    async def __call__(self, scope, receive, send):
        if scope.get("path", "").startswith("/api/"):
            await self.app(scope, receive, send)
        else:
            await super().__call__(scope, receive, send)


def create_app(settings=None, embedder=None):
    settings = settings or Settings()
    settings.validate_runtime()
    engine, factory = create_database(settings.database_url)

    @asynccontextmanager
    async def lifespan(app):
        # PostgreSQL schemas are managed exclusively through Alembic migrations.
        if engine.dialect.name == "sqlite":
            Base.metadata.create_all(engine)
        yield
        engine.dispose()

    app = FastAPI(title="FindBack API", lifespan=lifespan, docs_url="/api/docs" if settings.environment != "production" else None, redoc_url=None, openapi_url="/api/openapi.json" if settings.environment != "production" else None)
    app.state.settings = settings
    app.state.factory = factory
    app.state.embedder = embedder or ClipEmbedder(settings)
    app.state.limiter = Limiter(settings.redis_url)
    app.state.test_mail = []  # Only populated in explicitly selected test environment.
    app.add_middleware(TrustedHostMiddleware, allowed_hosts=settings.allowed_hosts.split(","))
    app.add_middleware(PublicGZip, minimum_size=500, compresslevel=6)

    @app.exception_handler(RequestValidationError)
    async def validation_error(request, exc):
        return JSONResponse({"detail": [{"loc": list(e["loc"]), "msg": e["msg"]} for e in exc.errors()]}, status_code=422)

    def db_session():
        with factory() as db:
            yield db

    DB = Annotated[object, Depends(db_session)]

    def optional_user(request: Request, db):
        raw = request.cookies.get("findback_session")
        if not raw:
            return None
        session = db.get(Session, digest(raw))
        if not session or session.expires_at <= now():
            return None
        user = db.get(User, session.user_id)
        return user if user and not user.disabled else None

    def current_user(request: Request, db):
        user = optional_user(request, db)
        if not user:
            raise HTTPException(401, "Please sign in to continue")
        return user

    def staff(request, db, admin=False):
        user = current_user(request, db)
        if user.role not in (("admin",) if admin else ("moderator", "admin")):
            raise HTTPException(403, "You do not have permission to perform this action")
        return user

    def limit(request, action, count=15, seconds=60):
        app.state.limiter.check(f"{action}:{request.client.host}", count, seconds)

    def issue_session(response, db, user):
        raw, csrf = token(), token()
        db.add(Session(token_hash=digest(raw), user_id=user.id, csrf=csrf, expires_at=now() + timedelta(hours=settings.session_hours)))
        db.commit()
        response.set_cookie("findback_session", raw, max_age=settings.session_hours * 3600, httponly=True, secure=settings.cookie_secure, samesite="lax", path="/")
        return public_user(user) | {"email": user.email, "csrf": csrf}

    def visible_report(request, db, id):
        report = db.get(Report, id)
        user = optional_user(request, db)
        if not report or (report.review_status != "published" and (not user or (user.id != report.owner_id and user.role not in ("moderator", "admin")))):
            raise HTTPException(404, "Item not found")
        return report

    def notify(db, user_id, kind, text, href):
        db.add(Notification(user_id=user_id, kind=kind, text=text, href=href))

    def get_conversation(db, report, user):
        conversation = db.scalar(select(Conversation).where(Conversation.report_id == report.id, Conversation.initiator_id == user.id))
        if not conversation:
            conversation = Conversation(report_id=report.id, initiator_id=user.id, owner_id=report.owner_id)
            db.add(conversation)
            db.flush()
        return conversation

    def participating_conversation(request, db, id):
        user = current_user(request, db)
        conversation = db.get(Conversation, id)
        if not conversation or user.id not in (conversation.initiator_id, conversation.owner_id):
            raise HTTPException(404, "Conversation not found")
        return user, conversation

    @app.middleware("http")
    async def security_headers(request: Request, call_next):
        if settings.environment == "production" and request.url.scheme != "https":
            # Redirect using configured origin, never an untrusted forwarded host.
            from fastapi.responses import RedirectResponse
            return RedirectResponse(settings.public_origin + request.url.path + ("?" + request.url.query if request.url.query else ""), status_code=308)
        if request.method not in ("GET", "HEAD", "OPTIONS"):
            if request.headers.get("origin") and request.headers["origin"].rstrip("/") != settings.public_origin.rstrip("/"):
                return JSONResponse({"detail": "Untrusted request origin"}, status_code=403)
            if request.headers.get("sec-fetch-site") == "cross-site":
                return JSONResponse({"detail": "Cross-site requests are not allowed"}, status_code=403)
            length = request.headers.get("content-length")
            if length and (not length.isdigit() or int(length) > 4 * MAX_UPLOAD):
                return JSONResponse({"detail": "Request is too large"}, status_code=413)
            chunks, total_size = [], 0
            async for chunk in request.stream():
                total_size += len(chunk)
                if total_size > 4 * MAX_UPLOAD:
                    return JSONResponse({"detail": "Request is too large"}, status_code=413)
                chunks.append(chunk)
            request._body = b"".join(chunks)
            raw = request.cookies.get("findback_session")
            if raw and request.url.path not in ("/api/auth/login", "/api/auth/register", "/api/auth/forgot", "/api/auth/reset"):
                with factory() as db:
                    session = db.get(Session, digest(raw))
                    if session and session.expires_at > now() and not secrets.compare_digest(request.headers.get("x-csrf-token", ""), session.csrf):
                        return JSONResponse({"detail": "Security check failed. Refresh and try again."}, status_code=403)
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
        response.headers["X-Frame-Options"] = "DENY"
        analytics_origin = urlparse(settings.analytics_script_url)
        analytic = f" {analytics_origin.scheme}://{analytics_origin.netloc}" if analytics_origin.netloc else ""
        # React and Leaflet set inline style properties; script execution stays origin restricted.
        response.headers["Content-Security-Policy"] = "default-src 'self'; script-src 'self' https://challenges.cloudflare.com" + analytic + "; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://*.tile.openstreetmap.org; connect-src 'self' https://challenges.cloudflare.com" + analytic + "; frame-src https://challenges.cloudflare.com; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'"
        if request.url.path.startswith("/api/"):
            response.headers["Cache-Control"] = "no-store"
        if settings.environment == "production":
            response.headers["Strict-Transport-Security"] = "max-age=31536000"
        return response

    @app.get("/api/health")
    def health(db: DB):
        db.execute(select(1))
        return {"status": "ok", "environment": settings.environment}

    @app.get("/api/config")
    def config():
        return {"categories": CATEGORIES, "turnstile_site_key": settings.turnstile_site_key, "bot_bypass": settings.environment != "production" and settings.dev_bot_bypass, "operator_name": settings.operator_name, "contact_email": settings.contact_email, "retention_days": settings.retention_days, "analytics_provider": settings.analytics_provider, "analytics_script_url": "", "analytics_domain": settings.analytics_domain, "social_profile_url": settings.social_profile_url, "public_origin": settings.public_origin}

    @app.post("/api/analytics/events", status_code=204)
    def analytics(body: dict, request: Request, db: DB):
        if settings.analytics_provider != "internal":
            return
        limit(request, "analytics", 60, 60)
        if set(body) != {"event"} or body["event"] not in ("report_submission", "search", "match_view", "claim_initiation"):
            raise HTTPException(422, "Only anonymous allowed event names are accepted")
        values = {"day": now().date().isoformat(), "event": body["event"], "site": settings.analytics_domain[:100] or "findback", "count": 1}
        if engine.dialect.name == "postgresql":
            from sqlalchemy.dialects.postgresql import insert
        else:
            from sqlalchemy.dialects.sqlite import insert
        statement = insert(Analytics).values(**values).on_conflict_do_update(index_elements=[Analytics.day, Analytics.event, Analytics.site], set_={"count": Analytics.count + 1})
        db.execute(statement)
        db.commit()

    @app.post("/api/auth/register", status_code=201)
    def register(body: Registration, request: Request, response: Response, db: DB):
        limit(request, "register", 5, 3600)
        verify_bot(settings, body.bot_token, "register")
        user = User(email=str(body.email).lower(), name=body.name.strip(), password_hash=hasher.hash(body.password))
        db.add(user)
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            raise HTTPException(409, "Unable to register this address. Try signing in or resetting your password.")
        return issue_session(response, db, user)

    @app.post("/api/auth/login")
    def login(body: Credentials, request: Request, response: Response, db: DB):
        limit(request, "login", 10, 600)
        app.state.limiter.check("login-account:" + str(body.email).lower(), 10, 600)
        user = db.scalar(select(User).where(User.email == str(body.email).lower()))
        valid = verify_password(user.password_hash if user else DUMMY_HASH, body.password)
        if not valid or not user or user.disabled:
            raise HTTPException(401, "Email or password is incorrect")
        old = request.cookies.get("findback_session")
        if old:
            db.execute(delete(Session).where(Session.token_hash == digest(old)))
        return issue_session(response, db, user)

    @app.get("/api/auth/me")
    def me(request: Request, db: DB):
        user = current_user(request, db)
        session = db.get(Session, digest(request.cookies["findback_session"]))
        return public_user(user) | {"email": user.email, "csrf": session.csrf}

    @app.get("/api/auth/session")
    def session_state(request: Request, db: DB):
        user = optional_user(request, db)
        if not user:
            return {"user": None}
        session = db.get(Session, digest(request.cookies["findback_session"]))
        return {"user": public_user(user) | {"email": user.email, "csrf": session.csrf}}

    @app.post("/api/auth/logout", status_code=204)
    def logout(request: Request, response: Response, db: DB):
        raw = request.cookies.get("findback_session")
        if raw:
            db.execute(delete(Session).where(Session.token_hash == digest(raw)))
            db.commit()
        response.delete_cookie("findback_session", path="/", secure=settings.cookie_secure, httponly=True, samesite="lax")

    @app.post("/api/auth/forgot")
    def forgot(body: Forgot, request: Request, db: DB):
        limit(request, "forgot", 5, 3600)
        verify_bot(settings, body.bot_token, "reset")
        user = db.scalar(select(User).where(User.email == str(body.email).lower(), User.disabled == False))
        if user:
            from .mail import send_reset
            raw = token()
            db.execute(delete(ResetToken).where(ResetToken.user_id == user.id))
            db.add(ResetToken(token_hash=digest(raw), user_id=user.id, expires_at=now() + timedelta(minutes=30)))
            db.commit()
            send_reset(settings, user.email, raw, app.state.test_mail)
        return {"message": "If an account exists, a reset link will be sent. Check your inbox."}

    @app.post("/api/auth/reset")
    def reset_password(body: Reset, request: Request, db: DB):
        limit(request, "reset", 10, 600)
        reset = db.scalar(select(ResetToken).where(ResetToken.token_hash == digest(body.token)).with_for_update())
        if not reset or reset.expires_at <= now():
            raise HTTPException(400, "This reset link is invalid or has expired")
        user = db.get(User, reset.user_id)
        user.password_hash = hasher.hash(body.password)
        db.execute(delete(Session).where(Session.user_id == user.id))
        db.execute(delete(ResetToken).where(ResetToken.user_id == user.id))
        db.commit()
        return {"message": "Password updated. Sign in with your new password."}

    @app.patch("/api/account")
    def update_account(body: Account, request: Request, db: DB):
        user = current_user(request, db)
        user.name = body.name.strip()
        db.commit()
        return public_user(user)

    @app.post("/api/account/password")
    def change_password(body: PasswordChange, request: Request, db: DB):
        user = current_user(request, db)
        limit(request, "password-change", 5, 600)
        if not verify_password(user.password_hash, body.current_password):
            raise HTTPException(400, "Current password is incorrect")
        user.password_hash = hasher.hash(body.password)
        db.execute(delete(Session).where(Session.user_id == user.id))
        db.commit()
        return {"message": "Password updated. Please sign in again."}

    @app.post("/api/account/delete")
    def delete_account(body: AccountDeletion, request: Request, response: Response, db: DB):
        user = current_user(request, db)
        if not verify_password(user.password_hash, body.current_password):
            raise HTTPException(400, "Current password is incorrect")
        # Remove personal data while retaining a nonidentifying tombstone for references.
        user.email, user.name, user.password_hash, user.disabled = f"deleted-{user.id}@invalid.example", "Deleted account", "!", True
        db.execute(delete(Session).where(Session.user_id == user.id))
        db.execute(delete(ResetToken).where(ResetToken.user_id == user.id))
        for report in db.scalars(select(Report).where(Report.owner_id == user.id)):
            for photo in report.photos:
                (settings.upload_dir / photo).unlink(missing_ok=True)
                (settings.upload_dir / ("thumb-" + photo)).unlink(missing_ok=True)
            report.photos, report.description, report.area, report.status, report.review_status = [], "Removed by account owner", "Removed", "closed", "hidden"
            report.title, report.brand, report.color = "Removed report", "", ""
            report.latitude = report.longitude = report.text_embedding = report.image_embedding = None
        for claim in db.scalars(select(Claim).where(Claim.claimant_id == user.id)):
            claim.evidence, claim.decision_note = "Removed by account owner", ""
        owned_report_ids = select(Report.id).where(Report.owner_id == user.id)
        for claim in db.scalars(select(Claim).where(Claim.report_id.in_(owned_report_ids))):
            claim.decision_note = "Removed by account owner"
        for abuse in db.scalars(select(Abuse).where(Abuse.reporter_id == user.id)):
            abuse.reason = "Removed by account owner"
        for message in db.scalars(select(Message).where(Message.sender_id == user.id)):
            message.body = "Removed by account owner"
        db.execute(delete(Notification).where(Notification.user_id == user.id))
        db.commit()
        response.delete_cookie("findback_session", path="/")
        return {"message": "Account deleted and personal content removed."}

    @app.get("/api/reports")
    def browse(db: DB, q: str = Query(default="", max_length=120), kind: str = "", category: str = "", color: str = Query(default="", max_length=40), brand: str = Query(default="", max_length=80), area: str = Query(default="", max_length=120), after: str = "", page: int = Query(default=1, ge=1, le=10000), size: int = Query(default=12, ge=1, le=48)):
        query = select(Report).where(Report.review_status == "published", Report.status == "active")
        if q:
            query = query.where(or_(Report.title.icontains(q, autoescape=True), Report.description.icontains(q, autoescape=True)))
        for key, value in (("kind", kind), ("category", category)):
            if value:
                query = query.where(getattr(Report, key) == value)
        for key, value in (("color", color), ("brand", brand), ("area", area)):
            if value:
                query = query.where(getattr(Report, key).icontains(value, autoescape=True))
        if after:
            from datetime import date
            try:
                date.fromisoformat(after)
            except ValueError:
                raise HTTPException(422, "Invalid date filter")
            query = query.where(Report.event_date >= after)
        total = db.scalar(select(func.count()).select_from(query.subquery()))
        reports = db.scalars(query.order_by(Report.created_at.desc(), Report.id).offset((page - 1) * size).limit(size))
        return {"items": [report_json(r) for r in reports], "total": total, "page": page}

    @app.post("/api/reports", status_code=201)
    async def create_report(request: Request, db: DB, payload: str = Form(...), photos: list[UploadFile] = File(default=[])):
        user = current_user(request, db)
        limit(request, "report", 10, 3600)
        from pydantic import ValidationError
        try:
            body = ReportInput.model_validate_json(payload)
        except ValidationError as exc:
            # Pydantic's input values may include private content; never return them.
            raise HTTPException(422, [{"loc": list(e["loc"]), "msg": e["msg"]} for e in exc.errors()])
        verify_bot(settings, body.bot_token, "report")
        if len(photos) > 3:
            raise HTTPException(422, "Upload up to three photos")
        names = []
        try:
            for photo in photos:
                names.append(save_image(await photo.read(MAX_UPLOAD + 1), settings.upload_dir))
            data = body.model_dump(exclude={"bot_token"})
            data["event_date"] = body.event_date.isoformat()
            for coordinate in ("latitude", "longitude"):
                if data[coordinate] is not None:
                    data[coordinate] = round(data[coordinate] / 0.02) * 0.02
            report = Report(owner_id=user.id, photos=names, review_status="pending" if settings.require_moderation else "published", **data)
            db.add(report)
            db.commit()
        except Exception:
            for name in names:
                (settings.upload_dir / name).unlink(missing_ok=True)
                (settings.upload_dir / ("thumb-" + name)).unlink(missing_ok=True)
            raise
        return report_json(report)

    @app.get("/api/reports/{id}")
    def detail(id: str, request: Request, db: DB):
        report = visible_report(request, db, id)
        user = optional_user(request, db)
        return report_json(report) | {"is_owner": bool(user and user.id == report.owner_id)}

    @app.patch("/api/reports/{id}/status")
    def report_status(id: str, body: dict, request: Request, db: DB):
        user = current_user(request, db)
        report = db.get(Report, id)
        if not report or report.owner_id != user.id:
            raise HTTPException(404, "Report not found")
        if body.get("status") not in ("recovered", "closed", "active"):
            raise HTTPException(422, "Invalid recovery status")
        report.status = body["status"]
        db.commit()
        return report_json(report)

    @app.get("/api/photos/{id}/{name}")
    def photo(id: str, name: str, request: Request, db: DB, thumb: bool = False):
        report = visible_report(request, db, id)
        if name not in report.photos:
            raise HTTPException(404, "Photo not found")
        path = settings.upload_dir / (("thumb-" if thumb else "") + name)
        if not path.is_file():
            raise HTTPException(404, "Photo not found")
        return FileResponse(path, media_type="image/webp")

    @app.get("/api/reports/{id}/matches")
    def matches(id: str, request: Request, db: DB):
        user = current_user(request, db)
        report = db.get(Report, id)
        if not report or report.owner_id != user.id:
            raise HTTPException(404, "Report not found")
        try:
            ranked = ranked_matches(db, report, settings)
        except EmbeddingsUnavailable as exc:
            raise HTTPException(503, str(exc))
        return {"source": report_json(report), "items": [report_json(r) | score for r, score in ranked], "disclaimer": "Similarity is a suggestion, not proof of ownership."}

    @app.post("/api/search/visual")
    async def visual_search(request: Request, db: DB, photo: UploadFile = File(...)):
        current_user(request, db)
        limit(request, "visual", 10, 600)
        _, image = clean_image(await photo.read(MAX_UPLOAD + 1))
        import asyncio
        try:
            vector = await asyncio.to_thread(app.state.embedder.encode, image)
        except EmbeddingsUnavailable as exc:
            raise HTTPException(503, str(exc))
        query = select(Report).where(Report.review_status == "published", Report.status == "active", Report.image_embedding.is_not(None))
        if engine.dialect.name == "postgresql":
            query = query.order_by(Report.image_embedding.cosine_distance(vector)).limit(30)
        else:
            query = query.order_by(Report.created_at.desc()).limit(500)
        ranked = [(r, cosine(vector, r.image_embedding)) for r in db.scalars(query)]
        return {"items": [report_json(r) | {"score": score, "reasons": ["Photo similarity only; ownership is unverified"]} for r, score in sorted(ranked, key=lambda x: x[1], reverse=True)[:20]]}

    @app.post("/api/reports/{id}/claims", status_code=201)
    def create_claim(id: str, body: ClaimInput, request: Request, db: DB):
        user = current_user(request, db)
        limit(request, "claim", 10, 3600)
        verify_bot(settings, body.bot_token, "claim")
        report = visible_report(request, db, id)
        if report.kind != "found" or report.status != "active" or report.owner_id == user.id:
            raise HTTPException(409, "This item cannot be claimed")
        claim = Claim(report_id=id, claimant_id=user.id, evidence=body.evidence.strip())
        db.add(claim)
        try:
            conversation = get_conversation(db, report, user)
            notify(db, report.owner_id, "claim", "A new ownership claim needs your review.", "/claims")
            db.commit()
        except IntegrityError:
            db.rollback()
            raise HTTPException(409, "You already have a claim for this item")
        return {"id": claim.id, "status": claim.status, "conversation_id": conversation.id}

    @app.get("/api/claims")
    def claims(request: Request, db: DB):
        user = current_user(request, db)
        rows = db.execute(select(Claim, Report).join(Report, Report.id == Claim.report_id).where(or_(Claim.claimant_id == user.id, Report.owner_id == user.id)).order_by(Claim.created_at.desc()).limit(100))
        return [{"id": c.id, "report": report_json(r), "status": c.status, "evidence": c.evidence, "decision_note": c.decision_note, "can_decide": r.owner_id == user.id, "created_at": c.created_at} for c, r in rows]

    @app.patch("/api/claims/{id}")
    def decide_claim(id: str, body: Decision, request: Request, db: DB):
        user = current_user(request, db)
        claim = db.scalar(select(Claim).where(Claim.id == id).with_for_update())
        report = db.scalar(select(Report).where(Report.id == claim.report_id).with_for_update()) if claim else None
        if not report or report.owner_id != user.id:
            raise HTTPException(404, "Claim not found")
        if claim.status != "pending" or report.status != "active":
            raise HTTPException(409, "This claim has already been decided or the report is closed")
        claim.status, claim.decision_note = body.status, body.note.strip()
        if body.status == "accepted":
            report.status = "handoff"
            for other in db.scalars(select(Claim).where(Claim.report_id == report.id, Claim.id != claim.id, Claim.status == "pending")):
                other.status, other.decision_note = "rejected", "Another ownership claim was accepted by the finder."
                notify(db, other.claimant_id, "claim", "A claim decision is ready.", "/claims")
        notify(db, claim.claimant_id, "claim", "Your ownership claim has a decision. Review the private details.", "/claims")
        db.commit()
        return {"status": claim.status}

    @app.post("/api/reports/{id}/conversations", status_code=201)
    def start_conversation(id: str, request: Request, db: DB):
        user = current_user(request, db)
        limit(request, "conversation", 20, 3600)
        report = visible_report(request, db, id)
        if report.owner_id == user.id or report.status != "active":
            raise HTTPException(409, "Cannot start a conversation about this report")
        other = db.get(User, report.owner_id)
        if other.disabled:
            raise HTTPException(409, "This account is unavailable")
        conversation = get_conversation(db, report, user)
        db.commit()
        return {"id": conversation.id}

    @app.get("/api/conversations")
    def conversations(request: Request, db: DB):
        user = current_user(request, db)
        rows = db.execute(select(Conversation, Report.title).join(Report, Report.id == Conversation.report_id).where(or_(Conversation.initiator_id == user.id, Conversation.owner_id == user.id)).order_by(Conversation.created_at.desc()).limit(100))
        return [{"id": c.id, "title": title, "report_id": c.report_id} for c, title in rows]

    @app.get("/api/conversations/{id}/messages")
    def messages(id: str, request: Request, db: DB, after: str = ""):
        user, conversation = participating_conversation(request, db, id)
        rows = db.scalars(select(Message).where(Message.conversation_id == id).order_by(Message.created_at.desc(), Message.id).limit(200)).all()
        return [{"id": m.id, "body": m.body, "mine": m.sender_id == user.id, "created_at": m.created_at} for m in reversed(rows)]

    @app.post("/api/conversations/{id}/messages", status_code=201)
    def send_message(id: str, body: MessageInput, request: Request, db: DB):
        user, conversation = participating_conversation(request, db, id)
        limit(request, "message", 30, 60)
        recipient = conversation.owner_id if user.id == conversation.initiator_id else conversation.initiator_id
        if db.get(User, recipient).disabled:
            raise HTTPException(409, "This account is unavailable")
        message = Message(conversation_id=id, sender_id=user.id, body=body.body)
        db.add(message)
        notify(db, recipient, "message", "You have a new private message.", f"/messages/{id}")
        db.commit()
        return {"id": message.id, "body": message.body, "mine": True, "created_at": message.created_at}

    @app.get("/api/dashboard")
    def dashboard(request: Request, db: DB):
        user = current_user(request, db)
        reports = db.scalars(select(Report).where(Report.owner_id == user.id).order_by(Report.created_at.desc()).limit(100))
        return {"reports": [report_json(r) for r in reports]}

    @app.get("/api/notifications")
    def notifications(request: Request, db: DB):
        user = current_user(request, db)
        rows = db.scalars(select(Notification).where(Notification.user_id == user.id).order_by(Notification.created_at.desc()).limit(50))
        return [{"id": n.id, "text": n.text, "href": n.href, "read": n.read, "kind": n.kind, "created_at": n.created_at} for n in rows]

    @app.post("/api/notifications/read", status_code=204)
    def read_notifications(request: Request, db: DB):
        user = current_user(request, db)
        for notification in db.scalars(select(Notification).where(Notification.user_id == user.id, Notification.read == False)):
            notification.read = True
        db.commit()

    @app.post("/api/reports/{id}/abuse", status_code=201)
    def abuse(id: str, body: MessageInput, request: Request, db: DB):
        user = current_user(request, db)
        limit(request, "abuse", 5, 3600)
        visible_report(request, db, id)
        db.add(Abuse(report_id=id, reporter_id=user.id, reason=body.body))
        db.commit()
        return {"message": "Your report has been sent to the moderation team."}

    @app.get("/api/admin")
    def admin(request: Request, db: DB):
        user = staff(request, db)
        pending = db.scalars(select(Report).where(Report.review_status == "pending").order_by(Report.created_at).limit(100))
        abuses = db.execute(select(Abuse, Report.title).join(Report).where(Abuse.status == "open").limit(100))
        counts = {"users": db.scalar(select(func.count(User.id))), "reports": db.scalar(select(func.count(Report.id))), "recovered": db.scalar(select(func.count(Report.id)).where(Report.status == "recovered")), "pending_claims": db.scalar(select(func.count(Claim.id)).where(Claim.status == "pending"))}
        users = [{**public_user(u), "disabled": u.disabled} for u in db.scalars(select(User).order_by(User.created_at.desc()).limit(100))] if user.role == "admin" else []
        return {"counts": counts, "pending": [report_json(r) for r in pending], "abuses": [{"id": a.id, "report_id": a.report_id, "title": title, "reason": a.reason} for a, title in abuses], "users": users}

    @app.patch("/api/admin/reports/{id}")
    def review(id: str, body: Review, request: Request, db: DB):
        staff(request, db)
        report = db.get(Report, id)
        if not report:
            raise HTTPException(404, "Report not found")
        report.review_status = body.status
        if body.status == "published":
            report.embedding_status = "pending"  # Worker also discovers new matches on publication.
        notify(db, report.owner_id, "review", "Your report has a moderation update.", f"/items/{id}")
        db.commit()
        return report_json(report)

    @app.patch("/api/admin/abuse/{id}")
    def close_abuse(id: str, request: Request, db: DB):
        staff(request, db)
        abuse = db.get(Abuse, id)
        if not abuse:
            raise HTTPException(404, "Abuse report not found")
        abuse.status = "resolved"
        db.commit()
        return {"status": "resolved"}

    @app.patch("/api/admin/users/{id}")
    def change_role(id: str, body: RoleChange, request: Request, db: DB):
        actor = staff(request, db, admin=True)
        user = db.get(User, id)
        if not user:
            raise HTTPException(404, "User not found")
        if actor.id == id:
            raise HTTPException(409, "You cannot change your own access")
        user.role, user.disabled = body.role, body.disabled
        if body.disabled:
            db.execute(delete(Session).where(Session.user_id == id))
            for report in db.scalars(select(Report).where(Report.owner_id == id)):
                report.review_status = "hidden"
        db.commit()
        return public_user(user)

    @app.get("/robots.txt", response_class=PlainTextResponse)
    def robots():
        return "User-agent: *\nDisallow: /api/\nDisallow: /dashboard\nDisallow: /messages\nDisallow: /claims\nDisallow: /settings\nDisallow: /admin\nDisallow: /matches\nDisallow: /reset-password\nSitemap: " + settings.public_origin + "/sitemap.xml\n"

    public_pages = {"/": ("FindBack — Find your way back", "Report a lost item, discover found belongings, and connect safely on FindBack."), "/browse": ("Browse lost & found items — FindBack", "Search community reports by category and approximate area. Ownership requires verification."), "/privacy-policy": ("Privacy policy — FindBack", "How FindBack handles accounts, photos, locations, private messages, and ownership evidence."), "/terms-and-conditions": ("Terms & conditions — FindBack", "FindBack reporting, ownership verification, moderation, and safe exchange terms.")}

    @app.get("/sitemap.xml")
    def sitemap():
        entries = "".join(f"<url><loc>{html.escape(settings.public_origin + path)}</loc></url>" for path in public_pages)
        return Response('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' + entries + "</urlset>", media_type="application/xml")

    @app.get("/{path:path}")
    def web(path: str):
        if path.startswith("api/"):
            raise HTTPException(404, "API endpoint not found")
        root = settings.frontend_dist.resolve()
        asset = (root / path).resolve()
        if path and asset.is_relative_to(root) and asset.is_file() and path != "index.html":
            lifetime = "public, max-age=31536000, immutable" if path.startswith("assets/") else "public, max-age=86400"
            return FileResponse(asset, headers={"Cache-Control": lifetime})
        if not (root / "index.html").is_file():
            return HTMLResponse("<h1>FindBack API is running</h1><p>Start the Vite frontend on localhost:5173, or build frontend/dist.</p>", status_code=503)
        route = "/" + path
        title, description = public_pages.get(route, ("FindBack — Private recovery workspace", "Sign in to manage your FindBack reports and recovery conversations."))
        canonical = html.escape(settings.public_origin + route, quote=True)
        import re
        known = route in public_pages or route in ("/search", "/login", "/register", "/forgot-password", "/reset-password", "/report-lost", "/report-found", "/dashboard", "/claims", "/messages", "/settings", "/admin") or bool(re.fullmatch(r"(?:items|matches|messages)/[a-f0-9-]{36}", path))
        if not known:
            title, description = "Page not found — FindBack", "Find your way back to FindBack home or browse item reports."
        meta = f'<title>{html.escape(title)}</title><meta name="description" content="{html.escape(description, quote=True)}"><link rel="canonical" href="{canonical}"><meta property="og:title" content="{html.escape(title, quote=True)}"><meta property="og:description" content="{html.escape(description, quote=True)}"><meta property="og:url" content="{canonical}"><meta property="og:type" content="website"><meta property="og:image" content="{settings.public_origin}/og.png"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="{html.escape(title, quote=True)}"><meta name="twitter:description" content="{html.escape(description, quote=True)}"><meta name="twitter:image" content="{settings.public_origin}/og.png">'
        if route not in public_pages:
            meta += '<meta name="robots" content="noindex,nofollow">'
        document = (root / "index.html").read_text(encoding="utf-8")
        document = re.sub(r"<title>.*?</title>", "", document)
        document = re.sub(r'<meta name="description"[^>]*>', "", document)
        return HTMLResponse(document.replace("</head>", meta + "</head>"), status_code=200 if known else 404)

    return app


app = create_app()
