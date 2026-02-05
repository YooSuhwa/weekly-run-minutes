"""Team API endpoints."""

from typing import Annotated
from uuid import UUID

import bcrypt
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.lib.dependencies import get_db
from src.models import Team, TeamMember, TeamSettings
from src.schemas.team import (
    TeamAuthRequest,
    TeamAuthResponse,
    TeamCreate,
    TeamMemberCreate,
    TeamMemberResponse,
    TeamMemberUpdate,
    TeamResponse,
    TeamUpdate,
    TeamWithMembers,
)

# Dependency type alias
DB = Annotated[AsyncSession, Depends(get_db)]

router = APIRouter()


def hash_password(password: str) -> str:
    """Hash a password using bcrypt.

    Note: bcrypt has a 72-byte limit. We truncate to 72 bytes to avoid errors
    while still providing strong security (72 bytes is plenty for password security).
    """
    # Encode to UTF-8 and truncate to 72 bytes (bcrypt limit)
    password_bytes = password.encode("utf-8")[:72]
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password_bytes, salt)
    return hashed.decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against a hash."""
    # Apply same truncation as hash_password
    password_bytes = plain_password.encode("utf-8")[:72]
    hashed_bytes = hashed_password.encode("utf-8")
    return bcrypt.checkpw(password_bytes, hashed_bytes)


def _build_team_response(team: Team) -> TeamWithMembers:
    """Build TeamWithMembers response from Team model.

    Flattens settings fields into the response for API compatibility.
    """
    settings = team.settings
    return TeamWithMembers(
        id=team.id,
        name=team.name,
        confluence_base_url=settings.confluence_base_url if settings else None,
        confluence_space_key=settings.confluence_space_key if settings else None,
        confluence_username=settings.confluence_username if settings else None,
        has_confluence_token=(settings.confluence_token is not None) if settings else False,
        has_password=team.password_hash is not None,
        filtering_enabled=settings.filtering_enabled if settings else True,
        filtering_confidence_threshold=settings.filtering_confidence_threshold if settings else 0.7,
        created_at=team.created_at,
        updated_at=team.updated_at,
        members=[
            TeamMemberResponse(
                id=m.id,
                team_id=m.team_id,
                name=m.name,
                presentation_order=m.presentation_order,
                is_active=m.is_active,
                created_at=m.created_at,
                updated_at=m.updated_at,
            )
            for m in team.members
        ],
    )


@router.get("", response_model=list[TeamResponse])
async def list_teams(
    db: DB,
) -> list[TeamResponse]:
    """List all teams (names only, no passwords or sensitive data)."""
    result = await db.execute(select(Team))
    teams = result.scalars().all()
    return [
        TeamResponse(
            id=team.id,
            name=team.name,
            has_password=team.password_hash is not None,
            created_at=team.created_at,
            updated_at=team.updated_at,
        )
        for team in teams
    ]


@router.post("", response_model=TeamWithMembers, status_code=status.HTTP_201_CREATED)
async def create_team(
    data: TeamCreate,
    db: DB,
) -> TeamWithMembers:
    """Create a new team with optional password and members."""
    # Create team with auth info only
    team = Team(
        name=data.name,
        password_hash=hash_password(data.password) if data.password else None,
    )
    db.add(team)
    await db.flush()

    # Create team settings
    settings = TeamSettings(
        team_id=team.id,
        confluence_base_url=data.confluence_base_url,
        confluence_space_key=data.confluence_space_key,
        confluence_username=data.confluence_username,
        confluence_token=data.confluence_token,
        filtering_enabled=data.filtering_enabled,
        filtering_confidence_threshold=data.filtering_confidence_threshold,
    )
    db.add(settings)

    # Create team members
    if data.members:
        for member_data in data.members:
            member = TeamMember(
                team_id=team.id,
                name=member_data.name,
                presentation_order=member_data.presentation_order,
            )
            db.add(member)

    await db.commit()
    await db.refresh(team, ["members", "settings"])

    return _build_team_response(team)


@router.get("/{team_id}", response_model=TeamWithMembers)
async def get_team(
    team_id: UUID,
    db: DB,
) -> TeamWithMembers:
    """Get a team by ID with members."""
    # settings is lazy="joined", so it loads automatically
    result = await db.execute(
        select(Team).where(Team.id == team_id).options(selectinload(Team.members))
    )
    team = result.scalar_one_or_none()
    if not team:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Team not found",
        )

    return _build_team_response(team)


@router.put("/{team_id}", response_model=TeamWithMembers)
async def update_team(
    team_id: UUID,
    data: TeamUpdate,
    db: DB,
) -> TeamWithMembers:
    """Update a team."""
    # settings is lazy="joined", so it loads automatically
    result = await db.execute(select(Team).where(Team.id == team_id))
    team = result.scalar_one_or_none()
    if not team:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Team not found",
        )

    update_data = data.model_dump(exclude_unset=True)

    # Handle password separately
    if "password" in update_data:
        password = update_data.pop("password")
        if password:
            team.password_hash = hash_password(password)
        # If password is explicitly None, keep existing password

    # Settings fields to update on team.settings
    settings_fields = {
        "confluence_base_url",
        "confluence_space_key",
        "confluence_username",
        "confluence_token",
        "filtering_enabled",
        "filtering_confidence_threshold",
    }

    # Ensure team has settings (create if missing for backwards compatibility)
    if team.settings is None:
        team.settings = TeamSettings(team_id=team.id)
        db.add(team.settings)

    # Update settings fields
    for field in settings_fields:
        if field in update_data:
            setattr(team.settings, field, update_data.pop(field))

    # Update team fields (only 'name' remains)
    for field, value in update_data.items():
        setattr(team, field, value)

    await db.commit()

    # Re-fetch team with members to ensure fresh data
    result = await db.execute(
        select(Team).where(Team.id == team_id).options(selectinload(Team.members))
    )
    updated_team = result.scalar_one()  # Safe: we know team exists after update

    return _build_team_response(updated_team)


@router.delete("/{team_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_team(
    team_id: UUID,
    db: DB,
) -> None:
    """Delete a team."""
    result = await db.execute(select(Team).where(Team.id == team_id))
    team = result.scalar_one_or_none()
    if not team:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Team not found",
        )
    await db.delete(team)
    await db.commit()


@router.post("/{team_id}/auth", response_model=TeamAuthResponse)
async def authenticate_team(
    team_id: UUID,
    data: TeamAuthRequest,
    db: DB,
) -> TeamAuthResponse:
    """Authenticate with team password. Returns team_id on success."""
    result = await db.execute(select(Team).where(Team.id == team_id))
    team = result.scalar_one_or_none()
    if not team:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Team not found",
        )

    # If team has no password, auth always fails
    if not team.password_hash:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Team has no password set",
        )

    # Verify password
    if not verify_password(data.password, team.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid password",
        )

    return TeamAuthResponse(team_id=team.id, team_name=team.name)


# Team Member endpoints


@router.get("/{team_id}/members", response_model=list[TeamMemberResponse])
async def list_team_members(
    team_id: UUID,
    db: DB,
) -> list[TeamMember]:
    """List all members of a team."""
    result = await db.execute(
        select(TeamMember)
        .where(TeamMember.team_id == team_id)
        .order_by(TeamMember.presentation_order)
    )
    return list(result.scalars().all())


@router.post(
    "/{team_id}/members",
    response_model=TeamMemberResponse,
    status_code=status.HTTP_201_CREATED,
)
async def add_team_member(
    team_id: UUID,
    data: TeamMemberCreate,
    db: DB,
) -> TeamMember:
    """Add a member to a team."""
    # Verify team exists
    team_result = await db.execute(select(Team).where(Team.id == team_id))
    if not team_result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Team not found",
        )

    member = TeamMember(
        team_id=team_id,
        name=data.name,
        presentation_order=data.presentation_order,
    )
    db.add(member)
    await db.commit()
    await db.refresh(member)
    return member


@router.patch("/{team_id}/members/{member_id}", response_model=TeamMemberResponse)
async def update_team_member(
    team_id: UUID,
    member_id: UUID,
    data: TeamMemberUpdate,
    db: DB,
) -> TeamMember:
    """Update a team member."""
    result = await db.execute(
        select(TeamMember).where(
            TeamMember.id == member_id,
            TeamMember.team_id == team_id,
        )
    )
    member = result.scalar_one_or_none()
    if not member:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Team member not found",
        )

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(member, field, value)

    await db.commit()
    await db.refresh(member)
    return member


@router.delete(
    "/{team_id}/members/{member_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def remove_team_member(
    team_id: UUID,
    member_id: UUID,
    db: DB,
) -> None:
    """Remove a member from a team."""
    result = await db.execute(
        select(TeamMember).where(
            TeamMember.id == member_id,
            TeamMember.team_id == team_id,
        )
    )
    member = result.scalar_one_or_none()
    if not member:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Team member not found",
        )
    await db.delete(member)
    await db.commit()


@router.post("/{team_id}/members/reorder", response_model=list[TeamMemberResponse])
async def reorder_team_members(
    team_id: UUID,
    member_ids: list[UUID],
    db: DB,
) -> list[TeamMember]:
    """Reorder team members by providing ordered list of member IDs."""
    # Fetch all members
    result = await db.execute(
        select(TeamMember)
        .where(TeamMember.team_id == team_id)
        .order_by(TeamMember.presentation_order)
    )
    members = {str(m.id): m for m in result.scalars().all()}

    # Validate all IDs exist
    for idx, member_id in enumerate(member_ids):
        if str(member_id) not in members:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Member {member_id} not found in team",
            )
        members[str(member_id)].presentation_order = idx + 1

    await db.commit()

    # Return updated order
    result = await db.execute(
        select(TeamMember)
        .where(TeamMember.team_id == team_id)
        .order_by(TeamMember.presentation_order)
    )
    return list(result.scalars().all())
