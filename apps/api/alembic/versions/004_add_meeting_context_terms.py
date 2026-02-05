"""Add context_terms and context_instructions fields to meetings table.

Session-level terminology/keywords for improved STT accuracy
and AI minutes generation context.

Revision ID: 004
Revises: 003
Create Date: 2026-02-04

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "004"
down_revision: str = "003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("meetings", sa.Column("context_terms", sa.JSON(), nullable=True))
    op.add_column("meetings", sa.Column("context_instructions", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("meetings", "context_instructions")
    op.drop_column("meetings", "context_terms")
