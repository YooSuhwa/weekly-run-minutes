"""Initial schema with P1-full support.

Revision ID: 001
Revises: None
Create Date: 2025-01-23

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Teams
    op.create_table(
        "teams",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    # Team Members
    op.create_table(
        "team_members",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("team_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(50), nullable=False),
        sa.Column("presentation_order", sa.Integer(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.ForeignKeyConstraint(["team_id"], ["teams.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )

    # Meetings
    op.create_table(
        "meetings",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("team_id", sa.Uuid(), nullable=False),
        sa.Column("meeting_date", sa.Date(), nullable=False),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("status", sa.String(50), nullable=False, server_default="created"),
        sa.Column("meeting_mode", sa.String(20), nullable=False, server_default="upload"),
        sa.Column("error_message", sa.Text(), nullable=True),
        # Realtime orchestration (P1-full)
        sa.Column("current_speaker_index", sa.Integer(), nullable=True),
        sa.Column("current_item_index", sa.Integer(), nullable=True),
        sa.Column("question_tree_data", sa.JSON(), nullable=True),
        # Confluence
        sa.Column("confluence_page_id", sa.String(50), nullable=True),
        sa.Column("confluence_page_url", sa.String(500), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.ForeignKeyConstraint(["team_id"], ["teams.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )

    # Recordings
    op.create_table(
        "recordings",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("meeting_id", sa.Uuid(), nullable=False),
        sa.Column("original_filename", sa.String(255), nullable=False),
        sa.Column("stored_filename", sa.String(255), nullable=False),
        sa.Column("file_path", sa.String(500), nullable=False),
        sa.Column("file_size", sa.BigInteger(), nullable=False),
        sa.Column("mime_type", sa.String(100), nullable=False),
        sa.Column("duration_seconds", sa.Float(), nullable=True),
        sa.Column("source", sa.String(20), nullable=False, server_default="upload"),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.ForeignKeyConstraint(["meeting_id"], ["meetings.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("meeting_id"),
    )

    # Weekly Reports
    op.create_table(
        "weekly_reports",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("meeting_id", sa.Uuid(), nullable=False),
        sa.Column("confluence_page_id", sa.String(50), nullable=False),
        sa.Column("confluence_page_url", sa.String(500), nullable=False),
        sa.Column("raw_html", sa.Text(), nullable=False),
        sa.Column("parsed_data", sa.JSON(), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.ForeignKeyConstraint(["meeting_id"], ["meetings.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("meeting_id"),
    )

    # Transcripts
    op.create_table(
        "transcripts",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("meeting_id", sa.Uuid(), nullable=False),
        sa.Column("start_time", sa.Float(), nullable=False),
        sa.Column("end_time", sa.Float(), nullable=False),
        sa.Column("speaker_label", sa.String(50), nullable=True),
        sa.Column("speaker_name", sa.String(50), nullable=True),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("confidence", sa.Float(), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.ForeignKeyConstraint(["meeting_id"], ["meetings.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_transcripts_meeting_id", "transcripts", ["meeting_id"])

    # Meeting Minutes
    op.create_table(
        "meeting_minutes",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("meeting_id", sa.Uuid(), nullable=False),
        sa.Column("content_markdown", sa.Text(), nullable=False),
        sa.Column("ai_model", sa.String(50), nullable=False),
        sa.Column("prompt_version", sa.String(20), nullable=False),
        sa.Column("corrections", sa.JSON(), nullable=False),
        sa.Column("is_edited", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("edited_content", sa.Text(), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.ForeignKeyConstraint(["meeting_id"], ["meetings.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("meeting_id"),
    )


def downgrade() -> None:
    op.drop_table("meeting_minutes")
    op.drop_index("ix_transcripts_meeting_id", table_name="transcripts")
    op.drop_table("transcripts")
    op.drop_table("weekly_reports")
    op.drop_table("recordings")
    op.drop_table("meetings")
    op.drop_table("team_members")
    op.drop_table("teams")
