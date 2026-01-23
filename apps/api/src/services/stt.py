"""Speech-to-Text service using ElevenLabs API."""

from dataclasses import dataclass
from pathlib import Path

import httpx
from tenacity import retry, stop_after_attempt, wait_exponential

from src.lib.config import settings
from src.lib.logging import get_logger

logger = get_logger(__name__)


class STTError(Exception):
    """STT processing error."""

    def __init__(self, message: str, status_code: int | None = None) -> None:
        super().__init__(message)
        self.status_code = status_code


@dataclass
class TranscriptSegment:
    """A segment of transcribed speech."""

    start_time: float  # seconds
    end_time: float  # seconds
    text: str
    speaker_label: str | None = None
    confidence: float | None = None


@dataclass
class TranscriptionResult:
    """Result from STT processing."""

    segments: list[TranscriptSegment]
    full_text: str
    language: str
    duration_seconds: float


class STTService:
    """Speech-to-Text service using ElevenLabs API.

    Uses ElevenLabs' speech-to-text endpoint for Korean language support.
    """

    API_URL = "https://api.elevenlabs.io/v1/speech-to-text"

    def __init__(self) -> None:
        self.api_key = settings.ELEVENLABS_API_KEY
        if not self.api_key:
            raise ValueError("ELEVENLABS_API_KEY is not configured")

    def _get_headers(self) -> dict[str, str]:
        """Get API request headers."""
        return {
            "xi-api-key": self.api_key,
        }

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=30),
        reraise=True,
    )
    async def transcribe_file(
        self,
        file_path: str | Path,
        language_code: str = "ko",
    ) -> TranscriptionResult:
        """Transcribe an audio file.

        Args:
            file_path: Path to the audio file
            language_code: Language code (default: "ko" for Korean)

        Returns:
            TranscriptionResult with segments and full text
        """
        file_path = Path(file_path)
        if not file_path.exists():
            raise STTError(f"Audio file not found: {file_path}")

        logger.info(
            "Starting transcription",
            file=str(file_path),
            language=language_code,
        )

        # Read file content
        with open(file_path, "rb") as f:
            file_content = f.read()

        # Prepare multipart form data
        files = {
            "audio": (file_path.name, file_content, self._get_mime_type(file_path)),
        }

        data = {
            "model_id": "scribe_v1",  # ElevenLabs Scribe model
            "language_code": language_code,
            "diarize": "true",  # Enable speaker diarization
            "tag_audio_events": "false",
            "timestamps_granularity": "segment",  # Get segment-level timestamps
        }

        async with httpx.AsyncClient(timeout=600.0) as client:  # 10 min timeout for long files
            response = await client.post(
                self.API_URL,
                headers=self._get_headers(),
                files=files,
                data=data,
            )

            if response.status_code != 200:
                error_detail = response.text
                logger.error(
                    "STT API error",
                    status_code=response.status_code,
                    detail=error_detail,
                )
                raise STTError(f"STT API error: {error_detail}", response.status_code)

            result = response.json()

        # Parse response into our format
        return self._parse_response(result)

    def _parse_response(self, response: dict) -> TranscriptionResult:
        """Parse ElevenLabs API response into TranscriptionResult."""
        segments: list[TranscriptSegment] = []

        # Parse words/segments from response
        words = response.get("words", [])
        full_text = response.get("text", "")
        language = response.get("language_code", "ko")

        # Group words into segments by speaker and timing gaps
        current_segment_words: list[dict] = []
        current_speaker: str | None = None
        last_end_time = 0.0

        for word in words:
            word_speaker = word.get("speaker_id")
            start_time = word.get("start", 0)

            # Start new segment on speaker change or significant gap (> 2 seconds)
            if current_segment_words and (
                word_speaker != current_speaker or start_time - last_end_time > 2.0
            ):
                segments.append(self._create_segment(current_segment_words, current_speaker))
                current_segment_words = []

            current_segment_words.append(word)
            current_speaker = word_speaker
            last_end_time = word.get("end", start_time)

        # Don't forget the last segment
        if current_segment_words:
            segments.append(self._create_segment(current_segment_words, current_speaker))

        # Calculate total duration
        duration = words[-1].get("end", 0) if words else 0

        logger.info(
            "Transcription completed",
            segments=len(segments),
            duration_seconds=duration,
        )

        return TranscriptionResult(
            segments=segments,
            full_text=full_text,
            language=language,
            duration_seconds=duration,
        )

    def _create_segment(self, words: list[dict], speaker: str | None) -> TranscriptSegment:
        """Create a transcript segment from a list of words."""
        text = " ".join(w.get("text", "") for w in words)
        start_time = words[0].get("start", 0) if words else 0
        end_time = words[-1].get("end", 0) if words else 0

        return TranscriptSegment(
            start_time=start_time,
            end_time=end_time,
            text=text.strip(),
            speaker_label=speaker,
        )

    def _get_mime_type(self, file_path: Path) -> str:
        """Get MIME type for audio file."""
        ext = file_path.suffix.lower()
        mime_types = {
            ".mp3": "audio/mpeg",
            ".wav": "audio/wav",
            ".webm": "audio/webm",
            ".ogg": "audio/ogg",
            ".m4a": "audio/m4a",
            ".aac": "audio/aac",
            ".flac": "audio/flac",
        }
        return mime_types.get(ext, "audio/mpeg")

    async def transcribe_and_store(
        self,
        file_path: str | Path,
        meeting_id: str,
        language_code: str = "ko",
    ) -> TranscriptionResult:
        """Transcribe audio and return result for database storage.

        This is a convenience method that handles the full transcription
        workflow including error handling and logging.

        Args:
            file_path: Path to audio file
            meeting_id: Meeting ID for logging
            language_code: Language code

        Returns:
            TranscriptionResult ready for database storage
        """
        logger.info(
            "Starting STT processing",
            meeting_id=meeting_id,
            file_path=str(file_path),
        )

        try:
            result = await self.transcribe_file(file_path, language_code)
            logger.info(
                "STT processing completed",
                meeting_id=meeting_id,
                segments=len(result.segments),
                duration=result.duration_seconds,
            )
            return result
        except STTError:
            raise
        except Exception as e:
            logger.exception("Unexpected STT error", meeting_id=meeting_id)
            raise STTError(f"Unexpected error during transcription: {e}")
