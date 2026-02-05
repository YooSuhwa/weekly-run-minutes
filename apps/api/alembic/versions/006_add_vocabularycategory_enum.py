"""Add vocabularycategory enum type.

Convert vocabularies.category from VARCHAR to native PostgreSQL ENUM.

Revision ID: 006
Revises: 1597d3b78094
Create Date: 2026-02-05

"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "006"
down_revision: str = "1597d3b78094"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# Define the ENUM type
vocabularycategory = postgresql.ENUM(
    "terminology",
    "abbreviation",
    "name",
    "other",
    name="vocabularycategory",
)


def upgrade() -> None:
    # Create the ENUM type
    vocabularycategory.create(op.get_bind(), checkfirst=True)

    # First, drop the server default (can't convert with default)
    op.alter_column(
        "vocabularies",
        "category",
        server_default=None,
    )

    # Convert the column from VARCHAR to ENUM
    op.alter_column(
        "vocabularies",
        "category",
        existing_type=sa.String(50),
        type_=vocabularycategory,
        existing_nullable=False,
        postgresql_using="category::vocabularycategory",
    )

    # Set the new default using enum type
    op.alter_column(
        "vocabularies",
        "category",
        server_default=sa.text("'terminology'::vocabularycategory"),
    )


def downgrade() -> None:
    # Drop the enum default first
    op.alter_column(
        "vocabularies",
        "category",
        server_default=None,
    )

    # Convert back to VARCHAR
    op.alter_column(
        "vocabularies",
        "category",
        existing_type=vocabularycategory,
        type_=sa.String(50),
        existing_nullable=False,
        postgresql_using="category::text",
    )

    # Restore VARCHAR default
    op.alter_column(
        "vocabularies",
        "category",
        server_default=sa.text("'terminology'"),
    )

    # Drop the ENUM type
    vocabularycategory.drop(op.get_bind(), checkfirst=True)
