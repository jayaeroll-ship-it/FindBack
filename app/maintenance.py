"""Run daily using a deployment scheduler; purge content under configured policy."""
from datetime import timedelta
from pathlib import Path
from sqlalchemy import select, delete, or_
from .config import Settings
from .db import create_database
from .models import Report, Claim, Message, Conversation, Notification, Abuse, MatchNotice, Session, ResetToken, Analytics, now

def run():
    settings = Settings()
    if settings.retention_days <= 0:
        raise SystemExit("Configure RETENTION_DAYS before running content retention")
    _, factory = create_database(settings.database_url)
    cutoff = now() - timedelta(days=settings.retention_days)
    with factory() as db:
        db.execute(delete(Session).where(Session.expires_at < now()))
        db.execute(delete(ResetToken).where(ResetToken.expires_at < now()))
        db.execute(delete(Notification).where(Notification.created_at < cutoff))
        db.execute(delete(Message).where(Message.created_at < cutoff))
        db.execute(delete(Analytics).where(Analytics.day < cutoff.date().isoformat()))
        for report in db.scalars(select(Report).where(Report.created_at < cutoff)).all():
            conversations = select(Conversation.id).where(Conversation.report_id == report.id)
            db.execute(delete(Message).where(Message.conversation_id.in_(conversations)))
            db.execute(delete(Conversation).where(Conversation.report_id == report.id))
            db.execute(delete(Claim).where(Claim.report_id == report.id))
            db.execute(delete(Abuse).where(Abuse.report_id == report.id))
            db.execute(delete(MatchNotice).where(or_(MatchNotice.lost_id == report.id, MatchNotice.found_id == report.id)))
            for name in report.photos:
                (settings.upload_dir / name).unlink(missing_ok=True)
                (settings.upload_dir / ("thumb-" + name)).unlink(missing_ok=True)
            db.delete(report)
        db.commit()
    # Development reset emails are backend-only and short-lived.
    for mailbox in (Path("data/dev-mail"), Path("data/email-outbox")):
        if mailbox.exists():
            import time
            for path in mailbox.glob("*.eml"):
                if time.time() - path.stat().st_mtime > 1800:
                    path.unlink()

if __name__ == "__main__":
    run()
