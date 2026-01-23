"""Tests for STT service."""

from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from src.services.stt import STTError, STTService, TranscriptionResult, TranscriptSegment


class TestSTTServiceInit:
    """Tests for STTService initialization."""

    @patch("src.services.stt.settings")
    def test_init_with_api_key(self, mock_settings):
        mock_settings.ELEVENLABS_API_KEY = "test-key"
        service = STTService()
        assert service.api_key == "test-key"

    @patch("src.services.stt.settings")
    def test_init_without_api_key_raises(self, mock_settings):
        mock_settings.ELEVENLABS_API_KEY = ""
        with pytest.raises(ValueError, match="ELEVENLABS_API_KEY"):
            STTService()


class TestSTTServiceMimeType:
    """Tests for MIME type detection."""

    def setup_method(self, _method):
        with patch("src.services.stt.settings") as ms:
            ms.ELEVENLABS_API_KEY = "test-key"
            self.service = STTService()

    def test_mp3_mime_type(self):
        assert self.service._get_mime_type(Path("test.mp3")) == "audio/mpeg"

    def test_wav_mime_type(self):
        assert self.service._get_mime_type(Path("test.wav")) == "audio/wav"

    def test_webm_mime_type(self):
        assert self.service._get_mime_type(Path("test.webm")) == "audio/webm"

    def test_ogg_mime_type(self):
        assert self.service._get_mime_type(Path("test.ogg")) == "audio/ogg"

    def test_m4a_mime_type(self):
        assert self.service._get_mime_type(Path("test.m4a")) == "audio/m4a"

    def test_aac_mime_type(self):
        assert self.service._get_mime_type(Path("test.aac")) == "audio/aac"

    def test_flac_mime_type(self):
        assert self.service._get_mime_type(Path("test.flac")) == "audio/flac"

    def test_unknown_format_defaults_to_mpeg(self):
        assert self.service._get_mime_type(Path("test.xyz")) == "audio/mpeg"


class TestSTTServiceParseResponse:
    """Tests for response parsing."""

    def setup_method(self, _method):
        with patch("src.services.stt.settings") as ms:
            ms.ELEVENLABS_API_KEY = "test-key"
            self.service = STTService()

    def test_parse_empty_response(self):
        response = {"words": [], "text": "", "language_code": "ko"}
        result = self.service._parse_response(response)
        assert result.segments == []
        assert result.full_text == ""
        assert result.language == "ko"
        assert result.duration_seconds == 0

    def test_parse_single_word(self):
        response = {
            "words": [
                {"text": "안녕하세요", "start": 0.0, "end": 1.0, "speaker_id": "speaker_0"}
            ],
            "text": "안녕하세요",
            "language_code": "ko",
        }
        result = self.service._parse_response(response)
        assert len(result.segments) == 1
        assert result.segments[0].text == "안녕하세요"
        assert result.segments[0].start_time == 0.0
        assert result.segments[0].end_time == 1.0
        assert result.segments[0].speaker_label == "speaker_0"

    def test_parse_multiple_words_same_speaker(self):
        response = {
            "words": [
                {"text": "안녕", "start": 0.0, "end": 0.5, "speaker_id": "speaker_0"},
                {"text": "하세요", "start": 0.5, "end": 1.0, "speaker_id": "speaker_0"},
            ],
            "text": "안녕 하세요",
            "language_code": "ko",
        }
        result = self.service._parse_response(response)
        assert len(result.segments) == 1
        assert result.segments[0].text == "안녕 하세요"

    def test_parse_speaker_change_creates_new_segment(self):
        response = {
            "words": [
                {"text": "발표자1", "start": 0.0, "end": 1.0, "speaker_id": "speaker_0"},
                {"text": "발표자2", "start": 1.1, "end": 2.0, "speaker_id": "speaker_1"},
            ],
            "text": "발표자1 발표자2",
            "language_code": "ko",
        }
        result = self.service._parse_response(response)
        assert len(result.segments) == 2
        assert result.segments[0].speaker_label == "speaker_0"
        assert result.segments[1].speaker_label == "speaker_1"

    def test_parse_time_gap_creates_new_segment(self):
        """Gap > 2 seconds should start a new segment."""
        response = {
            "words": [
                {"text": "첫번째", "start": 0.0, "end": 1.0, "speaker_id": "speaker_0"},
                {"text": "두번째", "start": 5.0, "end": 6.0, "speaker_id": "speaker_0"},
            ],
            "text": "첫번째 두번째",
            "language_code": "ko",
        }
        result = self.service._parse_response(response)
        assert len(result.segments) == 2

    def test_parse_duration_from_last_word(self):
        response = {
            "words": [
                {"text": "word1", "start": 0.0, "end": 1.0, "speaker_id": "s0"},
                {"text": "word2", "start": 58.0, "end": 60.0, "speaker_id": "s0"},
            ],
            "text": "word1 word2",
            "language_code": "ko",
        }
        result = self.service._parse_response(response)
        assert result.duration_seconds == 60.0


class TestSTTServiceTranscribe:
    """Tests for the transcribe_file method."""

    def setup_method(self, _method):
        with patch("src.services.stt.settings") as ms:
            ms.ELEVENLABS_API_KEY = "test-key"
            self.service = STTService()

    @pytest.mark.asyncio
    async def test_file_not_found_raises_error(self):
        with pytest.raises(STTError, match="not found"):
            await self.service.transcribe_file("/nonexistent/file.mp3")

    @pytest.mark.asyncio
    async def test_api_error_raises_stt_error(self, tmp_path):
        audio_file = tmp_path / "test.mp3"
        audio_file.write_bytes(b"fake audio data")

        mock_response = MagicMock()
        mock_response.status_code = 500
        mock_response.text = "Internal Server Error"

        with patch("httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client.post = AsyncMock(return_value=mock_response)
            mock_client_cls.return_value = mock_client

            with pytest.raises(STTError, match="STT API error"):
                await self.service.transcribe_file(str(audio_file))

    @pytest.mark.asyncio
    async def test_successful_transcription(self, tmp_path):
        audio_file = tmp_path / "test.mp3"
        audio_file.write_bytes(b"fake audio data")

        api_response = {
            "words": [
                {"text": "안녕하세요", "start": 0.0, "end": 1.5, "speaker_id": "speaker_0"},
                {"text": "오늘", "start": 1.6, "end": 2.0, "speaker_id": "speaker_0"},
            ],
            "text": "안녕하세요 오늘",
            "language_code": "ko",
        }

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = api_response

        with patch("httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client.post = AsyncMock(return_value=mock_response)
            mock_client_cls.return_value = mock_client

            result = await self.service.transcribe_file(str(audio_file))

            assert isinstance(result, TranscriptionResult)
            assert len(result.segments) == 1
            assert result.full_text == "안녕하세요 오늘"
            assert result.language == "ko"


class TestSTTServiceTranscribeAndStore:
    """Tests for the transcribe_and_store convenience method."""

    def setup_method(self, _method):
        with patch("src.services.stt.settings") as ms:
            ms.ELEVENLABS_API_KEY = "test-key"
            self.service = STTService()

    @pytest.mark.asyncio
    async def test_transcribe_and_store_success(self):
        mock_result = TranscriptionResult(
            segments=[TranscriptSegment(start_time=0, end_time=1, text="test")],
            full_text="test",
            language="ko",
            duration_seconds=1.0,
        )

        with patch.object(self.service, "transcribe_file", return_value=mock_result):
            result = await self.service.transcribe_and_store("/fake/path.mp3", "meeting-1")
            assert result == mock_result

    @pytest.mark.asyncio
    async def test_transcribe_and_store_stt_error_reraises(self):
        with patch.object(
            self.service, "transcribe_file", side_effect=STTError("API failed")
        ), pytest.raises(STTError, match="API failed"):
            await self.service.transcribe_and_store("/fake/path.mp3", "meeting-1")

    @pytest.mark.asyncio
    async def test_transcribe_and_store_unexpected_error(self):
        with patch.object(
            self.service, "transcribe_file", side_effect=RuntimeError("unexpected")
        ), pytest.raises(STTError, match="Unexpected error"):
            await self.service.transcribe_and_store("/fake/path.mp3", "meeting-1")
