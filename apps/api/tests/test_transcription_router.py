"""Tests for transcription API endpoints."""

from unittest.mock import patch
from uuid import UUID

import pytest
from httpx import AsyncClient

from src.models import Recording, Transcript


@pytest.fixture
async def team_id(client: AsyncClient) -> str:
    response = await client.post("/api/v1/teams", json={"name": "테스트팀"})
    return response.json()["id"]


@pytest.fixture
async def meeting_id(client: AsyncClient, team_id: str) -> str:
    response = await client.post(
        "/api/v1/meetings",
        json={"team_id": team_id, "meeting_date": "2024-01-15", "title": "주간회의"},
    )
    return response.json()["id"]


@pytest.fixture
async def meeting_with_recording(client: AsyncClient, meeting_id: str, db_session) -> str:  # noqa: ARG001
    """Create a meeting with a recording attached."""
    recording = Recording(
        meeting_id=UUID(meeting_id),
        original_filename="test.mp3",
        stored_filename="stored_test.mp3",
        file_path="/tmp/stored_test.mp3",
        file_size=1024,
        mime_type="audio/mpeg",
    )
    db_session.add(recording)
    await db_session.commit()
    return meeting_id


@pytest.fixture
async def meeting_with_transcripts(
    client: AsyncClient, meeting_with_recording: str, db_session
) -> str:
    """Create a meeting with transcripts."""
    meeting_id = meeting_with_recording

    # Update status to TRANSCRIBED
    await client.patch(
        f"/api/v1/meetings/{meeting_id}/status",
        json={"status": "transcribed"},
    )

    # Add transcript segments
    segments = [
        Transcript(
            meeting_id=UUID(meeting_id),
            start_time=0.0,
            end_time=5.0,
            text="안녕하세요, 주간회의 시작하겠습니다.",
            speaker_label="speaker_0",
            speaker_name="이상윤",
            confidence=0.95,
        ),
        Transcript(
            meeting_id=UUID(meeting_id),
            start_time=5.0,
            end_time=10.0,
            text="네, 이번 주 업무 보고 드리겠습니다.",
            speaker_label="speaker_1",
            speaker_name=None,
            confidence=0.88,
        ),
        Transcript(
            meeting_id=UUID(meeting_id),
            start_time=10.0,
            end_time=15.0,
            text="SDK 연동 작업 완료했습니다.",
            speaker_label=None,
            speaker_name=None,
            confidence=None,
        ),
    ]
    for seg in segments:
        db_session.add(seg)
    await db_session.commit()
    return meeting_id


class TestStartTranscription:
    @pytest.mark.asyncio
    async def test_not_found(self, client: AsyncClient):
        response = await client.post(
            "/api/v1/transcription/meetings/00000000-0000-0000-0000-000000000000/transcribe"
        )
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_no_recording(self, client: AsyncClient, meeting_id: str):
        """Should reject if no recording uploaded."""
        response = await client.post(
            f"/api/v1/transcription/meetings/{meeting_id}/transcribe"
        )
        assert response.status_code == 400
        assert "No recording uploaded" in response.json()["detail"]

    @pytest.mark.asyncio
    async def test_already_transcribing(
        self, client: AsyncClient, meeting_with_recording: str
    ):
        """Should reject if already in progress."""
        await client.patch(
            f"/api/v1/meetings/{meeting_with_recording}/status",
            json={"status": "transcribing"},
        )

        response = await client.post(
            f"/api/v1/transcription/meetings/{meeting_with_recording}/transcribe"
        )
        assert response.status_code == 409
        assert "already in progress" in response.json()["detail"]

    @pytest.mark.asyncio
    async def test_already_transcribed(
        self, client: AsyncClient, meeting_with_transcripts: str
    ):
        """Should return existing data if already transcribed."""
        response = await client.post(
            f"/api/v1/transcription/meetings/{meeting_with_transcripts}/transcribe"
        )
        assert response.status_code == 202
        data = response.json()
        assert data["status"] == "transcribed"
        assert data["segments_count"] == 3

    @pytest.mark.asyncio
    async def test_start_success(self, client: AsyncClient, meeting_with_recording: str):
        """Should start transcription in background."""
        # Set status to recording_uploaded
        await client.patch(
            f"/api/v1/meetings/{meeting_with_recording}/status",
            json={"status": "recording_uploaded"},
        )

        with patch("src.routers.transcription.process_transcription"):
            response = await client.post(
                f"/api/v1/transcription/meetings/{meeting_with_recording}/transcribe"
            )
        assert response.status_code == 202
        data = response.json()
        assert data["status"] == "transcribing"
        assert data["segments_count"] == 0
        assert data["duration_seconds"] is None


class TestGetMeetingTranscripts:
    @pytest.mark.asyncio
    async def test_meeting_not_found(self, client: AsyncClient):
        response = await client.get(
            "/api/v1/transcription/meetings/00000000-0000-0000-0000-000000000000/transcripts"
        )
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_empty_transcripts(self, client: AsyncClient, meeting_id: str):
        """Should return empty list if no transcripts."""
        response = await client.get(
            f"/api/v1/transcription/meetings/{meeting_id}/transcripts"
        )
        assert response.status_code == 200
        assert response.json() == []

    @pytest.mark.asyncio
    async def test_get_transcripts(self, client: AsyncClient, meeting_with_transcripts: str):
        """Should return transcript segments ordered by start_time."""
        response = await client.get(
            f"/api/v1/transcription/meetings/{meeting_with_transcripts}/transcripts"
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 3
        assert data[0]["start_time"] == 0.0
        assert data[0]["speaker_name"] == "이상윤"
        assert data[1]["start_time"] == 5.0
        assert data[2]["start_time"] == 10.0


class TestGetMeetingTranscriptText:
    @pytest.mark.asyncio
    async def test_no_transcripts(self, client: AsyncClient, meeting_id: str):
        """Should return 404 if no transcripts found."""
        response = await client.get(
            f"/api/v1/transcription/meetings/{meeting_id}/transcripts/text"
        )
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_with_speakers(self, client: AsyncClient, meeting_with_transcripts: str):
        """Should include speaker labels by default."""
        response = await client.get(
            f"/api/v1/transcription/meetings/{meeting_with_transcripts}/transcripts/text"
        )
        assert response.status_code == 200
        data = response.json()
        assert data["segments_count"] == 3
        assert "[이상윤]" in data["text"]
        assert "[speaker_1]" in data["text"]
        # Third segment has no speaker info, should just have text
        assert "SDK 연동 작업 완료했습니다." in data["text"]

    @pytest.mark.asyncio
    async def test_without_speakers(self, client: AsyncClient, meeting_with_transcripts: str):
        """Should exclude speaker labels when requested."""
        response = await client.get(
            f"/api/v1/transcription/meetings/{meeting_with_transcripts}/transcripts/text",
            params={"include_speakers": "false"},
        )
        assert response.status_code == 200
        data = response.json()
        assert "[이상윤]" not in data["text"]
        assert "[speaker_1]" not in data["text"]
        assert "안녕하세요" in data["text"]
        assert "SDK 연동 작업 완료했습니다." in data["text"]
