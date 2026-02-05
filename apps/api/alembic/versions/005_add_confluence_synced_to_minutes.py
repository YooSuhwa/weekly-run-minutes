"""Add confluence_synced field to meeting_minutes table.

Tracks whether the current content has been synced to Confluence.
Set to False when content is edited, True when published.

Revision ID: 005
Revises: 004
Create Date: 2026-02-04

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "005"
down_revision: str = "004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "meeting_minutes",
        sa.Column("confluence_synced", sa.Boolean(), nullable=False, server_default="false"),
    )


def downgrade() -> None:
    op.drop_column("meeting_minutes", "confluence_synced")
