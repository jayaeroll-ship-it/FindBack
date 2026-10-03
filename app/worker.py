"""Durable database-backed embedding queue. Run one worker per deployment."""
import time
from sqlalchemy import select
from .config import Settings
from .db import create_database
from .models import Report
from .matching import ClipEmbedder, process_report, EmbeddingsUnavailable


def run(once=False):
    settings = Settings()
    settings.validate_runtime()
    _, factory = create_database(settings.database_url)
    embedder = ClipEmbedder(settings)
    while True:
        from .mail import deliver_pending
        deliver_pending(settings)
        failed = False
        with factory() as db:
            pending = db.scalars(select(Report).where(Report.embedding_status == "pending").order_by(Report.created_at).limit(20)).all()
            for report in pending:
                try:
                    process_report(db, report, settings, embedder)
                except EmbeddingsUnavailable:
                    db.rollback()
                    print("CLIP unavailable. Install AI dependencies and pre-download the model; queue retained.")
                    failed = True
                    break
        if once:
            return
        time.sleep(30 if failed else 5)


if __name__ == "__main__":
    import sys
    run("--once" in sys.argv)
