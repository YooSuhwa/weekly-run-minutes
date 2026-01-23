"""Tests for meetings API endpoints."""

import pytest
from httpx import AsyncClient


@pytest.fixture
async def team_id(client: AsyncClient) -> str:
    """Create a team and return its ID."""
    response = await client.post("/api/v1/teams", json={"name": "제품기술팀"})
    return response.json()["id"]


@pytest.fixture
async def meeting_id(client: AsyncClient, team_id: str) -> str:
    """Create a meeting and return its ID."""
    response = await client.post(
        "/api/v1/meetings",
        json={
            "team_id": team_id,
            "meeting_date": "2024-01-15",
            "title": "주간회의",
        },
    )
    return response.json()["id"]


class TestListMeetings:
    @pytest.mark.asyncio
    async def test_empty_list(self, client: AsyncClient):
        response = await client.get("/api/v1/meetings")
        assert response.status_code == 200
        assert response.json() == []

    @pytest.mark.asyncio
    async def test_list_with_meetings(self, client: AsyncClient, team_id: str):
        await client.post(
            "/api/v1/meetings",
            json={"team_id": team_id, "meeting_date": "2024-01-15", "title": "회의1"},
        )
        response = await client.get("/api/v1/meetings")
        assert response.status_code == 200
        assert len(response.json()) == 1

    @pytest.mark.asyncio
    async def test_filter_by_team_id(self, client: AsyncClient, team_id: str):
        await client.post(
            "/api/v1/meetings",
            json={"team_id": team_id, "meeting_date": "2024-01-15", "title": "회의"},
        )
        response = await client.get(f"/api/v1/meetings?team_id={team_id}")
        assert response.status_code == 200
        assert len(response.json()) >= 1

    @pytest.mark.asyncio
    async def test_filter_by_status(self, client: AsyncClient, team_id: str):
        await client.post(
            "/api/v1/meetings",
            json={"team_id": team_id, "meeting_date": "2024-01-15", "title": "회의"},
        )
        response = await client.get("/api/v1/meetings?status=created")
        assert response.status_code == 200
        assert len(response.json()) >= 1

    @pytest.mark.asyncio
    async def test_filter_by_date_range(self, client: AsyncClient, team_id: str):
        await client.post(
            "/api/v1/meetings",
            json={"team_id": team_id, "meeting_date": "2024-01-15", "title": "회의"},
        )
        response = await client.get(
            "/api/v1/meetings?from_date=2024-01-01&to_date=2024-12-31"
        )
        assert response.status_code == 200


class TestCreateMeeting:
    @pytest.mark.asyncio
    async def test_create_meeting(self, client: AsyncClient, team_id: str):
        response = await client.post(
            "/api/v1/meetings",
            json={
                "team_id": team_id,
                "meeting_date": "2024-01-15",
                "title": "2024-01-15 주간회의",
            },
        )
        assert response.status_code == 201
        data = response.json()
        assert data["title"] == "2024-01-15 주간회의"
        assert data["status"] == "created"
        assert data["team_id"] == team_id
        assert "id" in data

    @pytest.mark.asyncio
    async def test_create_meeting_empty_title(self, client: AsyncClient, team_id: str):
        response = await client.post(
            "/api/v1/meetings",
            json={"team_id": team_id, "meeting_date": "2024-01-15", "title": ""},
        )
        assert response.status_code == 422


class TestGetMeeting:
    @pytest.mark.asyncio
    async def test_get_existing_meeting(self, client: AsyncClient, meeting_id: str):
        response = await client.get(f"/api/v1/meetings/{meeting_id}")
        assert response.status_code == 200
        data = response.json()
        assert data["title"] == "주간회의"
        assert data["recording"] is None
        assert data["weekly_report"] is None
        assert data["minutes"] is None

    @pytest.mark.asyncio
    async def test_get_nonexistent_meeting(self, client: AsyncClient):
        response = await client.get(
            "/api/v1/meetings/00000000-0000-0000-0000-000000000000"
        )
        assert response.status_code == 404


class TestUpdateMeetingStatus:
    @pytest.mark.asyncio
    async def test_update_status(self, client: AsyncClient, meeting_id: str):
        response = await client.patch(
            f"/api/v1/meetings/{meeting_id}/status",
            json={"status": "recording_uploaded"},
        )
        assert response.status_code == 200
        assert response.json()["status"] == "recording_uploaded"

    @pytest.mark.asyncio
    async def test_update_status_with_error(self, client: AsyncClient, meeting_id: str):
        response = await client.patch(
            f"/api/v1/meetings/{meeting_id}/status",
            json={"status": "failed", "error_message": "STT 처리 실패"},
        )
        assert response.status_code == 200
        assert response.json()["status"] == "failed"
        assert response.json()["error_message"] == "STT 처리 실패"

    @pytest.mark.asyncio
    async def test_update_nonexistent_meeting(self, client: AsyncClient):
        response = await client.patch(
            "/api/v1/meetings/00000000-0000-0000-0000-000000000000/status",
            json={"status": "created"},
        )
        assert response.status_code == 404


class TestDeleteMeeting:
    @pytest.mark.asyncio
    async def test_delete_meeting(self, client: AsyncClient, meeting_id: str):
        response = await client.delete(f"/api/v1/meetings/{meeting_id}")
        assert response.status_code == 204

        get_response = await client.get(f"/api/v1/meetings/{meeting_id}")
        assert get_response.status_code == 404

    @pytest.mark.asyncio
    async def test_delete_nonexistent_meeting(self, client: AsyncClient):
        response = await client.delete(
            "/api/v1/meetings/00000000-0000-0000-0000-000000000000"
        )
        assert response.status_code == 404


class TestGetMeetingProgress:
    @pytest.mark.asyncio
    async def test_get_progress_created(self, client: AsyncClient, meeting_id: str):
        response = await client.get(f"/api/v1/meetings/{meeting_id}/progress")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "created"
        assert data["has_recording"] is False
        assert data["has_weekly_report"] is False
        assert data["has_minutes"] is False
        assert data["steps"]["created"] is True
        assert data["steps"]["weekly_report_loaded"] is False

    @pytest.mark.asyncio
    async def test_get_progress_nonexistent(self, client: AsyncClient):
        response = await client.get(
            "/api/v1/meetings/00000000-0000-0000-0000-000000000000/progress"
        )
        assert response.status_code == 404
