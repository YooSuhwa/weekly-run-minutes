"""Transcription API endpoints."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.lib.database import async_session_factory
from src.lib.dependencies import get_db
from src.lib.logging import get_logger
from src.models import Meeting, MeetingStatus, Transcript
from src.services.stt import STTError, STTService

logger = get_logger(__name__)
router = APIRouter()

# Dependency type alias
DB = Annotated[AsyncSession, Depends(get_db)]


class TranscriptSegmentResponse(BaseModel):
    """Transcript segment response."""

    id: UUID
    start_time: float
    end_time: float
    text: str
    speaker_label: str | None
    speaker_name: str | None
    confidence: float | None

    model_config = ConfigDict(from_attributes=True)


class TranscriptionStatusResponse(BaseModel):
    """Transcription status response."""

    meeting_id: UUID
    status: str
    segments_count: int
    duration_seconds: float | None
    error_message: str | None


async def process_transcription(meeting_id: UUID) -> None:
    """Background task to process transcription.

    This runs asynchronously after the API returns.
    """
    async with async_session_factory() as db:
        try:
            # Get meeting with recording
            result = await db.execute(
                select(Meeting)
                .where(Meeting.id == meeting_id)
                .options(selectinload(Meeting.recording))
            )
            meeting = result.scalar_one_or_none()

            if not meeting or not meeting.recording:
                logger.error(
                    "Meeting or recording not found for transcription", meeting_id=str(meeting_id)
                )
                return

            # Update status to transcribing
            meeting.status = MeetingStatus.TRANSCRIBING
            await db.commit()

            # Run STT
            stt_service = STTService()
            transcription_result = await stt_service.transcribe_and_store(
                file_path=meeting.recording.file_path,
                meeting_id=str(meeting_id),
            )

            # Store transcript segments
            for segment in transcription_result.segments:
                transcript = Transcript(
                    meeting_id=meeting_id,
                    start_time=segment.start_time,
                    end_time=segment.end_time,
                    text=segment.text,
                    speaker_label=segment.speaker_label,
                    confidence=segment.confidence,
                )
                db.add(transcript)

            # Update recording duration if not set
            if meeting.recording.duration_seconds is None:
                meeting.recording.duration_seconds = transcription_result.duration_seconds

            # Update meeting status
            meeting.status = MeetingStatus.TRANSCRIBED
            await db.commit()

            logger.info(
                "Transcription completed",
                meeting_id=str(meeting_id),
                segments=len(transcription_result.segments),
            )

        except STTError as e:
            logger.exception("STT error during transcription", meeting_id=str(meeting_id))
            meeting.status = MeetingStatus.FAILED
            meeting.error_message = f"STT Error: {e}"
            await db.commit()

        except Exception as e:
            logger.exception("Unexpected error during transcription", meeting_id=str(meeting_id))
            meeting.status = MeetingStatus.FAILED
            meeting.error_message = f"Transcription failed: {e}"
            await db.commit()


@router.post(
    "/meetings/{meeting_id}/transcribe",
    response_model=TranscriptionStatusResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def start_transcription(
    meeting_id: UUID,
    background_tasks: BackgroundTasks,
    db: DB,
) -> dict:
    """Start transcription processing for a meeting.

    This endpoint triggers STT processing in the background.
    Use GET /meetings/{meeting_id}/progress to poll for status.
    """
    # Get meeting with recording
    result = await db.execute(
        select(Meeting).where(Meeting.id == meeting_id).options(selectinload(Meeting.recording))
    )
    meeting = result.scalar_one_or_none()

    if not meeting:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Meeting not found",
        )

    if not meeting.recording:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No recording uploaded for this meeting",
        )

    status_val = meeting.status.value if isinstance(meeting.status, MeetingStatus) else meeting.status

    if status_val == "transcribing":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Transcription already in progress",
        )

    already_done = {"transcribed", "generating_minutes", "draft_ready", "published"}
    if status_val in already_done:
        # Already transcribed - return existing data
        transcript_result = await db.execute(
            select(Transcript).where(Transcript.meeting_id == meeting_id)
        )
        transcripts = list(transcript_result.scalars().all())
        return {
            "meeting_id": meeting_id,
            "status": status_val,
            "segments_count": len(transcripts),
            "duration_seconds": meeting.recording.duration_seconds,
            "error_message": None,
        }

    # Start background processing
    background_tasks.add_task(process_transcription, meeting_id)

    return {
        "meeting_id": meeting_id,
        "status": "transcribing",
        "segments_count": 0,
        "duration_seconds": None,
        "error_message": None,
    }


@router.get(
    "/meetings/{meeting_id}/transcripts",
    response_model=list[TranscriptSegmentResponse],
)
async def get_meeting_transcripts(
    meeting_id: UUID,
    db: DB,
) -> list[Transcript]:
    """Get all transcript segments for a meeting."""
    # Verify meeting exists
    meeting_result = await db.execute(select(Meeting).where(Meeting.id == meeting_id))
    if not meeting_result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Meeting not found",
        )

    result = await db.execute(
        select(Transcript)
        .where(Transcript.meeting_id == meeting_id)
        .order_by(Transcript.start_time)
    )
    return list(result.scalars().all())


@router.get("/meetings/{meeting_id}/transcripts/text")
async def get_meeting_transcript_text(
    meeting_id: UUID,
    db: DB,
    include_speakers: bool = True,
) -> dict:
    """Get full transcript as plain text.

    Args:
        meeting_id: Meeting ID
        include_speakers: Include speaker labels in output
    """
    result = await db.execute(
        select(Transcript)
        .where(Transcript.meeting_id == meeting_id)
        .order_by(Transcript.start_time)
    )
    transcripts = list(result.scalars().all())

    if not transcripts:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No transcripts found for this meeting",
        )

    # Build text output
    lines = []
    for t in transcripts:
        if include_speakers and (t.speaker_label or t.speaker_name):
            speaker = t.speaker_name or t.speaker_label
            lines.append(f"[{speaker}] {t.text}")
        else:
            lines.append(t.text)

    return {
        "meeting_id": str(meeting_id),
        "segments_count": len(transcripts),
        "text": "\n".join(lines),
    }
