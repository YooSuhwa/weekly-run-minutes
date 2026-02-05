"""Split team settings into separate table.

Extracts confluence_* and filtering_* fields from teams table
into a new team_settings table for separation of concerns.

Revision ID: 003
Revises: e65c9801a256
Create Date: 2026-02-04

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "003"
down_revision: str = "e65c9801a256"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # 1. Create team_settings table
    op.create_table(
        "team_settings",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("team_id", sa.Uuid(), nullable=False),
        sa.Column("confluence_base_url", sa.String(500), nullable=True),
        sa.Column("confluence_space_key", sa.String(50), nullable=True),
        sa.Column("confluence_username", sa.String(100), nullable=True),
        sa.Column("confluence_token", sa.String(500), nullable=True),
        sa.Column("filtering_enabled", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("filtering_confidence_threshold", sa.Float(), nullable=False, server_default="0.7"),
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
        sa.UniqueConstraint("team_id", name="uq_team_settings_team_id"),
    )

    # 2. Migrate existing data from teams to team_settings
    op.execute(
        """
        INSERT INTO team_settings (
            id, team_id,
            confluence_base_url, confluence_space_key, confluence_username, confluence_token,
            filtering_enabled, filtering_confidence_threshold,
            created_at, updated_at
        )
        SELECT
            gen_random_uuid(), id,
            confluence_base_url, confluence_space_key, confluence_username, confluence_token,
            filtering_enabled, filtering_confidence_threshold,
            created_at, updated_at
        FROM teams
        """
    )

    # 3. Remove server defaults from team_settings (model has defaults)
    op.alter_column("team_settings", "filtering_enabled", server_default=None)
    op.alter_column("team_settings", "filtering_confidence_threshold", server_default=None)

    # 4. Drop columns from teams table
    op.drop_column("teams", "confluence_base_url")
    op.drop_column("teams", "confluence_space_key")
    op.drop_column("teams", "confluence_username")
    op.drop_column("teams", "confluence_token")
    op.drop_column("teams", "filtering_enabled")
    op.drop_column("teams", "filtering_confidence_threshold")


def downgrade() -> None:
    # 1. Add columns back to teams table
    op.add_column(
        "teams",
        sa.Column("confluence_base_url", sa.String(500), nullable=True),
    )
    op.add_column(
        "teams",
        sa.Column("confluence_space_key", sa.String(50), nullable=True),
    )
    op.add_column(
        "teams",
        sa.Column("confluence_username", sa.String(100), nullable=True),
    )
    op.add_column(
        "teams",
        sa.Column("confluence_token", sa.String(500), nullable=True),
    )
    op.add_column(
        "teams",
        sa.Column("filtering_enabled", sa.Boolean(), nullable=False, server_default="true"),
    )
    op.add_column(
        "teams",
        sa.Column("filtering_confidence_threshold", sa.Float(), nullable=False, server_default="0.7"),
    )

    # 2. Migrate data back from team_settings to teams
    op.execute(
        """
        UPDATE teams
        SET
            confluence_base_url = ts.confluence_base_url,
            confluence_space_key = ts.confluence_space_key,
            confluence_username = ts.confluence_username,
            confluence_token = ts.confluence_token,
            filtering_enabled = ts.filtering_enabled,
            filtering_confidence_threshold = ts.filtering_confidence_threshold
        FROM team_settings ts
        WHERE teams.id = ts.team_id
        """
    )

    # 3. Remove server defaults
    op.alter_column("teams", "filtering_enabled", server_default=None)
    op.alter_column("teams", "filtering_confidence_threshold", server_default=None)

    # 4. Drop team_settings table
    op.drop_table("team_settings")
