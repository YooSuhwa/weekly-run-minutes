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

    @pytest.mark.asyncio
    async def test_filter_by_meeting_type(self, client: AsyncClient, team_id: str):
        """P2: Should filter meetings by meeting_type."""
        # Create weekly report meeting
        await client.post(
            "/api/v1/meetings",
            json={
                "team_id": team_id,
                "meeting_date": "2024-01-15",
                "title": "주간회의",
                "meeting_type": "weekly_report",
            },
        )
        # Create general meeting
        await client.post(
            "/api/v1/meetings",
            json={
                "team_id": team_id,
                "meeting_date": "2024-01-16",
                "title": "일반회의",
                "meeting_type": "general",
            },
        )

        # Filter by weekly_report
        response = await client.get("/api/v1/meetings?meeting_type=weekly_report")
        assert response.status_code == 200
        data = response.json()
        assert all(m["meeting_type"] == "weekly_report" for m in data)

        # Filter by general
        response = await client.get("/api/v1/meetings?meeting_type=general")
        assert response.status_code == 200
        data = response.json()
        assert all(m["meeting_type"] == "general" for m in data)


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
        assert data["meeting_type"] == "weekly_report"  # default
        assert "id" in data

    @pytest.mark.asyncio
    async def test_create_meeting_empty_title(self, client: AsyncClient, team_id: str):
        response = await client.post(
            "/api/v1/meetings",
            json={"team_id": team_id, "meeting_date": "2024-01-15", "title": ""},
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_create_general_meeting(self, client: AsyncClient, team_id: str):
        """P2: Should create a general meeting without weekly report."""
        response = await client.post(
            "/api/v1/meetings",
            json={
                "team_id": team_id,
                "meeting_date": "2024-01-15",
                "title": "프로젝트 킥오프",
                "meeting_type": "general",
            },
        )
        assert response.status_code == 201
        data = response.json()
        assert data["meeting_type"] == "general"
        assert data["agenda_items"] is None

    @pytest.mark.asyncio
    async def test_create_general_meeting_with_agenda(self, client: AsyncClient, team_id: str):
        """P2: Should create a general meeting with agenda items."""
        response = await client.post(
            "/api/v1/meetings",
            json={
                "team_id": team_id,
                "meeting_date": "2024-01-15",
                "title": "분기 회고",
                "meeting_type": "general",
                "agenda_items": [
                    {
                        "title": "Q1 성과 리뷰",
                        "description": "분기별 목표 달성률 검토",
                        "presenter": "이상윤",
                        "duration_minutes": 20,
                    },
                    {
                        "title": "Q2 계획 논의",
                        "description": "다음 분기 목표 설정",
                        "duration_minutes": 30,
                    },
                ],
            },
        )
        assert response.status_code == 201
        data = response.json()
        assert data["meeting_type"] == "general"
        assert len(data["agenda_items"]) == 2
        assert data["agenda_items"][0]["title"] == "Q1 성과 리뷰"
        assert data["agenda_items"][0]["presenter"] == "이상윤"
        assert data["agenda_items"][1]["presenter"] is None

    @pytest.mark.asyncio
    async def test_create_meeting_invalid_agenda_item(self, client: AsyncClient, team_id: str):
        """P2: Should reject agenda items with invalid data."""
        response = await client.post(
            "/api/v1/meetings",
            json={
                "team_id": team_id,
                "meeting_date": "2024-01-15",
                "title": "회의",
                "meeting_type": "general",
                "agenda_items": [
                    {
                        "title": "",  # Empty title should fail
                        "duration_minutes": 10,
                    },
                ],
            },
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_create_meeting_without_date_and_title(self, client: AsyncClient, team_id: str):
        """Should auto-generate date (today) and title when not provided."""
        from datetime import date

        response = await client.post(
            "/api/v1/meetings",
            json={
                "team_id": team_id,
                # meeting_date and title not provided
            },
        )
        assert response.status_code == 201
        data = response.json()

        # Check date is today
        today = date.today()
        assert data["meeting_date"] == today.isoformat()

        # Check title format: 주간회의 (yy/m/d)
        expected_date_str = f"{today.year % 100}/{today.month}/{today.day}"
        assert data["title"] == f"주간회의 ({expected_date_str})"

    @pytest.mark.asyncio
    async def test_create_general_meeting_without_title(self, client: AsyncClient, team_id: str):
        """Should auto-generate title for general meetings."""
        from datetime import date

        response = await client.post(
            "/api/v1/meetings",
            json={
                "team_id": team_id,
                "meeting_date": "2025-01-05",
                "meeting_type": "general",
                # title not provided
            },
        )
        assert response.status_code == 201
        data = response.json()

        # Check title format: 일반회의 (yy/m/d)
        assert data["title"] == "일반회의 (25/1/5)"

    @pytest.mark.asyncio
    async def test_create_meeting_with_custom_date_and_title(self, client: AsyncClient, team_id: str):
        """Should use provided date and title when specified."""
        response = await client.post(
            "/api/v1/meetings",
            json={
                "team_id": team_id,
                "meeting_date": "2025-01-15",
                "title": "프로젝트 킥오프 미팅",
            },
        )
        assert response.status_code == 201
        data = response.json()

        assert data["meeting_date"] == "2025-01-15"
        assert data["title"] == "프로젝트 킥오프 미팅"


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
        assert data["meeting_type"] == "weekly_report"
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

    @pytest.mark.asyncio
    async def test_get_progress_general_meeting(self, client: AsyncClient, team_id: str):
        """P2: General meetings should skip weekly_report_loaded step."""
        # Create general meeting
        create_response = await client.post(
            "/api/v1/meetings",
            json={
                "team_id": team_id,
                "meeting_date": "2024-01-15",
                "title": "일반회의",
                "meeting_type": "general",
            },
        )
        general_meeting_id = create_response.json()["id"]

        response = await client.get(f"/api/v1/meetings/{general_meeting_id}/progress")
        assert response.status_code == 200
        data = response.json()
        assert data["meeting_type"] == "general"
        # weekly_report_loaded should be True for general meetings (skipped)
        assert data["steps"]["weekly_report_loaded"] is True

    @pytest.mark.asyncio
    async def test_get_progress_general_meeting_with_agenda(self, client: AsyncClient, team_id: str):
        """P2: General meetings with agenda should show has_agenda_items."""
        # Create general meeting with agenda
        create_response = await client.post(
            "/api/v1/meetings",
            json={
                "team_id": team_id,
                "meeting_date": "2024-01-15",
                "title": "회의",
                "meeting_type": "general",
                "agenda_items": [
                    {"title": "안건1", "duration_minutes": 10},
                ],
            },
        )
        meeting_id = create_response.json()["id"]

        response = await client.get(f"/api/v1/meetings/{meeting_id}/progress")
        assert response.status_code == 200
        data = response.json()
        assert data["has_agenda_items"] is True

    @pytest.mark.asyncio
    async def test_get_progress_general_meeting_without_agenda(self, client: AsyncClient, team_id: str):
        """P2: General meetings without agenda should show has_agenda_items as False."""
        create_response = await client.post(
            "/api/v1/meetings",
            json={
                "team_id": team_id,
                "meeting_date": "2024-01-15",
                "title": "회의",
                "meeting_type": "general",
            },
        )
        meeting_id = create_response.json()["id"]

        response = await client.get(f"/api/v1/meetings/{meeting_id}/progress")
        assert response.status_code == 200
        data = response.json()
        assert data["has_agenda_items"] is False
