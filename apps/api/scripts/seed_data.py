"""Seed data script for initial team and members setup.

Run with: uv run python -m scripts.seed_data
"""

import asyncio

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.lib.database import async_session_factory
from src.models import Team, TeamMember

# Team configuration from PRD Interview
TEAM_DATA = {
    "name": "제품기술팀",
    "members": [
        {"name": "이상윤", "presentation_order": 1},
        {"name": "선설희", "presentation_order": 2},
        {"name": "최보연", "presentation_order": 3},
        {"name": "유수화", "presentation_order": 4},
        {"name": "김정연", "presentation_order": 5},
    ],
}


async def seed_team(session: AsyncSession) -> Team:
    """Create or get the team."""
    # Check if team already exists
    result = await session.execute(
        select(Team).where(Team.name == TEAM_DATA["name"])
    )
    existing_team = result.scalar_one_or_none()

    if existing_team:
        print(f"Team '{TEAM_DATA['name']}' already exists with ID: {existing_team.id}")
        return existing_team

    # Create new team
    team = Team(name=TEAM_DATA["name"])
    session.add(team)
    await session.flush()
    print(f"Created team '{team.name}' with ID: {team.id}")
    return team


async def seed_members(session: AsyncSession, team: Team) -> list[TeamMember]:
    """Create team members if they don't exist."""
    members = []

    for member_data in TEAM_DATA["members"]:
        # Check if member already exists
        result = await session.execute(
            select(TeamMember).where(
                TeamMember.team_id == team.id,
                TeamMember.name == member_data["name"],
            )
        )
        existing_member = result.scalar_one_or_none()

        if existing_member:
            print(f"  Member '{member_data['name']}' already exists")
            members.append(existing_member)
            continue

        # Create new member
        member = TeamMember(
            team_id=team.id,
            name=member_data["name"],
            presentation_order=member_data["presentation_order"],
        )
        session.add(member)
        members.append(member)
        print(f"  Created member '{member_data['name']}' (order: {member_data['presentation_order']})")

    return members


async def main() -> None:
    """Run seed data script."""
    print("=" * 50)
    print("WeeklyRun Seed Data Script")
    print("=" * 50)

    async with async_session_factory() as session:
        # Seed team
        team = await seed_team(session)

        # Seed members
        print(f"\nSeeding members for team '{team.name}':")
        await seed_members(session, team)

        # Commit all changes
        await session.commit()
        print("\nSeed data completed successfully!")

    print("=" * 50)


if __name__ == "__main__":
    asyncio.run(main())
