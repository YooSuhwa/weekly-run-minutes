"""Tests for realtime meeting API endpoints."""

import pytest
from httpx import AsyncClient


@pytest.fixture
async def team_id(client: AsyncClient) -> str:
    response = await client.post("/api/v1/teams", json={"name": "제품기술팀"})
    return response.json()["id"]


@pytest.fixture
async def realtime_meeting_id(client: AsyncClient, team_id: str) -> str:
    """Create a realtime mode meeting."""
    response = await client.post(
        "/api/v1/meetings",
        json={
            "team_id": team_id,
            "meeting_date": "2024-01-15",
            "title": "주간회의",
            "meeting_mode": "realtime",
        },
    )
    return response.json()["id"]


@pytest.fixture
async def upload_meeting_id(client: AsyncClient, team_id: str) -> str:
    """Create an upload mode meeting."""
    response = await client.post(
        "/api/v1/meetings",
        json={
            "team_id": team_id,
            "meeting_date": "2024-01-15",
            "title": "주간회의",
        },
    )
    return response.json()["id"]


@pytest.fixture
async def prepared_meeting_id(client: AsyncClient, realtime_meeting_id: str) -> str:
    """Create a meeting in PREPARING status with weekly report."""
    # Set to PREPARING status
    await client.patch(
        f"/api/v1/meetings/{realtime_meeting_id}/status",
        json={"status": "preparing"},
    )
    return realtime_meeting_id


class TestStartRealtimeMeeting:
    @pytest.mark.asyncio
    async def test_start_success(self, client: AsyncClient, prepared_meeting_id: str):
        response = await client.post(
            f"/api/v1/realtime/meetings/{prepared_meeting_id}/start"
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "in_progress"
        assert "question_tree" in data

    @pytest.mark.asyncio
    async def test_start_not_found(self, client: AsyncClient):
        response = await client.post(
            "/api/v1/realtime/meetings/00000000-0000-0000-0000-000000000000/start"
        )
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_start_wrong_mode(self, client: AsyncClient, upload_meeting_id: str):
        """Upload mode meetings cannot start realtime."""
        response = await client.post(
            f"/api/v1/realtime/meetings/{upload_meeting_id}/start"
        )
        assert response.status_code == 400
        assert "not in realtime mode" in response.json()["detail"]

    @pytest.mark.asyncio
    async def test_start_invalid_status(self, client: AsyncClient, realtime_meeting_id: str):
        """Cannot start from CREATED without going through PREPARING."""
        response = await client.post(
            f"/api/v1/realtime/meetings/{realtime_meeting_id}/start"
        )
        assert response.status_code == 409

    @pytest.mark.asyncio
    async def test_start_generates_empty_tree_without_report(
        self, client: AsyncClient, prepared_meeting_id: str
    ):
        """Starting without weekly report generates empty tree."""
        response = await client.post(
            f"/api/v1/realtime/meetings/{prepared_meeting_id}/start"
        )
        assert response.status_code == 200
        tree = response.json()["question_tree"]
        assert tree["speakers"] == []


class TestGetMeetingProgress:
    @pytest.mark.asyncio
    async def test_get_progress(self, client: AsyncClient, prepared_meeting_id: str):
        # Start the meeting first
        await client.post(f"/api/v1/realtime/meetings/{prepared_meeting_id}/start")

        response = await client.get(
            f"/api/v1/realtime/meetings/{prepared_meeting_id}/progress"
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "in_progress"
        assert data["current_speaker_index"] == 0
        assert data["current_item_index"] == 0

    @pytest.mark.asyncio
    async def test_get_progress_not_found(self, client: AsyncClient):
        response = await client.get(
            "/api/v1/realtime/meetings/00000000-0000-0000-0000-000000000000/progress"
        )
        assert response.status_code == 404


class TestUpdateMeetingProgress:
    @pytest.mark.asyncio
    async def test_update_progress(self, client: AsyncClient, prepared_meeting_id: str):
        await client.post(f"/api/v1/realtime/meetings/{prepared_meeting_id}/start")

        response = await client.put(
            f"/api/v1/realtime/meetings/{prepared_meeting_id}/progress",
            json={"current_speaker_index": 1, "current_item_index": 2},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["current_speaker_index"] == 1
        assert data["current_item_index"] == 2

    @pytest.mark.asyncio
    async def test_update_not_in_progress(self, client: AsyncClient, prepared_meeting_id: str):
        """Cannot update progress if meeting is not in progress."""
        response = await client.put(
            f"/api/v1/realtime/meetings/{prepared_meeting_id}/progress",
            json={"current_speaker_index": 0, "current_item_index": 0},
        )
        assert response.status_code == 400


class TestNextItem:
    @pytest.mark.asyncio
    async def test_next_item(self, client: AsyncClient, prepared_meeting_id: str):
        await client.post(f"/api/v1/realtime/meetings/{prepared_meeting_id}/start")

        response = await client.post(
            f"/api/v1/realtime/meetings/{prepared_meeting_id}/next-item"
        )
        assert response.status_code == 200
        data = response.json()
        assert data["current_item_index"] == 1

    @pytest.mark.asyncio
    async def test_next_item_not_in_progress(self, client: AsyncClient, prepared_meeting_id: str):
        response = await client.post(
            f"/api/v1/realtime/meetings/{prepared_meeting_id}/next-item"
        )
        assert response.status_code == 400


class TestNextSpeaker:
    @pytest.mark.asyncio
    async def test_next_speaker(self, client: AsyncClient, prepared_meeting_id: str):
        await client.post(f"/api/v1/realtime/meetings/{prepared_meeting_id}/start")

        response = await client.post(
            f"/api/v1/realtime/meetings/{prepared_meeting_id}/next-speaker"
        )
        assert response.status_code == 200
        data = response.json()
        assert data["current_speaker_index"] == 1
        assert data["current_item_index"] == 0

    @pytest.mark.asyncio
    async def test_next_speaker_not_in_progress(
        self, client: AsyncClient, prepared_meeting_id: str
    ):
        response = await client.post(
            f"/api/v1/realtime/meetings/{prepared_meeting_id}/next-speaker"
        )
        assert response.status_code == 400


class TestEndRealtimeMeeting:
    @pytest.mark.asyncio
    async def test_end_success(self, client: AsyncClient, prepared_meeting_id: str):
        await client.post(f"/api/v1/realtime/meetings/{prepared_meeting_id}/start")

        response = await client.post(
            f"/api/v1/realtime/meetings/{prepared_meeting_id}/end"
        )
        assert response.status_code == 200
        assert response.json()["status"] == "recording_done"

    @pytest.mark.asyncio
    async def test_end_invalid_status(self, client: AsyncClient, prepared_meeting_id: str):
        """Cannot end a meeting that hasn't started."""
        response = await client.post(
            f"/api/v1/realtime/meetings/{prepared_meeting_id}/end"
        )
        assert response.status_code == 409


class TestGetQuestionTree:
    @pytest.mark.asyncio
    async def test_get_tree(self, client: AsyncClient, prepared_meeting_id: str):
        await client.post(f"/api/v1/realtime/meetings/{prepared_meeting_id}/start")

        response = await client.get(
            f"/api/v1/realtime/meetings/{prepared_meeting_id}/question-tree"
        )
        assert response.status_code == 200
        assert "speakers" in response.json()

    @pytest.mark.asyncio
    async def test_get_tree_not_generated(self, client: AsyncClient, prepared_meeting_id: str):
        """No tree available before meeting starts."""
        response = await client.get(
            f"/api/v1/realtime/meetings/{prepared_meeting_id}/question-tree"
        )
        assert response.status_code == 404


class TestMeetingStateMachine:
    @pytest.mark.asyncio
    async def test_full_lifecycle(self, client: AsyncClient, prepared_meeting_id: str):
        """Test the full realtime meeting lifecycle."""
        # Start
        r = await client.post(f"/api/v1/realtime/meetings/{prepared_meeting_id}/start")
        assert r.status_code == 200

        # Progress
        r = await client.post(f"/api/v1/realtime/meetings/{prepared_meeting_id}/next-item")
        assert r.status_code == 200

        # End
        r = await client.post(f"/api/v1/realtime/meetings/{prepared_meeting_id}/end")
        assert r.status_code == 200
        assert r.json()["status"] == "recording_done"

        # Verify final state
        r = await client.get(f"/api/v1/realtime/meetings/{prepared_meeting_id}/progress")
        assert r.json()["status"] == "recording_done"
