from datetime import datetime, timezone
from uuid import uuid4
from sqlalchemy import String, Text, Float, Integer, ForeignKey, UniqueConstraint, JSON, DateTime, Index
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from pgvector.sqlalchemy import Vector


def uid():
    return str(uuid4())


def now():
    return datetime.now(timezone.utc).replace(tzinfo=None)


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    email: Mapped[str] = mapped_column(String(254), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(80))
    password_hash: Mapped[str] = mapped_column(Text)
    role: Mapped[str] = mapped_column(String(20), default="user")
    disabled: Mapped[bool] = mapped_column(default=False)
    created_at: Mapped[datetime] = mapped_column(default=now)


class Session(Base):
    __tablename__ = "sessions"
    token_hash: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    csrf: Mapped[str] = mapped_column(String(64))
    expires_at: Mapped[datetime] = mapped_column(DateTime, index=True)


class ResetToken(Base):
    __tablename__ = "reset_tokens"
    token_hash: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    expires_at: Mapped[datetime] = mapped_column(DateTime)


class Report(Base):
    __tablename__ = "reports"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    owner_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    kind: Mapped[str] = mapped_column(String(10), index=True)
    title: Mapped[str] = mapped_column(String(120))
    description: Mapped[str] = mapped_column(Text)
    category: Mapped[str] = mapped_column(String(40), index=True)
    color: Mapped[str] = mapped_column(String(40), default="")
    brand: Mapped[str] = mapped_column(String(80), default="")
    area: Mapped[str] = mapped_column(String(120))
    latitude: Mapped[float | None] = mapped_column(Float)
    longitude: Mapped[float | None] = mapped_column(Float)
    event_date: Mapped[str] = mapped_column(String(10), index=True)
    status: Mapped[str] = mapped_column(String(20), default="active", index=True)
    review_status: Mapped[str] = mapped_column(String(20), default="pending", index=True)
    photos: Mapped[list] = mapped_column(JSON, default=list)
    text_embedding: Mapped[list | None] = mapped_column(Vector(512).with_variant(JSON(), "sqlite"))
    image_embedding: Mapped[list | None] = mapped_column(Vector(512).with_variant(JSON(), "sqlite"))
    embedding_status: Mapped[str] = mapped_column(String(20), default="pending")
    created_at: Mapped[datetime] = mapped_column(default=now, index=True)
    __table_args__ = (Index("ix_report_public_feed", "review_status", "status", "created_at"),)


class Claim(Base):
    __tablename__ = "claims"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    report_id: Mapped[str] = mapped_column(ForeignKey("reports.id"), index=True)
    claimant_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    evidence: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(20), default="pending")
    decision_note: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(default=now)
    __table_args__ = (UniqueConstraint("report_id", "claimant_id"),)


class Conversation(Base):
    __tablename__ = "conversations"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    report_id: Mapped[str] = mapped_column(ForeignKey("reports.id"), index=True)
    initiator_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    owner_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    created_at: Mapped[datetime] = mapped_column(default=now)
    __table_args__ = (UniqueConstraint("report_id", "initiator_id"),)


class Message(Base):
    __tablename__ = "messages"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    conversation_id: Mapped[str] = mapped_column(ForeignKey("conversations.id", ondelete="CASCADE"), index=True)
    sender_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    body: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(default=now)


class Notification(Base):
    __tablename__ = "notifications"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    kind: Mapped[str] = mapped_column(String(20))
    text: Mapped[str] = mapped_column(String(200))
    href: Mapped[str] = mapped_column(String(200))
    read: Mapped[bool] = mapped_column(default=False)
    created_at: Mapped[datetime] = mapped_column(default=now)


class Abuse(Base):
    __tablename__ = "abuse_reports"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    report_id: Mapped[str] = mapped_column(ForeignKey("reports.id"), index=True)
    reporter_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    reason: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(20), default="open")
    created_at: Mapped[datetime] = mapped_column(default=now)


class MatchNotice(Base):
    __tablename__ = "match_notices"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    lost_id: Mapped[str] = mapped_column(ForeignKey("reports.id"), index=True)
    found_id: Mapped[str] = mapped_column(ForeignKey("reports.id"), index=True)
    __table_args__ = (UniqueConstraint("lost_id", "found_id"),)


class Analytics(Base):
    __tablename__ = "analytics_totals"
    day: Mapped[str] = mapped_column(String(10), primary_key=True)
    event: Mapped[str] = mapped_column(String(40), primary_key=True)
    site: Mapped[str] = mapped_column(String(100), primary_key=True)
    count: Mapped[int] = mapped_column(Integer, default=0)

