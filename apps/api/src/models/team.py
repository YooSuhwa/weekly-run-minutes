"""Team and TeamMember models."""

from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.models.base import BaseModel

if TYPE_CHECKING:
    from src.models.meeting import Meeting
    from src.models.vocabulary import Vocabulary


class Team(BaseModel):
    """Team model - 팀 정보."""

    __tablename__ = "teams"

    name: Mapped[str] = mapped_column(String(100), nullable=False)
    password_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Confluence integration
    confluence_base_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    confluence_space_key: Mapped[str | None] = mapped_column(String(50), nullable=True)

    # Relationships
    members: Mapped[list["TeamMember"]] = relationship(
        "TeamMember",
        back_populates="team",
        cascade="all, delete-orphan",
        order_by="TeamMember.presentation_order",
    )
    meetings: Mapped[list["Meeting"]] = relationship(
        "Meeting",
        back_populates="team",
        cascade="all, delete-orphan",
    )
    vocabularies: Mapped[list["Vocabulary"]] = relationship(
        "Vocabulary",
        back_populates="team",
        cascade="all, delete-orphan",
    )


class TeamMember(BaseModel):
    """TeamMember model - 팀원 정보."""

    __tablename__ = "team_members"

    team_id: Mapped[UUID] = mapped_column(
        ForeignKey("teams.id", ondelete="CASCADE"),
        nullable=False,
    )
    name: Mapped[str] = mapped_column(String(50), nullable=False)
    presentation_order: Mapped[int] = mapped_column(nullable=False)
    is_active: Mapped[bool] = mapped_column(default=True, nullable=False)

    # Relationships
    team: Mapped["Team"] = relationship("Team", back_populates="members")
