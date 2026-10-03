"""Initial schema with pgvector semantic indexes."""
from alembic import op
from migrations.initial_schema import Base

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        op.execute("CREATE EXTENSION IF NOT EXISTS vector")
    Base.metadata.create_all(bind)
    if bind.dialect.name == "postgresql":
        op.execute("CREATE INDEX ix_reports_text_hnsw ON reports USING hnsw (text_embedding vector_cosine_ops)")
        op.execute("CREATE INDEX ix_reports_image_hnsw ON reports USING hnsw (image_embedding vector_cosine_ops)")


def downgrade():
    Base.metadata.drop_all(op.get_bind())
