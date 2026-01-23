"""Tests for recordings API endpoints."""

from unittest.mock import patch

import pytest
from httpx import AsyncClient


@pytest.fixture
async def team_and_meeting(client: AsyncClient) -> tuple[str, str]:
    """Create a team and meeting, return (team_id, meeting_id)."""
    team_resp = await client.post("/api/v1/teams", json={"name": "테스트팀"})
    team_id = team_resp.json()["id"]
    meeting_resp = await client.post(
        "/api/v1/meetings",
        json={"team_id": team_id, "meeting_date": "2024-01-15", "title": "회의"},
    )
    return team_id, meeting_resp.json()["id"]


class TestUploadRecording:
    @pytest.mark.asyncio
    async def test_upload_success(self, client: AsyncClient, team_and_meeting, tmp_path):
        _, meeting_id = team_and_meeting

        with patch("src.routers.recordings.get_upload_dir", return_value=tmp_path):
            response = await client.post(
                f"/api/v1/recordings/meetings/{meeting_id}/recording",
                files={"file": ("test.mp3", b"fake audio content", "audio/mpeg")},
            )
            assert response.status_code == 201
            data = response.json()
            assert data["meeting_id"] == meeting_id
            assert data["original_filename"] == "test.mp3"
            assert data["mime_type"] == "audio/mpeg"
            assert data["file_size"] == len(b"fake audio content")

    @pytest.mark.asyncio
    async def test_upload_nonexistent_meeting(self, client: AsyncClient):
        response = await client.post(
            "/api/v1/recordings/meetings/00000000-0000-0000-0000-000000000000/recording",
            files={"file": ("test.mp3", b"content", "audio/mpeg")},
        )
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_upload_unsupported_format(self, client: AsyncClient, team_and_meeting):
        _, meeting_id = team_and_meeting
        response = await client.post(
            f"/api/v1/recordings/meetings/{meeting_id}/recording",
            files={"file": ("test.txt", b"content", "text/plain")},
        )
        assert response.status_code == 415

    @pytest.mark.asyncio
    async def test_upload_empty_file(self, client: AsyncClient, team_and_meeting):
        _, meeting_id = team_and_meeting
        response = await client.post(
            f"/api/v1/recordings/meetings/{meeting_id}/recording",
            files={"file": ("test.mp3", b"", "audio/mpeg")},
        )
        assert response.status_code == 400

    @pytest.mark.asyncio
    async def test_upload_file_too_large(self, client: AsyncClient, team_and_meeting):
        _, meeting_id = team_and_meeting

        with patch("src.routers.recordings.settings") as mock_settings:
            mock_settings.MAX_FILE_SIZE = 10  # 10 bytes
            mock_settings.UPLOAD_DIR = "./data/uploads"
            response = await client.post(
                f"/api/v1/recordings/meetings/{meeting_id}/recording",
                files={"file": ("test.mp3", b"x" * 100, "audio/mpeg")},
            )
            assert response.status_code == 413

    @pytest.mark.asyncio
    async def test_upload_duplicate_recording(self, client: AsyncClient, team_and_meeting, tmp_path):
        _, meeting_id = team_and_meeting

        with patch("src.routers.recordings.get_upload_dir", return_value=tmp_path):
            # First upload
            await client.post(
                f"/api/v1/recordings/meetings/{meeting_id}/recording",
                files={"file": ("test.mp3", b"content", "audio/mpeg")},
            )
            # Second upload should fail
            response = await client.post(
                f"/api/v1/recordings/meetings/{meeting_id}/recording",
                files={"file": ("test2.mp3", b"content2", "audio/mpeg")},
            )
            assert response.status_code == 409


class TestGetRecording:
    @pytest.mark.asyncio
    async def test_get_recording(self, client: AsyncClient, team_and_meeting, tmp_path):
        _, meeting_id = team_and_meeting

        with patch("src.routers.recordings.get_upload_dir", return_value=tmp_path):
            await client.post(
                f"/api/v1/recordings/meetings/{meeting_id}/recording",
                files={"file": ("test.mp3", b"content", "audio/mpeg")},
            )

        response = await client.get(f"/api/v1/recordings/meetings/{meeting_id}/recording")
        assert response.status_code == 200
        assert response.json()["original_filename"] == "test.mp3"

    @pytest.mark.asyncio
    async def test_get_recording_not_found(self, client: AsyncClient, team_and_meeting):
        _, meeting_id = team_and_meeting
        response = await client.get(f"/api/v1/recordings/meetings/{meeting_id}/recording")
        assert response.status_code == 404


class TestDeleteRecording:
    @pytest.mark.asyncio
    async def test_delete_recording(self, client: AsyncClient, team_and_meeting, tmp_path):
        _, meeting_id = team_and_meeting

        with patch("src.routers.recordings.get_upload_dir", return_value=tmp_path):
            await client.post(
                f"/api/v1/recordings/meetings/{meeting_id}/recording",
                files={"file": ("test.mp3", b"content", "audio/mpeg")},
            )

        response = await client.delete(f"/api/v1/recordings/meetings/{meeting_id}/recording")
        assert response.status_code == 204

        # Verify deleted
        get_resp = await client.get(f"/api/v1/recordings/meetings/{meeting_id}/recording")
        assert get_resp.status_code == 404

    @pytest.mark.asyncio
    async def test_delete_nonexistent_recording(self, client: AsyncClient, team_and_meeting):
        _, meeting_id = team_and_meeting
        response = await client.delete(f"/api/v1/recordings/meetings/{meeting_id}/recording")
        assert response.status_code == 404


class TestBrowserRecordingSource:
    @pytest.fixture
    async def realtime_meeting(self, client: AsyncClient) -> tuple[str, str]:
        """Create a realtime mode meeting."""
        team_resp = await client.post("/api/v1/teams", json={"name": "실시간팀"})
        team_id = team_resp.json()["id"]
        meeting_resp = await client.post(
            "/api/v1/meetings",
            json={
                "team_id": team_id,
                "meeting_date": "2024-01-15",
                "title": "실시간 회의",
                "meeting_mode": "realtime",
            },
        )
        return team_id, meeting_resp.json()["id"]

    @pytest.mark.asyncio
    async def test_upload_with_browser_source(self, client: AsyncClient, realtime_meeting, tmp_path):
        _, meeting_id = realtime_meeting

        with patch("src.routers.recordings.get_upload_dir", return_value=tmp_path):
            response = await client.post(
                f"/api/v1/recordings/meetings/{meeting_id}/recording",
                files={"file": ("recording.webm", b"browser audio data", "audio/webm")},
                data={"source": "browser"},
            )
            assert response.status_code == 201
            data = response.json()
            assert data["source"] == "browser"
            assert data["original_filename"] == "recording.webm"

    @pytest.mark.asyncio
    async def test_upload_with_upload_source_default(self, client: AsyncClient, team_and_meeting, tmp_path):
        _, meeting_id = team_and_meeting

        with patch("src.routers.recordings.get_upload_dir", return_value=tmp_path):
            response = await client.post(
                f"/api/v1/recordings/meetings/{meeting_id}/recording",
                files={"file": ("test.mp3", b"audio content", "audio/mpeg")},
            )
            assert response.status_code == 201
            data = response.json()
            assert data["source"] == "upload"

    @pytest.mark.asyncio
    async def test_upload_with_invalid_source(self, client: AsyncClient, team_and_meeting, tmp_path):
        _, meeting_id = team_and_meeting

        with patch("src.routers.recordings.get_upload_dir", return_value=tmp_path):
            response = await client.post(
                f"/api/v1/recordings/meetings/{meeting_id}/recording",
                files={"file": ("test.mp3", b"audio content", "audio/mpeg")},
                data={"source": "invalid_source"},
            )
            assert response.status_code == 400
            assert "Invalid source" in response.json()["detail"]

    @pytest.mark.asyncio
    async def test_browser_source_does_not_change_meeting_status(
        self, client: AsyncClient, realtime_meeting, tmp_path
    ):
        """Browser recording upload should not override meeting status."""
        _, meeting_id = realtime_meeting

        with patch("src.routers.recordings.get_upload_dir", return_value=tmp_path):
            await client.post(
                f"/api/v1/recordings/meetings/{meeting_id}/recording",
                files={"file": ("recording.webm", b"browser audio", "audio/webm")},
                data={"source": "browser"},
            )

        # Check meeting status - should still be 'created' (not 'recording_uploaded')
        meeting_resp = await client.get(f"/api/v1/meetings/{meeting_id}")
        assert meeting_resp.json()["status"] == "created"


class TestHelperFunctions:
    def test_generate_stored_filename(self):
        from uuid import UUID

        from src.routers.recordings import generate_stored_filename

        meeting_id = UUID("12345678-1234-5678-1234-567812345678")
        result = generate_stored_filename("test_file.mp3", meeting_id)
        assert result.startswith("12345678-1234-5678-1234-567812345678_")
        assert result.endswith(".mp3")

    def test_generate_stored_filename_uppercase_ext(self):
        from uuid import UUID

        from src.routers.recordings import generate_stored_filename

        meeting_id = UUID("12345678-1234-5678-1234-567812345678")
        result = generate_stored_filename("test.WAV", meeting_id)
        assert result.endswith(".wav")
