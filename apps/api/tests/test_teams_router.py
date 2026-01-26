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

    @pytest.mark.asyncio
    async def test_list_does_not_expose_password(self, client: AsyncClient):
        """Ensure list endpoint doesn't expose password-related data."""
        await client.post(
            "/api/v1/teams",
            json={"name": "팀", "password": "secret1234"},
        )
        response = await client.get("/api/v1/teams")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        # password_hash should not be in response
        assert "password_hash" not in data[0]
        assert "password" not in data[0]


class TestCreateTeam:
    @pytest.mark.asyncio
    async def test_create_team_without_members(self, client: AsyncClient):
        response = await client.post("/api/v1/teams", json={"name": "제품기술팀"})
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "제품기술팀"
        assert data["members"] == []
        assert data["has_password"] is False
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
    async def test_create_team_with_password(self, client: AsyncClient):
        response = await client.post(
            "/api/v1/teams",
            json={"name": "보안팀", "password": "secret1234"},
        )
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "보안팀"
        assert data["has_password"] is True
        # password_hash should not be exposed
        assert "password_hash" not in data
        assert "password" not in data

    @pytest.mark.asyncio
    async def test_create_team_with_confluence_config(self, client: AsyncClient):
        response = await client.post(
            "/api/v1/teams",
            json={
                "name": "개발팀",
                "confluence_base_url": "https://wiki.example.com",
                "confluence_space_key": "DEV",
            },
        )
        assert response.status_code == 201
        data = response.json()
        assert data["confluence_base_url"] == "https://wiki.example.com"
        assert data["confluence_space_key"] == "DEV"

    @pytest.mark.asyncio
    async def test_create_team_empty_name(self, client: AsyncClient):
        response = await client.post("/api/v1/teams", json={"name": ""})
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_create_team_short_password(self, client: AsyncClient):
        response = await client.post(
            "/api/v1/teams",
            json={"name": "팀", "password": "abc"},  # < 4 chars
        )
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
    async def test_get_team_includes_has_password(self, client: AsyncClient):
        create_response = await client.post(
            "/api/v1/teams",
            json={"name": "보안팀", "password": "secret1234"},
        )
        team_id = create_response.json()["id"]

        response = await client.get(f"/api/v1/teams/{team_id}")
        assert response.status_code == 200
        data = response.json()
        assert data["has_password"] is True
        assert "password_hash" not in data

    @pytest.mark.asyncio
    async def test_get_team_includes_confluence_config(self, client: AsyncClient):
        create_response = await client.post(
            "/api/v1/teams",
            json={
                "name": "개발팀",
                "confluence_base_url": "https://wiki.test.com",
                "confluence_space_key": "TEST",
            },
        )
        team_id = create_response.json()["id"]

        response = await client.get(f"/api/v1/teams/{team_id}")
        assert response.status_code == 200
        data = response.json()
        assert data["confluence_base_url"] == "https://wiki.test.com"
        assert data["confluence_space_key"] == "TEST"

    @pytest.mark.asyncio
    async def test_get_nonexistent_team(self, client: AsyncClient):
        response = await client.get("/api/v1/teams/00000000-0000-0000-0000-000000000000")
        assert response.status_code == 404


class TestUpdateTeam:
    @pytest.mark.asyncio
    async def test_update_team_name(self, client: AsyncClient):
        create_response = await client.post("/api/v1/teams", json={"name": "원래이름"})
        team_id = create_response.json()["id"]

        response = await client.put(
            f"/api/v1/teams/{team_id}",
            json={"name": "새이름"},
        )
        assert response.status_code == 200
        assert response.json()["name"] == "새이름"

    @pytest.mark.asyncio
    async def test_update_team_password(self, client: AsyncClient):
        create_response = await client.post("/api/v1/teams", json={"name": "팀"})
        team_id = create_response.json()["id"]
        assert create_response.json()["has_password"] is False

        # Set password
        response = await client.put(
            f"/api/v1/teams/{team_id}",
            json={"password": "newpassword"},
        )
        assert response.status_code == 200
        assert response.json()["has_password"] is True

    @pytest.mark.asyncio
    async def test_update_team_confluence_config(self, client: AsyncClient):
        create_response = await client.post("/api/v1/teams", json={"name": "팀"})
        team_id = create_response.json()["id"]

        response = await client.put(
            f"/api/v1/teams/{team_id}",
            json={
                "confluence_base_url": "https://new.wiki.com",
                "confluence_space_key": "NEW",
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["confluence_base_url"] == "https://new.wiki.com"
        assert data["confluence_space_key"] == "NEW"

    @pytest.mark.asyncio
    async def test_update_nonexistent_team(self, client: AsyncClient):
        response = await client.put(
            "/api/v1/teams/00000000-0000-0000-0000-000000000000",
            json={"name": "test"},
        )
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_update_preserves_existing_password(self, client: AsyncClient):
        """Updating other fields should not affect existing password."""
        create_response = await client.post(
            "/api/v1/teams",
            json={"name": "팀", "password": "secret1234"},
        )
        team_id = create_response.json()["id"]

        # Update name only
        response = await client.put(
            f"/api/v1/teams/{team_id}",
            json={"name": "새이름"},
        )
        assert response.status_code == 200
        assert response.json()["has_password"] is True

        # Verify password still works
        auth_response = await client.post(
            f"/api/v1/teams/{team_id}/auth",
            json={"password": "secret1234"},
        )
        assert auth_response.status_code == 200


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


class TestTeamAuth:
    @pytest.mark.asyncio
    async def test_auth_success(self, client: AsyncClient):
        create_response = await client.post(
            "/api/v1/teams",
            json={"name": "보안팀", "password": "secret1234"},
        )
        team_id = create_response.json()["id"]

        response = await client.post(
            f"/api/v1/teams/{team_id}/auth",
            json={"password": "secret1234"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["team_id"] == team_id
        assert data["team_name"] == "보안팀"

    @pytest.mark.asyncio
    async def test_auth_invalid_password(self, client: AsyncClient):
        create_response = await client.post(
            "/api/v1/teams",
            json={"name": "보안팀", "password": "secret1234"},
        )
        team_id = create_response.json()["id"]

        response = await client.post(
            f"/api/v1/teams/{team_id}/auth",
            json={"password": "wrong_password"},
        )
        assert response.status_code == 401
        assert "Invalid password" in response.json()["detail"]

    @pytest.mark.asyncio
    async def test_auth_team_without_password(self, client: AsyncClient):
        create_response = await client.post(
            "/api/v1/teams",
            json={"name": "공개팀"},
        )
        team_id = create_response.json()["id"]

        response = await client.post(
            f"/api/v1/teams/{team_id}/auth",
            json={"password": "any"},
        )
        assert response.status_code == 401
        assert "no password set" in response.json()["detail"]

    @pytest.mark.asyncio
    async def test_auth_nonexistent_team(self, client: AsyncClient):
        response = await client.post(
            "/api/v1/teams/00000000-0000-0000-0000-000000000000/auth",
            json={"password": "test"},
        )
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_auth_after_password_update(self, client: AsyncClient):
        """Verify auth works with updated password."""
        create_response = await client.post(
            "/api/v1/teams",
            json={"name": "팀", "password": "oldpassword"},
        )
        team_id = create_response.json()["id"]

        # Update password
        await client.put(
            f"/api/v1/teams/{team_id}",
            json={"password": "newpassword"},
        )

        # Old password should fail
        old_auth = await client.post(
            f"/api/v1/teams/{team_id}/auth",
            json={"password": "oldpassword"},
        )
        assert old_auth.status_code == 401

        # New password should work
        new_auth = await client.post(
            f"/api/v1/teams/{team_id}/auth",
            json={"password": "newpassword"},
        )
        assert new_auth.status_code == 200


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
