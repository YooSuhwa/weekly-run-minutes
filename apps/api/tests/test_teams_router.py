"""Tests for teams API endpoints."""

import pytest
from httpx import AsyncClient


class TestListTeams:
    @pytest.mark.asyncio
    async def test_empty_list(self, client: AsyncClient):
        response = await client.get("/api/v1/teams")
        assert response.status_code == 200
        assert response.json() == []

    @pytest.mark.asyncio
    async def test_list_with_teams(self, client: AsyncClient):
        # Create a team first
        await client.post("/api/v1/teams", json={"name": "제품기술팀"})
        response = await client.get("/api/v1/teams")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["name"] == "제품기술팀"


class TestCreateTeam:
    @pytest.mark.asyncio
    async def test_create_team_without_members(self, client: AsyncClient):
        response = await client.post("/api/v1/teams", json={"name": "제품기술팀"})
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "제품기술팀"
        assert data["members"] == []
        assert "id" in data
        assert "created_at" in data

    @pytest.mark.asyncio
    async def test_create_team_with_members(self, client: AsyncClient):
        response = await client.post(
            "/api/v1/teams",
            json={
                "name": "제품기술팀",
                "members": [
                    {"name": "이상윤", "presentation_order": 1},
                    {"name": "선설희", "presentation_order": 2},
                ],
            },
        )
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "제품기술팀"
        assert len(data["members"]) == 2
        assert data["members"][0]["name"] == "이상윤"
        assert data["members"][1]["name"] == "선설희"

    @pytest.mark.asyncio
    async def test_create_team_empty_name(self, client: AsyncClient):
        response = await client.post("/api/v1/teams", json={"name": ""})
        assert response.status_code == 422


class TestGetTeam:
    @pytest.mark.asyncio
    async def test_get_existing_team(self, client: AsyncClient):
        create_response = await client.post("/api/v1/teams", json={"name": "팀A"})
        team_id = create_response.json()["id"]

        response = await client.get(f"/api/v1/teams/{team_id}")
        assert response.status_code == 200
        assert response.json()["name"] == "팀A"

    @pytest.mark.asyncio
    async def test_get_nonexistent_team(self, client: AsyncClient):
        response = await client.get("/api/v1/teams/00000000-0000-0000-0000-000000000000")
        assert response.status_code == 404


class TestDeleteTeam:
    @pytest.mark.asyncio
    async def test_delete_existing_team(self, client: AsyncClient):
        create_response = await client.post("/api/v1/teams", json={"name": "삭제팀"})
        team_id = create_response.json()["id"]

        response = await client.delete(f"/api/v1/teams/{team_id}")
        assert response.status_code == 204

        # Verify deleted
        get_response = await client.get(f"/api/v1/teams/{team_id}")
        assert get_response.status_code == 404

    @pytest.mark.asyncio
    async def test_delete_nonexistent_team(self, client: AsyncClient):
        response = await client.delete("/api/v1/teams/00000000-0000-0000-0000-000000000000")
        assert response.status_code == 404


class TestListTeamMembers:
    @pytest.mark.asyncio
    async def test_list_members(self, client: AsyncClient):
        create_response = await client.post(
            "/api/v1/teams",
            json={
                "name": "팀",
                "members": [
                    {"name": "A", "presentation_order": 1},
                    {"name": "B", "presentation_order": 2},
                ],
            },
        )
        team_id = create_response.json()["id"]

        response = await client.get(f"/api/v1/teams/{team_id}/members")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2
        assert data[0]["presentation_order"] <= data[1]["presentation_order"]


class TestAddTeamMember:
    @pytest.mark.asyncio
    async def test_add_member_success(self, client: AsyncClient):
        create_response = await client.post("/api/v1/teams", json={"name": "팀"})
        team_id = create_response.json()["id"]

        response = await client.post(
            f"/api/v1/teams/{team_id}/members",
            json={"name": "김정연", "presentation_order": 1},
        )
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "김정연"
        assert data["is_active"] is True

    @pytest.mark.asyncio
    async def test_add_member_to_nonexistent_team(self, client: AsyncClient):
        response = await client.post(
            "/api/v1/teams/00000000-0000-0000-0000-000000000000/members",
            json={"name": "새멤버", "presentation_order": 1},
        )
        assert response.status_code == 404


class TestUpdateTeamMember:
    @pytest.mark.asyncio
    async def test_update_name(self, client: AsyncClient):
        # Create team with member
        create_response = await client.post(
            "/api/v1/teams",
            json={"name": "팀", "members": [{"name": "원래이름", "presentation_order": 1}]},
        )
        team_id = create_response.json()["id"]
        member_id = create_response.json()["members"][0]["id"]

        response = await client.patch(
            f"/api/v1/teams/{team_id}/members/{member_id}",
            json={"name": "새이름"},
        )
        assert response.status_code == 200
        assert response.json()["name"] == "새이름"

    @pytest.mark.asyncio
    async def test_update_nonexistent_member(self, client: AsyncClient):
        create_response = await client.post("/api/v1/teams", json={"name": "팀"})
        team_id = create_response.json()["id"]

        response = await client.patch(
            f"/api/v1/teams/{team_id}/members/00000000-0000-0000-0000-000000000000",
            json={"name": "test"},
        )
        assert response.status_code == 404


class TestRemoveTeamMember:
    @pytest.mark.asyncio
    async def test_remove_member(self, client: AsyncClient):
        create_response = await client.post(
            "/api/v1/teams",
            json={"name": "팀", "members": [{"name": "삭제멤버", "presentation_order": 1}]},
        )
        team_id = create_response.json()["id"]
        member_id = create_response.json()["members"][0]["id"]

        response = await client.delete(f"/api/v1/teams/{team_id}/members/{member_id}")
        assert response.status_code == 204

    @pytest.mark.asyncio
    async def test_remove_nonexistent_member(self, client: AsyncClient):
        create_response = await client.post("/api/v1/teams", json={"name": "팀"})
        team_id = create_response.json()["id"]

        response = await client.delete(
            f"/api/v1/teams/{team_id}/members/00000000-0000-0000-0000-000000000000"
        )
        assert response.status_code == 404


class TestReorderTeamMembers:
    @pytest.mark.asyncio
    async def test_reorder_success(self, client: AsyncClient):
        create_response = await client.post(
            "/api/v1/teams",
            json={
                "name": "팀",
                "members": [
                    {"name": "A", "presentation_order": 1},
                    {"name": "B", "presentation_order": 2},
                    {"name": "C", "presentation_order": 3},
                ],
            },
        )
        team_id = create_response.json()["id"]
        members = create_response.json()["members"]
        # Reverse order
        reversed_ids = [members[2]["id"], members[1]["id"], members[0]["id"]]

        response = await client.post(
            f"/api/v1/teams/{team_id}/members/reorder",
            json=reversed_ids,
        )
        assert response.status_code == 200
        data = response.json()
        assert data[0]["name"] == "C"
        assert data[0]["presentation_order"] == 1

    @pytest.mark.asyncio
    async def test_reorder_invalid_member_id(self, client: AsyncClient):
        create_response = await client.post(
            "/api/v1/teams",
            json={"name": "팀", "members": [{"name": "A", "presentation_order": 1}]},
        )
        team_id = create_response.json()["id"]

        response = await client.post(
            f"/api/v1/teams/{team_id}/members/reorder",
            json=["00000000-0000-0000-0000-000000000000"],
        )
        assert response.status_code == 400
