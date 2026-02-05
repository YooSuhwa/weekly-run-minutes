"""TeamSettings model - team-specific configuration."""

from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.models.base import BaseModel

if TYPE_CHECKING:
    from src.models.team import Team


class TeamSettings(BaseModel):
    """TeamSettings model - 팀별 설정 정보 (Confluence, 필터링 등)."""

    __tablename__ = "team_settings"
    __table_args__ = (UniqueConstraint("team_id", name="uq_team_settings_team_id"),)

    team_id: Mapped[UUID] = mapped_column(
        ForeignKey("teams.id", ondelete="CASCADE"),
        nullable=False,
    )

    # Confluence integration
    confluence_base_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    confluence_space_key: Mapped[str | None] = mapped_column(String(50), nullable=True)
    confluence_username: Mapped[str | None] = mapped_column(String(100), nullable=True)
    confluence_token: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # Chat filtering settings (P2)
    filtering_enabled: Mapped[bool] = mapped_column(default=True, nullable=False)
    filtering_confidence_threshold: Mapped[float] = mapped_column(
        default=0.7, nullable=False
    )

    # Relationships
    team: Mapped["Team"] = relationship("Team", back_populates="settings")
