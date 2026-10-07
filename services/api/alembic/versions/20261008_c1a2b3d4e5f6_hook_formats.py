"""hook_patterns.format -> formats (список форматов)

Revision ID: c1a2b3d4e5f6
Revises: b78957cf3e78
Create Date: 2026-10-08 00:00:00
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "c1a2b3d4e5f6"
down_revision: str | None = "b78957cf3e78"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

JSONB = sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), "postgresql")


def upgrade() -> None:
    op.add_column("hook_patterns", sa.Column("formats", JSONB, nullable=False, server_default=sa.text("'[]'::jsonb")))
    op.execute("UPDATE hook_patterns SET formats = jsonb_build_array(format) WHERE format IS NOT NULL")
    op.drop_column("hook_patterns", "format")


def downgrade() -> None:
    op.add_column("hook_patterns", sa.Column("format", sa.String(length=40), nullable=True))
    op.execute("UPDATE hook_patterns SET format = formats->>0 WHERE jsonb_array_length(formats) > 0")
    op.drop_column("hook_patterns", "formats")
