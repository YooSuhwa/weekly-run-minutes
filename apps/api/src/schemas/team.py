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
    password: str | None = Field(None, min_length=4, max_length=128)
    confluence_base_url: str | None = Field(None, max_length=500)
    confluence_space_key: str | None = Field(None, max_length=50)
    members: list[TeamMemberCreate] | None = None


class TeamUpdate(BaseSchema):
    """Schema for updating a team."""

    name: str | None = Field(None, min_length=1, max_length=100)
    password: str | None = Field(None, min_length=4, max_length=128)
    confluence_base_url: str | None = Field(None, max_length=500)
    confluence_space_key: str | None = Field(None, max_length=50)


class TeamResponse(IDSchema, TimestampSchema):
    """Schema for team response (list view - no sensitive data)."""

    name: str


class TeamDetailResponse(TeamResponse):
    """Schema for team detail response (includes Confluence config)."""

    confluence_base_url: str | None = None
    confluence_space_key: str | None = None
    has_password: bool = False


class TeamWithMembers(TeamDetailResponse):
    """Schema for team with members."""

    members: list[TeamMemberResponse]


class TeamAuthRequest(BaseSchema):
    """Schema for team authentication request."""

    password: str = Field(..., min_length=1)


class TeamAuthResponse(BaseSchema):
    """Schema for team authentication response."""

    team_id: UUID
    team_name: str
