import math
from datetime import date
from functools import cached_property
from threading import Lock
from PIL import Image
from sqlalchemy import select, or_
from .models import Report, MatchNotice, Notification


class EmbeddingsUnavailable(Exception):
    pass


class ClipEmbedder:
    """Real shared 512-dimensional image/text CLIP model; no synthetic fallback."""
    def __init__(self, settings):
        self.settings = settings
        self.lock = Lock()

    @cached_property
    def model(self):
        from sentence_transformers import SentenceTransformer
        return SentenceTransformer(self.settings.embedding_model, cache_folder=str(self.settings.model_cache), device="cpu", local_files_only=self.settings.embedding_local_only)

    def encode(self, value):
        try:
            with self.lock:
                embedding = self.model.encode(value, normalize_embeddings=True).tolist()
            if len(embedding) != 512:
                raise ValueError("Model must use 512 dimensions")
            return embedding
        except Exception as exc:
            # Do not log image paths, descriptions, tokens, or evidence.
            raise EmbeddingsUnavailable("Configure and download the CLIP model to enable similarity matching") from exc

    def text(self, report):
        # CLIP text input has a short context window; identifying attributes first.
        return self.encode(f"{report.category} {report.brand} {report.color} {report.title}. {report.description}")


def cosine(a, b):
    if a is None or b is None:
        return None
    numerator = sum(float(x) * float(y) for x, y in zip(a, b))
    denominator = math.sqrt(sum(float(x) ** 2 for x in a) * sum(float(x) ** 2 for x in b))
    return max(0.0, min(1.0, numerator / denominator)) if denominator else 0.0


def distance_km(a, b):
    if a.latitude is None or b.latitude is None:
        return None
    lat1, lat2 = math.radians(a.latitude), math.radians(b.latitude)
    dlat, dlon = lat2 - lat1, math.radians(b.longitude - a.longitude)
    h = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    return 6371 * 2 * math.asin(min(1, math.sqrt(h)))


def score_pair(a, b, weights):
    image = cosine(a.image_embedding, b.image_embedding)
    text = cosine(a.text_embedding, b.text_embedding)
    distance = distance_km(a, b)
    days = abs((date.fromisoformat(a.event_date) - date.fromisoformat(b.event_date)).days)
    components = [image, text, float(a.category == b.category), math.exp(-distance / 15) if distance is not None else None, math.exp(-days / 30)]
    available = [(v, w) for v, w in zip(components, weights) if v is not None]
    total = sum(w for v, w in available)
    score = sum(v * w for v, w in available) / total if total else 0.0
    reasons = []
    if image is not None:
        reasons.append(f"Photo similarity {round(image * 100)}%")
    if text is not None:
        reasons.append(f"Description similarity {round(text * 100)}%")
    if a.category == b.category:
        reasons.append("Same category")
    if distance is not None:
        reasons.append(f"Approximate areas {round(distance)} km apart")
    reasons.append(f"Reported dates {days} days apart")
    return {"score": round(score, 4), "reasons": reasons}


def ranked_matches(db, source, settings, limit=20):
    if source.embedding_status != "ready":
        raise EmbeddingsUnavailable("This report is waiting for its embedding. Run the embedding worker.")
    query = select(Report).where(Report.kind != source.kind, Report.owner_id != source.owner_id, Report.status == "active", Report.review_status == "published", Report.embedding_status == "ready")
    if db.bind.dialect.name == "postgresql":
        # Retrieve bounded semantic candidates via pgvector; rerank with all signals.
        text_ids = select(Report.id).where(Report.kind != source.kind, Report.status == "active", Report.review_status == "published", Report.embedding_status == "ready").order_by(Report.text_embedding.cosine_distance(source.text_embedding)).limit(100)
        if source.image_embedding is not None:
            image_ids = select(Report.id).where(Report.kind != source.kind, Report.status == "active", Report.review_status == "published", Report.image_embedding.is_not(None)).order_by(Report.image_embedding.cosine_distance(source.image_embedding)).limit(100)
            query = query.where(or_(Report.id.in_(text_ids), Report.id.in_(image_ids)))
        else:
            query = query.where(Report.id.in_(text_ids))
    else:
        query = query.order_by(Report.created_at.desc()).limit(500)
    weights = [float(w) for w in settings.match_weights.split(",")]
    ranked = [(r, score_pair(source, r, weights)) for r in db.scalars(query)]
    ranked = [(r, detail) for r, detail in ranked if detail["score"] >= settings.match_threshold]
    return sorted(ranked, key=lambda x: x[1]["score"], reverse=True)[:limit]


def process_report(db, report, settings, embedder):
    report.text_embedding = embedder.text(report)
    if report.photos:
        with Image.open(settings.upload_dir / report.photos[0]) as image:
            report.image_embedding = embedder.encode(image.convert("RGB"))
    report.embedding_status = "ready"
    db.commit()
    if report.review_status != "published" or report.status != "active":
        return
    for other, details in ranked_matches(db, report, settings):
        lost, found = (report, other) if report.kind == "lost" else (other, report)
        exists = db.scalar(select(MatchNotice).where(MatchNotice.lost_id == lost.id, MatchNotice.found_id == found.id))
        if not exists:
            db.add(MatchNotice(lost_id=lost.id, found_id=found.id))
            for item in (lost, found):
                db.add(Notification(user_id=item.owner_id, kind="match", text="A potential match is ready to review. Ownership still needs verification.", href=f"/matches/{item.id}"))
    db.commit()
