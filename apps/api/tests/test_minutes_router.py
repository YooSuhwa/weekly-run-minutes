"""Tests for minutes API endpoints."""

from unittest.mock import AsyncMock, patch

import pytest
from httpx import AsyncClient

from src.models import MeetingMinutes


@pytest.fixture
async def team_id(client: AsyncClient) -> str:
    response = await client.post("/api/v1/teams", json={"name": "제품기술팀"})
    return response.json()["id"]


@pytest.fixture
async def meeting_id(client: AsyncClient, team_id: str) -> str:
    response = await client.post(
        "/api/v1/meetings",
        json={"team_id": team_id, "meeting_date": "2024-01-15", "title": "주간회의"},
    )
    return response.json()["id"]


@pytest.fixture
async def meeting_with_minutes(client: AsyncClient, meeting_id: str, db_session) -> str:
    """Create a meeting with minutes attached."""
    from uuid import UUID

    # Update meeting status to DRAFT_READY
    await client.patch(
        f"/api/v1/meetings/{meeting_id}/status",
        json={"status": "draft_ready"},
    )

    # Create minutes directly in DB
    minutes = MeetingMinutes(
        meeting_id=UUID(meeting_id),
        content_markdown="# 2024-01-15 주간회의 회의록\n\n## 참석자\n- 이상윤",
        ai_model="gpt-4o",
        prompt_version="1.1.0",
        corrections=[
            {"original": "에스디케이", "corrected": "SDK", "category": "terminology"},
            {"original": "2024.1.15", "corrected": "2024-01-15", "category": "formatting"},
        ],
    )
    db_session.add(minutes)
    await db_session.commit()
    return meeting_id


class TestStartMinutesGeneration:
    @pytest.mark.asyncio
    async def test_not_found(self, client: AsyncClient):
        response = await client.post(
            "/api/v1/minutes/meetings/00000000-0000-0000-0000-000000000000/generate-minutes"
        )
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_transcription_not_done(self, client: AsyncClient, meeting_id: str):
        """Should reject if meeting is in CREATED status."""
        response = await client.post(
            f"/api/v1/minutes/meetings/{meeting_id}/generate-minutes"
        )
        assert response.status_code == 400
        assert "Transcription must be completed" in response.json()["detail"]

    @pytest.mark.asyncio
    async def test_start_generation_success(self, client: AsyncClient, meeting_id: str):
        """Should accept if meeting is TRANSCRIBED."""
        # Set status to TRANSCRIBED
        await client.patch(
            f"/api/v1/meetings/{meeting_id}/status",
            json={"status": "transcribed"},
        )

        # Mock background task to avoid DB connection issues in test
        with patch("src.routers.minutes.generate_minutes_task"):
            response = await client.post(
                f"/api/v1/minutes/meetings/{meeting_id}/generate-minutes"
            )
        assert response.status_code == 202
        data = response.json()
        assert data["status"] == "generating_minutes"
        assert data["has_minutes"] is False

    @pytest.mark.asyncio
    async def test_already_has_minutes(self, client: AsyncClient, meeting_with_minutes: str):
        """Should return existing if minutes already generated."""
        response = await client.post(
            f"/api/v1/minutes/meetings/{meeting_with_minutes}/generate-minutes"
        )
        assert response.status_code == 202
        data = response.json()
        assert data["has_minutes"] is True

    @pytest.mark.asyncio
    async def test_already_generating(self, client: AsyncClient, meeting_id: str):
        """Should not start again if already generating."""
        await client.patch(
            f"/api/v1/meetings/{meeting_id}/status",
            json={"status": "generating_minutes"},
        )

        response = await client.post(
            f"/api/v1/minutes/meetings/{meeting_id}/generate-minutes"
        )
        assert response.status_code == 202
        assert response.json()["status"] == "generating_minutes"


class TestGetMeetingMinutes:
    @pytest.mark.asyncio
    async def test_get_minutes(self, client: AsyncClient, meeting_with_minutes: str):
        response = await client.get(
            f"/api/v1/minutes/meetings/{meeting_with_minutes}/minutes"
        )
        assert response.status_code == 200
        data = response.json()
        assert "회의록" in data["content_markdown"]
        assert data["ai_model"] == "gpt-4o"
        assert data["is_edited"] is False

    @pytest.mark.asyncio
    async def test_get_minutes_includes_corrections(
        self, client: AsyncClient, meeting_with_minutes: str
    ):
        response = await client.get(
            f"/api/v1/minutes/meetings/{meeting_with_minutes}/minutes"
        )
        assert response.status_code == 200
        data = response.json()
        assert "corrections" in data
        assert len(data["corrections"]) == 2
        assert data["corrections"][0]["original"] == "에스디케이"
        assert data["corrections"][0]["corrected"] == "SDK"
        assert data["corrections"][0]["category"] == "terminology"
        assert data["corrections"][1]["category"] == "formatting"

    @pytest.mark.asyncio
    async def test_get_minutes_not_found(self, client: AsyncClient, meeting_id: str):
        response = await client.get(f"/api/v1/minutes/meetings/{meeting_id}/minutes")
        assert response.status_code == 404


class TestUpdateMeetingMinutes:
    @pytest.mark.asyncio
    async def test_update_minutes(self, client: AsyncClient, meeting_with_minutes: str):
        response = await client.put(
            f"/api/v1/minutes/meetings/{meeting_with_minutes}/minutes",
            json={"content_markdown": "# 수정된 회의록\n\n## 내용\n- 수정됨"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["is_edited"] is True
        assert data["edited_content"] == "# 수정된 회의록\n\n## 내용\n- 수정됨"

    @pytest.mark.asyncio
    async def test_update_minutes_not_found(self, client: AsyncClient, meeting_id: str):
        response = await client.put(
            f"/api/v1/minutes/meetings/{meeting_id}/minutes",
            json={"content_markdown": "test"},
        )
        assert response.status_code == 404


class TestPublishMinutes:
    @pytest.mark.asyncio
    async def test_publish_not_found(self, client: AsyncClient):
        response = await client.post(
            "/api/v1/minutes/meetings/00000000-0000-0000-0000-000000000000/publish"
        )
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_publish_no_minutes(self, client: AsyncClient, meeting_id: str):
        response = await client.post(f"/api/v1/minutes/meetings/{meeting_id}/publish")
        assert response.status_code == 400
        assert "Minutes must be generated first" in response.json()["detail"]

    @pytest.mark.asyncio
    async def test_publish_success(self, client: AsyncClient, meeting_with_minutes: str):
        with patch("src.routers.minutes.ConfluenceService") as mock_service_cls:
            mock_service = AsyncMock()
            mock_service.upload_meeting_minutes = AsyncMock(
                return_value={
                    "id": "confluence-page-123",
                    "url": "https://test.atlassian.net/wiki/pages/123",
                    "title": "회의록",
                }
            )
            mock_service_cls.return_value = mock_service

            response = await client.post(
                f"/api/v1/minutes/meetings/{meeting_with_minutes}/publish"
            )
            assert response.status_code == 200
            data = response.json()
            assert data["confluence_page_id"] == "confluence-page-123"
            assert data["confluence_page_url"] == "https://test.atlassian.net/wiki/pages/123"

    @pytest.mark.asyncio
    async def test_publish_already_published(
        self, client: AsyncClient, meeting_with_minutes: str
    ):
        # First publish
        with patch("src.routers.minutes.ConfluenceService") as mock_service_cls:
            mock_service = AsyncMock()
            mock_service.upload_meeting_minutes = AsyncMock(
                return_value={
                    "id": "page-1",
                    "url": "https://test.atlassian.net/wiki/pages/1",
                    "title": "회의록",
                }
            )
            mock_service_cls.return_value = mock_service
            await client.post(f"/api/v1/minutes/meetings/{meeting_with_minutes}/publish")

        # Second publish should fail
        response = await client.post(
            f"/api/v1/minutes/meetings/{meeting_with_minutes}/publish"
        )
        assert response.status_code == 409

    @pytest.mark.asyncio
    async def test_publish_confluence_error(
        self, client: AsyncClient, meeting_with_minutes: str
    ):
        from src.services.confluence import ConfluenceError

        with patch("src.routers.minutes.ConfluenceService") as mock_service_cls:
            mock_service = AsyncMock()
            mock_service.upload_meeting_minutes = AsyncMock(
                side_effect=ConfluenceError("Upload failed", 500)
            )
            mock_service_cls.return_value = mock_service

            response = await client.post(
                f"/api/v1/minutes/meetings/{meeting_with_minutes}/publish"
            )
            assert response.status_code == 500


class TestExportMinutes:
    @pytest.mark.asyncio
    async def test_export_markdown(self, client: AsyncClient, meeting_with_minutes: str):
        response = await client.get(
            f"/api/v1/minutes/meetings/{meeting_with_minutes}/minutes/export?format=markdown"
        )
        assert response.status_code == 200
        data = response.json()
        assert data["format"] == "markdown"
        assert "회의록" in data["content"]

    @pytest.mark.asyncio
    async def test_export_not_found(self, client: AsyncClient, meeting_id: str):
        response = await client.get(
            f"/api/v1/minutes/meetings/{meeting_id}/minutes/export"
        )
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_export_unsupported_format(
        self, client: AsyncClient, meeting_with_minutes: str
    ):
        response = await client.get(
            f"/api/v1/minutes/meetings/{meeting_with_minutes}/minutes/export?format=pdf"
        )
        assert response.status_code == 400
