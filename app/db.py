from pathlib import Path
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool


def create_database(url):
    sqlite = url.startswith("sqlite")
    if sqlite:
        Path("data").mkdir(exist_ok=True)
    kwargs = {"connect_args": {"check_same_thread": False, "timeout": 30}} if sqlite else {"pool_pre_ping": True}
    if url.endswith(":memory:"):
        kwargs["poolclass"] = StaticPool
    engine = create_engine(url, hide_parameters=True, **kwargs)
    if sqlite:
        @event.listens_for(engine, "connect")
        def foreign_keys(conn, record):
            conn.execute("PRAGMA foreign_keys=ON")
            if not url.endswith(":memory:"):
                conn.execute("PRAGMA journal_mode=WAL")
    return engine, sessionmaker(engine, expire_on_commit=False)

