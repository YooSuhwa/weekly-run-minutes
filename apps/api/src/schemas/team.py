"""Team and TeamMember schemas."""

from uuid import UUID

from pydantic import Field

from src.schemas.common import BaseSchema, IDSchema, TimestampSchema


class TeamMemberCreate(BaseSchema):
    """Schema for creating a team member."""

    name: str = Field(..., min_length=1, max_length=50)
    presentation_order: int = Field(..., ge=1)


class TeamMemberUpdate(BaseSchema):
    """Schema for updating a team member."""

    name: str | None = Field(None, min_length=1, max_length=50)
    presentation_order: int | None = Field(None, ge=1)
    is_active: bool | None = None


class TeamMemberResponse(IDSchema, TimestampSchema):
    """Schema for team member response."""

    team_id: UUID
    name: str
    presentation_order: int
    is_active: bool


class TeamCreate(BaseSchema):
    """Schema for creating a team."""

    name: str = Field(..., min_length=1, max_length=100)
    members: list[TeamMemberCreate] | None = None


class TeamResponse(IDSchema, TimestampSchema):
    """Schema for team response."""

    name: str


class TeamWithMembers(TeamResponse):
    """Schema for team with members."""

    members: list[TeamMemberResponse]
