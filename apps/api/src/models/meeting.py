"""Meeting model."""

from datetime import date
from enum import Enum
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import JSON, Date, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.models.base import BaseModel

if TYPE_CHECKING:
    from src.models.filtered_content import FilteredContent
    from src.models.recording import Recording
    from src.models.team import Team
    from src.models.transcript import Transcript
    from src.models.weekly_report import WeeklyReport


class MeetingMode(str, Enum):
    """Meeting mode enum."""

    UPLOAD = "upload"  # P1-lite: 파일 업로드 모드
    REALTIME = "realtime"  # P1-full: 실시간 회의 모드


class MeetingType(str, Enum):
    """Meeting type enum - P2 feature."""

    WEEKLY_REPORT = "weekly_report"  # 주간회의 - 주간업무록 기반
    GENERAL = "general"  # 일반 회의 - 자유 형식


class MeetingStatus(str, Enum):
    """Meeting status enum."""

    CREATED = "created"  # 회의 생성됨
    WEEKLY_REPORT_LOADED = "weekly_report_loaded"  # 주간업무록 로드됨
    PREPARING = "preparing"  # 실시간 회의 준비 중 (P1-full)
    IN_PROGRESS = "in_progress"  # 실시간 회의 진행 중 (P1-full)
    RECORDING_DONE = "recording_done"  # 실시간 녹음 완료 (P1-full)
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
    location: Mapped[str | None] = mapped_column(String(200), nullable=True)
    status: Mapped[MeetingStatus] = mapped_column(
        String(50),
        default=MeetingStatus.CREATED,
        nullable=False,
    )
    meeting_mode: Mapped[str] = mapped_column(
        String(20),
        default=MeetingMode.UPLOAD,
        nullable=False,
    )
    # P2: Meeting type - weekly report based or general free-form
    meeting_type: Mapped[str] = mapped_column(
        String(20),
        default=MeetingType.WEEKLY_REPORT,
        nullable=False,
    )
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)

    # P2: Agenda items for general meetings (optional)
    # Structure: [{"title": "...", "description": "...", "presenter": "...", "duration_minutes": 10}]
    agenda_items: Mapped[list | None] = mapped_column(JSON, nullable=True)

    # Session-level context terms for STT and minutes generation
    # Simple list of keywords: ["Phoenix", "Sprint 15", "JIRA-1234"]
    context_terms: Mapped[list | None] = mapped_column(JSON, nullable=True)

    # Session-level natural language instructions for AI processing
    # Example: "OOO 이름이 나오는 얘기는 다 빼줘"
    context_instructions: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Selected attendees for this meeting (subset of team members)
    # If None, all active team members are considered attendees
    # Structure: ["홍길동", "김철수", ...]
    attendees: Mapped[list | None] = mapped_column(JSON, nullable=True)

    # Realtime orchestration state (P1-full)
    current_speaker_index: Mapped[int | None] = mapped_column(Integer, nullable=True)
    current_item_index: Mapped[int | None] = mapped_column(Integer, nullable=True)
    question_tree_data: Mapped[dict | None] = mapped_column(JSON, nullable=True)

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
    filtered_contents: Mapped[list["FilteredContent"]] = relationship(
        "FilteredContent",
        back_populates="meeting",
        cascade="all, delete-orphan",
        order_by="FilteredContent.start_time",
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

    # AI corrections list with position tracking for inline highlighting
    # Structure: [{"original": "...", "corrected": "...", "category": "terminology|formatting|grammar",
    #              "paragraph_index": 0, "start_offset": 10, "end_offset": 20}]
    corrections: Mapped[list] = mapped_column(JSON, nullable=False, default=list)

    # Edit tracking
    is_edited: Mapped[bool] = mapped_column(default=False, nullable=False)
    edited_content: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Confluence sync tracking
    confluence_synced: Mapped[bool] = mapped_column(default=False, nullable=False)

    # Relationships
    meeting: Mapped["Meeting"] = relationship("Meeting", back_populates="minutes")
