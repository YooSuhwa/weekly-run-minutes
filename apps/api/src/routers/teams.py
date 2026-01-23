"""Team API endpoints."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.lib.dependencies import get_db
from src.models import Team, TeamMember
from src.schemas.team import (
    TeamCreate,
    TeamMemberCreate,
    TeamMemberResponse,
    TeamMemberUpdate,
    TeamResponse,
    TeamWithMembers,
)

# Dependency type alias
DB = Annotated[AsyncSession, Depends(get_db)]

router = APIRouter()


@router.get("", response_model=list[TeamResponse])
async def list_teams(
    db: DB,
) -> list[Team]:
    """List all teams."""
    result = await db.execute(select(Team))
    return list(result.scalars().all())


@router.post("", response_model=TeamWithMembers, status_code=status.HTTP_201_CREATED)
async def create_team(
    data: TeamCreate,
    db: DB,
) -> Team:
    """Create a new team with optional members."""
    team = Team(name=data.name)
    db.add(team)
    await db.flush()

    if data.members:
        for member_data in data.members:
            member = TeamMember(
                team_id=team.id,
                name=member_data.name,
                presentation_order=member_data.presentation_order,
            )
            db.add(member)

    await db.commit()
    await db.refresh(team, ["members"])
    return team


@router.get("/{team_id}", response_model=TeamWithMembers)
async def get_team(
    team_id: UUID,
    db: DB,
) -> Team:
    """Get a team by ID with members."""
    result = await db.execute(
        select(Team).where(Team.id == team_id).options(selectinload(Team.members))
    )
    team = result.scalar_one_or_none()
    if not team:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Team not found",
        )
    return team


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
