"""Development-only reports. No mock scores, claims, or messages."""
from datetime import date, timedelta
from getpass import getpass
from sqlalchemy import select
from .config import Settings
from .db import create_database
from .models import Base, User, Report
from .security import hasher

def seed():
    settings = Settings()
    if settings.environment != "development":
        raise SystemExit("Seed data is only allowed in development")
    _, factory = create_database(settings.database_url)
    if settings.database_url.startswith("sqlite"):
        with factory() as db:
            Base.metadata.create_all(db.bind)
    password = getpass("Choose a development seed password (12+ characters): ")
    if len(password) < 12:
        raise SystemExit("Use at least 12 characters")
    with factory() as db:
        if db.scalar(select(User).where(User.email == "demo@example.com")):
            raise SystemExit("Development seed already exists")
        owner = User(email="demo@example.com", name="Development community", password_hash=hasher.hash(password))
        db.add(owner)
        db.flush()
        examples = [
            ("found", "Navy blue backpack", "Bags", "Navy blue", "Central park", "A navy blue canvas backpack with tan straps and a small front pocket. Development sample report."),
            ("lost", "Silver everyday keys", "Keys", "Silver", "Riverside station", "Three silver keys on a round metal keyring with a small blue tag. Development sample report."),
            ("found", "Wireless headphones", "Electronics", "Black", "Library district", "Black over-ear wireless headphones in a zipped travel case. Development sample report."),
            ("lost", "Favorite knit scarf", "Clothing", "Green", "Market square", "A soft green knitted scarf with a short fringe at both ends. Development sample report.")
        ]
        for i, (kind, title, category, color, area, description) in enumerate(examples):
            db.add(Report(owner_id=owner.id, kind=kind, title=title, category=category, color=color, area=area, description=description, event_date=(date.today()-timedelta(days=i)).isoformat(), review_status="published"))
        db.commit()
    print("Development reports created. Login: demo@example.com. Matching is queued; no synthetic embeddings were seeded.")

if __name__ == "__main__":
    seed()
