"""Tests for transcription API endpoints."""

from contextlib import asynccontextmanager
from unittest.mock import AsyncMock, patch
from uuid import UUID

import pytest
from httpx import AsyncClient
from sqlalchemy import select

from src.models import Meeting, MeetingStatus, Recording, Transcript
from src.routers.transcription import process_transcription
from src.services.stt import STTError, TranscriptionResult, TranscriptSegment


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


class TestProcessTranscription:
    """Tests for the process_transcription background task."""

    @pytest.mark.asyncio
    async def test_successful_transcription(
        self, client: AsyncClient, meeting_with_recording: str, db_session
    ):
        """Should transcribe audio and store segments in DB."""
        meeting_id = UUID(meeting_with_recording)

        # Set status to recording_uploaded
        await client.patch(
            f"/api/v1/meetings/{meeting_with_recording}/status",
            json={"status": "recording_uploaded"},
        )

        # Prepare mock transcription result
        mock_result = TranscriptionResult(
            segments=[
                TranscriptSegment(
                    start_time=0.0,
                    end_time=3.5,
                    text="안녕하세요, 회의를 시작하겠습니다.",
                    speaker_label="speaker_0",
                    confidence=0.95,
                ),
                TranscriptSegment(
                    start_time=4.0,
                    end_time=8.0,
                    text="이번 주 업무 보고 드리겠습니다.",
                    speaker_label="speaker_1",
                    confidence=0.90,
                ),
            ],
            full_text="안녕하세요, 회의를 시작하겠습니다. 이번 주 업무 보고 드리겠습니다.",
            language="ko",
            duration_seconds=8.0,
        )

        # Mock async_session_factory to use test db_session
        @asynccontextmanager
        async def mock_session_factory():
            yield db_session

        with (
            patch("src.routers.transcription.async_session_factory", mock_session_factory),
            patch("src.routers.transcription.STTService") as mock_stt_cls,
        ):
            mock_stt = AsyncMock()
            mock_stt.transcribe_and_store = AsyncMock(return_value=mock_result)
            mock_stt_cls.return_value = mock_stt

            await process_transcription(meeting_id)

        # Verify meeting status was updated to TRANSCRIBED
        result = await db_session.execute(
            select(Meeting).where(Meeting.id == meeting_id)
        )
        meeting = result.scalar_one()
        assert meeting.status == MeetingStatus.TRANSCRIBED

        # Verify transcript segments were stored
        transcript_result = await db_session.execute(
            select(Transcript).where(Transcript.meeting_id == meeting_id)
        )
        transcripts = list(transcript_result.scalars().all())
        assert len(transcripts) == 2
        assert transcripts[0].text == "안녕하세요, 회의를 시작하겠습니다."
        assert transcripts[0].speaker_label == "speaker_0"
        assert transcripts[0].confidence == 0.95
        assert transcripts[1].text == "이번 주 업무 보고 드리겠습니다."

        # Verify recording duration was updated
        result = await db_session.execute(
            select(Recording).where(Recording.meeting_id == meeting_id)
        )
        recording = result.scalar_one()
        assert recording.duration_seconds == 8.0

    @pytest.mark.asyncio
    async def test_meeting_not_found(self, db_session):
        """Should return early if meeting not found."""
        fake_id = UUID("00000000-0000-0000-0000-000000000099")

        @asynccontextmanager
        async def mock_session_factory():
            yield db_session

        with patch("src.routers.transcription.async_session_factory", mock_session_factory):
            # Should not raise, just log and return
            await process_transcription(fake_id)

    @pytest.mark.asyncio
    async def test_no_recording(self, client: AsyncClient, meeting_id: str, db_session):  # noqa: ARG002
        """Should return early if meeting has no recording."""
        mid = UUID(meeting_id)

        @asynccontextmanager
        async def mock_session_factory():
            yield db_session

        with patch("src.routers.transcription.async_session_factory", mock_session_factory):
            # Should not raise, just log and return
            await process_transcription(mid)

        # Meeting status should remain unchanged
        result = await db_session.execute(select(Meeting).where(Meeting.id == mid))
        meeting = result.scalar_one()
        assert meeting.status != MeetingStatus.FAILED

    @pytest.mark.asyncio
    async def test_stt_error_sets_failed_status(
        self, client: AsyncClient, meeting_with_recording: str, db_session
    ):
        """Should set FAILED status when STTError occurs."""
        meeting_id = UUID(meeting_with_recording)

        # Set status to recording_uploaded
        await client.patch(
            f"/api/v1/meetings/{meeting_with_recording}/status",
            json={"status": "recording_uploaded"},
        )

        @asynccontextmanager
        async def mock_session_factory():
            yield db_session

        with (
            patch("src.routers.transcription.async_session_factory", mock_session_factory),
            patch("src.routers.transcription.STTService") as mock_stt_cls,
        ):
            mock_stt = AsyncMock()
            mock_stt.transcribe_and_store = AsyncMock(
                side_effect=STTError("ElevenLabs API error", 500)
            )
            mock_stt_cls.return_value = mock_stt

            await process_transcription(meeting_id)

        # Verify meeting is now FAILED
        result = await db_session.execute(
            select(Meeting).where(Meeting.id == meeting_id)
        )
        meeting = result.scalar_one()
        assert meeting.status == MeetingStatus.FAILED
        assert "STT Error" in meeting.error_message

    @pytest.mark.asyncio
    async def test_unexpected_error_sets_failed_status(
        self, client: AsyncClient, meeting_with_recording: str, db_session
    ):
        """Should set FAILED status when unexpected exception occurs."""
        meeting_id = UUID(meeting_with_recording)

        # Set status to recording_uploaded
        await client.patch(
            f"/api/v1/meetings/{meeting_with_recording}/status",
            json={"status": "recording_uploaded"},
        )

        @asynccontextmanager
        async def mock_session_factory():
            yield db_session

        with (
            patch("src.routers.transcription.async_session_factory", mock_session_factory),
            patch("src.routers.transcription.STTService") as mock_stt_cls,
        ):
            mock_stt = AsyncMock()
            mock_stt.transcribe_and_store = AsyncMock(
                side_effect=RuntimeError("Connection reset")
            )
            mock_stt_cls.return_value = mock_stt

            await process_transcription(meeting_id)

        # Verify meeting is now FAILED with generic message
        result = await db_session.execute(
            select(Meeting).where(Meeting.id == meeting_id)
        )
        meeting = result.scalar_one()
        assert meeting.status == MeetingStatus.FAILED
        assert "Transcription failed" in meeting.error_message
        assert "Connection reset" in meeting.error_message

    @pytest.mark.asyncio
    async def test_recording_duration_not_overwritten(
        self, client: AsyncClient, meeting_id: str, db_session
    ):
        """Should not overwrite recording duration if already set."""
        mid = UUID(meeting_id)

        # Create recording with pre-existing duration
        recording = Recording(
            meeting_id=mid,
            original_filename="test.mp3",
            stored_filename="stored_test.mp3",
            file_path="/tmp/stored_test.mp3",
            file_size=2048,
            mime_type="audio/mpeg",
            duration_seconds=120.0,
        )
        db_session.add(recording)
        await db_session.commit()

        # Set status to recording_uploaded
        await client.patch(
            f"/api/v1/meetings/{meeting_id}/status",
            json={"status": "recording_uploaded"},
        )

        mock_result = TranscriptionResult(
            segments=[
                TranscriptSegment(
                    start_time=0.0,
                    end_time=5.0,
                    text="테스트 발화입니다.",
                    speaker_label="speaker_0",
                    confidence=0.92,
                ),
            ],
            full_text="테스트 발화입니다.",
            language="ko",
            duration_seconds=5.0,
        )

        @asynccontextmanager
        async def mock_session_factory():
            yield db_session

        with (
            patch("src.routers.transcription.async_session_factory", mock_session_factory),
            patch("src.routers.transcription.STTService") as mock_stt_cls,
        ):
            mock_stt = AsyncMock()
            mock_stt.transcribe_and_store = AsyncMock(return_value=mock_result)
            mock_stt_cls.return_value = mock_stt

            await process_transcription(mid)

        # Verify recording duration was NOT overwritten
        result = await db_session.execute(
            select(Recording).where(Recording.meeting_id == mid)
        )
        rec = result.scalar_one()
        assert rec.duration_seconds == 120.0
