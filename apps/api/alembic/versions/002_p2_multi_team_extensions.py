"""P2: Multi-team extensions, vocabulary, chat filtering.

Adds missing columns and tables for P2 features:
- teams: password_hash, confluence_base_url, confluence_space_key
- meetings: meeting_type, agenda_items
- New table: vocabularies (team-specific terminology)
- New table: filtered_contents (chat/casual talk filtering)

Revision ID: 002
Revises: 001
Create Date: 2026-02-02

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "002"
down_revision: str = "001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # --- teams: add P2 columns ---
    op.add_column("teams", sa.Column("password_hash", sa.String(255), nullable=True))
    op.add_column("teams", sa.Column("confluence_base_url", sa.String(500), nullable=True))
    op.add_column("teams", sa.Column("confluence_space_key", sa.String(50), nullable=True))

    # --- meetings: add P2 columns ---
    op.add_column(
        "meetings",
        sa.Column(
            "meeting_type",
            sa.String(20),
            nullable=False,
            server_default="weekly_report",
        ),
    )
    op.add_column("meetings", sa.Column("agenda_items", sa.JSON(), nullable=True))

    # --- vocabularies: new table ---
    op.create_table(
        "vocabularies",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("team_id", sa.Uuid(), nullable=False),
        sa.Column("term", sa.String(200), nullable=False),
        sa.Column("correction", sa.String(200), nullable=False),
        sa.Column(
            "category",
            sa.String(50),
            nullable=False,
            server_default="terminology",
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["team_id"], ["teams.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("team_id", "term", name="uq_team_term"),
    )

    # --- filtered_contents: new table ---
    op.create_table(
        "filtered_contents",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("meeting_id", sa.Uuid(), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column(
            "filter_reason",
            sa.String(50),
            nullable=False,
            server_default="casual_talk",
        ),
        sa.Column("confidence", sa.Float(), nullable=True),
        sa.Column(
            "is_restored",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
        sa.Column(
            "is_confirmed",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
        sa.Column("speaker_label", sa.String(50), nullable=True),
        sa.Column("speaker_name", sa.String(50), nullable=True),
        sa.Column("start_time", sa.Float(), nullable=True),
        sa.Column("end_time", sa.Float(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["meeting_id"], ["meetings.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_filtered_contents_meeting_id",
        "filtered_contents",
        ["meeting_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_filtered_contents_meeting_id", table_name="filtered_contents")
    op.drop_table("filtered_contents")
    op.drop_table("vocabularies")
    op.drop_column("meetings", "agenda_items")
    op.drop_column("meetings", "meeting_type")
    op.drop_column("teams", "confluence_space_key")
    op.drop_column("teams", "confluence_base_url")
    op.drop_column("teams", "password_hash")
