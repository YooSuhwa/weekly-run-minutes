"""Meeting model."""

from datetime import date
from enum import Enum
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import JSON, Date, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.models.base import BaseModel

if TYPE_CHECKING:
    from src.models.recording import Recording
    from src.models.team import Team
    from src.models.transcript import Transcript
    from src.models.weekly_report import WeeklyReport


class MeetingStatus(str, Enum):
    """Meeting status enum."""

    CREATED = "created"  # 회의 생성됨
    WEEKLY_REPORT_LOADED = "weekly_report_loaded"  # 주간업무록 로드됨
    RECORDING_UPLOADED = "recording_uploaded"  # 녹음 파일 업로드됨
    TRANSCRIBING = "transcribing"  # STT 처리 중
    TRANSCRIBED = "transcribed"  # STT 완료
    GENERATING_MINUTES = "generating_minutes"  # 회의록 생성 중
    DRAFT_READY = "draft_ready"  # 회의록 초안 완료
    PUBLISHED = "published"  # Confluence 게시 완료
    FAILED = "failed"  # 처리 실패


class Meeting(BaseModel):
    """Meeting model - 회의 정보."""

    __tablename__ = "meetings"

    team_id: Mapped[UUID] = mapped_column(
        ForeignKey("teams.id", ondelete="CASCADE"),
        nullable=False,
    )
    meeting_date: Mapped[date] = mapped_column(Date, nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    status: Mapped[MeetingStatus] = mapped_column(
        String(50),
        default=MeetingStatus.CREATED,
        nullable=False,
    )
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Confluence info
    confluence_page_id: Mapped[str | None] = mapped_column(String(50), nullable=True)
    confluence_page_url: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # Relationships
    team: Mapped["Team"] = relationship("Team", back_populates="meetings")
    recording: Mapped["Recording | None"] = relationship(
        "Recording",
        back_populates="meeting",
        uselist=False,
        cascade="all, delete-orphan",
    )
    weekly_report: Mapped["WeeklyReport | None"] = relationship(
        "WeeklyReport",
        back_populates="meeting",
        uselist=False,
        cascade="all, delete-orphan",
    )
    transcripts: Mapped[list["Transcript"]] = relationship(
        "Transcript",
        back_populates="meeting",
        cascade="all, delete-orphan",
        order_by="Transcript.start_time",
    )
    minutes: Mapped["MeetingMinutes | None"] = relationship(
        "MeetingMinutes",
        back_populates="meeting",
        uselist=False,
        cascade="all, delete-orphan",
    )


class MeetingMinutes(BaseModel):
    """MeetingMinutes model - AI 생성 회의록."""

    __tablename__ = "meeting_minutes"

    meeting_id: Mapped[UUID] = mapped_column(
        ForeignKey("meetings.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )
    content_markdown: Mapped[str] = mapped_column(Text, nullable=False)

    # AI generation metadata
    ai_model: Mapped[str] = mapped_column(String(50), nullable=False)
    prompt_version: Mapped[str] = mapped_column(String(20), nullable=False)

    # AI corrections list (P1-lite: simple list without position)
    # Structure: [{"original": "...", "corrected": "...", "category": "terminology|formatting|grammar"}]
    corrections: Mapped[list] = mapped_column(JSON, nullable=False, default=list)

    # Edit tracking
    is_edited: Mapped[bool] = mapped_column(default=False, nullable=False)
    edited_content: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Relationships
    meeting: Mapped["Meeting"] = relationship("Meeting", back_populates="minutes")
