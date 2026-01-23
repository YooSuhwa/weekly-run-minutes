"""Pydantic schemas package."""

from src.schemas.common import PaginatedResponse
from src.schemas.meeting import (
    MeetingCreate,
    MeetingResponse,
    MeetingStatusUpdate,
    MeetingWithDetails,
)
from src.schemas.team import (
    TeamCreate,
    TeamMemberCreate,
    TeamMemberResponse,
    TeamMemberUpdate,
    TeamResponse,
    TeamWithMembers,
)

__all__ = [
    "MeetingCreate",
    "MeetingResponse",
    "MeetingStatusUpdate",
    "MeetingWithDetails",
    "PaginatedResponse",
    "TeamCreate",
    "TeamMemberCreate",
    "TeamMemberResponse",
    "TeamMemberUpdate",
    "TeamResponse",
    "TeamWithMembers",
]
