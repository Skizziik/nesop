"""projects + project_versions (видеоредактор, длинные лекции)

Revision ID: d2e3f4a5b6c7
Revises: c1a2b3d4e5f6
Create Date: 2026-10-08 12:00:00
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "d2e3f4a5b6c7"
down_revision: str | None = "c1a2b3d4e5f6"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

J = sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), "postgresql")


def upgrade() -> None:
    op.create_table(
        "projects",
        sa.Column("id", sa.String(32), primary_key=True),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("kind", sa.String(20), nullable=False),
        sa.Column("aspect", sa.String(8), nullable=False),
        sa.Column("doc", J, nullable=False),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("progress", sa.Float(), nullable=False),
        sa.Column("stage", sa.String(40), nullable=False),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column("out_dir", sa.String(300), nullable=True),
        sa.Column("series_id", sa.String(32), sa.ForeignKey("series.id", ondelete="SET NULL"), nullable=True),
        sa.Column("video_id", sa.String(32), nullable=True),
        sa.Column("params", J, nullable=False),
        sa.Column("meta", J, nullable=False),
        sa.Column("revision", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_projects_status", "projects", ["status"])
    op.create_index("ix_projects_created_at", "projects", ["created_at"])
    op.create_table(
        "project_versions",
        sa.Column("id", sa.String(32), primary_key=True),
        sa.Column("project_id", sa.String(32), sa.ForeignKey("projects.id", ondelete="CASCADE"), nullable=False),
        sa.Column("revision", sa.Integer(), nullable=False),
        sa.Column("doc", J, nullable=False),
        sa.Column("note", sa.String(200), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_project_versions_project_id", "project_versions", ["project_id"])
    op.create_index("ix_project_versions_created_at", "project_versions", ["created_at"])


def downgrade() -> None:
    op.drop_table("project_versions")
    op.drop_table("projects")
