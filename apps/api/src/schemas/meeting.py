"""Meeting schemas."""

from datetime import date, datetime
from uuid import UUID

from pydantic import Field

from src.models.meeting import MeetingMode, MeetingStatus, MeetingType
from src.schemas.common import BaseSchema, IDSchema, TimestampSchema


class AgendaItem(BaseSchema):
    """Schema for a single agenda item in general meetings."""

    title: str = Field(..., min_length=1, max_length=200)
    description: str | None = Field(None, max_length=1000)
    presenter: str | None = Field(None, max_length=100)
    duration_minutes: int | None = Field(None, ge=1, le=480)


class MeetingCreate(BaseSchema):
    """Schema for creating a meeting."""

    team_id: UUID
    meeting_date: date
    title: str = Field(..., min_length=1, max_length=200)
    meeting_mode: MeetingMode = MeetingMode.UPLOAD
    meeting_type: MeetingType = MeetingType.WEEKLY_REPORT
    agenda_items: list[AgendaItem] | None = None


class MeetingUpdate(BaseSchema):
    """Schema for updating a meeting."""

    title: str | None = Field(None, min_length=1, max_length=200)
    meeting_date: date | None = None
    agenda_items: list[AgendaItem] | None = None


class MeetingStatusUpdate(BaseSchema):
    """Schema for updating meeting status."""

    status: MeetingStatus
    error_message: str | None = None


class RecordingInfo(BaseSchema):
    """Schema for recording info in meeting response."""

    id: UUID
    original_filename: str
    file_size: int
    duration_seconds: float | None


class WeeklyReportInfo(BaseSchema):
    """Schema for weekly report info in meeting response."""

    id: UUID
    confluence_page_id: str
    confluence_page_url: str


class MeetingMinutesInfo(BaseSchema):
    """Schema for meeting minutes info in meeting response."""

    id: UUID
    ai_model: str
    is_edited: bool
    created_at: datetime


class MeetingResponse(IDSchema, TimestampSchema):
    """Schema for meeting response."""

    team_id: UUID
    meeting_date: date
    title: str
    status: MeetingStatus
    meeting_mode: str
    meeting_type: str
    error_message: str | None
    confluence_page_id: str | None
    confluence_page_url: str | None
    agenda_items: list[AgendaItem] | None


class MeetingWithDetails(MeetingResponse):
    """Schema for meeting with all related data."""

    recording: RecordingInfo | None
    weekly_report: WeeklyReportInfo | None
    minutes: MeetingMinutesInfo | None
