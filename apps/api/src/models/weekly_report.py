"""WeeklyReport model for Confluence weekly reports."""

from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import JSON, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.models.base import BaseModel

if TYPE_CHECKING:
    from src.models.meeting import Meeting


class WeeklyReport(BaseModel):
    """WeeklyReport model - 주간업무록 (Confluence에서 파싱한 데이터)."""

    __tablename__ = "weekly_reports"

    meeting_id: Mapped[UUID] = mapped_column(
        ForeignKey("meetings.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )

    # Confluence source info
    confluence_page_id: Mapped[str] = mapped_column(String(50), nullable=False)
    confluence_page_url: Mapped[str] = mapped_column(String(500), nullable=False)

    # Raw HTML content from Confluence
    raw_html: Mapped[str] = mapped_column(Text, nullable=False)

    # Parsed structured data
    # Structure: {
    #   "team_members": [
    #     {
    #       "name": "이상윤",
    #       "categories": [
    #         {
    #           "name": "프로젝트A",
    #           "tasks": [
    #             {
    #               "status": "완료" | "진행" | "예정",
    #               "title": "작업 제목",
    #               "details": ["상세 내용 1", "상세 내용 2"]
    #             }
    #           ]
    #         }
    #       ]
    #     }
    #   ]
    # }
    parsed_data: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)

    # Relationships
    meeting: Mapped["Meeting"] = relationship("Meeting", back_populates="weekly_report")
