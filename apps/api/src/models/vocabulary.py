"""Vocabulary model for team-specific terminology."""

from enum import StrEnum
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.models.base import BaseModel

if TYPE_CHECKING:
    from src.models.team import Team


class VocabularyCategory(StrEnum):
    """Category of vocabulary term."""

    TERMINOLOGY = "terminology"
    ABBREVIATION = "abbreviation"
    NAME = "name"
    OTHER = "other"


class Vocabulary(BaseModel):
    """Vocabulary model - Team-specific terminology dictionary.

    Stores terms and their corrections for AI-based meeting minutes correction.
    """

    __tablename__ = "vocabularies"
    __table_args__ = (
        UniqueConstraint("team_id", "term", name="uq_team_term"),
    )

    team_id: Mapped[UUID] = mapped_column(
        ForeignKey("teams.id", ondelete="CASCADE"),
        nullable=False,
    )
    term: Mapped[str] = mapped_column(String(200), nullable=False)
    correction: Mapped[str] = mapped_column(String(200), nullable=False)
    category: Mapped[VocabularyCategory] = mapped_column(
        default=VocabularyCategory.TERMINOLOGY,
        nullable=False,
    )

    # Relationships
    team: Mapped["Team"] = relationship("Team", back_populates="vocabularies")
