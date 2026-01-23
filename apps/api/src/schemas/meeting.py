"""Meeting schemas."""

from datetime import date, datetime
from uuid import UUID

from pydantic import Field

from src.models.meeting import MeetingStatus
from src.schemas.common import BaseSchema, IDSchema, TimestampSchema


class MeetingCreate(BaseSchema):
    """Schema for creating a meeting."""

    team_id: UUID
    meeting_date: date
    title: str = Field(..., min_length=1, max_length=200)


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
    error_message: str | None
    confluence_page_id: str | None
    confluence_page_url: str | None


class MeetingWithDetails(MeetingResponse):
    """Schema for meeting with all related data."""

    recording: RecordingInfo | None
    weekly_report: WeeklyReportInfo | None
    minutes: MeetingMinutesInfo | None
