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
from src.models import FilteredContent, Meeting, MeetingStatus, Transcript
from src.services.chat_filter import ChatFilterError, ChatFilterService, TranscriptSegment
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


async def process_transcription(meeting_id: UUID, enable_chat_filter: bool = True) -> None:
    """Background task to process transcription.

    This runs asynchronously after the API returns.
    After STT, runs chat filtering to remove casual talk.

    Args:
        meeting_id: Meeting UUID
        enable_chat_filter: Whether to run chat filtering (default: True)
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

            # Store transcript segments and prepare for filtering
            stored_transcripts: list[Transcript] = []
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
                stored_transcripts.append(transcript)

            # Flush to get IDs for filtering
            await db.flush()

            # Update recording duration if not set
            if meeting.recording.duration_seconds is None:
                meeting.recording.duration_seconds = transcription_result.duration_seconds

            # Run chat filtering if enabled
            if enable_chat_filter and stored_transcripts:
                await _run_chat_filter(db, meeting_id, stored_transcripts)

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


async def _run_chat_filter(
    db: AsyncSession,
    meeting_id: UUID,
    transcripts: list[Transcript],
) -> None:
    """Run chat filtering on transcripts and store filtered content.

    Args:
        db: Database session
        meeting_id: Meeting UUID
        transcripts: List of transcript segments to filter
    """
    try:
        chat_filter = ChatFilterService()

        # Convert transcripts to filter segments
        filter_segments = [
            TranscriptSegment(
                id=str(t.id),
                text=t.text,
                speaker_label=t.speaker_label,
                speaker_name=t.speaker_name,
                start_time=t.start_time,
                end_time=t.end_time,
            )
            for t in transcripts
        ]

        # Run filtering
        filter_result = await chat_filter.filter_segments(filter_segments)

        # Store filtered content
        transcript_map = {str(t.id): t for t in transcripts}

        for filtered_item in filter_result.filtered:
            # Only store if confidence is high enough
            if not chat_filter.should_filter(filtered_item, threshold=0.7):
                continue

            transcript = transcript_map.get(filtered_item.segment_id)
            if not transcript:
                continue

            filtered_content = FilteredContent(
                meeting_id=meeting_id,
                content=transcript.text,
                filter_reason=filtered_item.filter_reason or "casual_talk",
                confidence=filtered_item.confidence,
                speaker_label=transcript.speaker_label,
                speaker_name=transcript.speaker_name,
                start_time=transcript.start_time,
                end_time=transcript.end_time,
            )
            db.add(filtered_content)

            # Remove the transcript (it's now in filtered_contents)
            await db.delete(transcript)

        logger.info(
            "Chat filtering completed",
            meeting_id=str(meeting_id),
            filtered_count=len(filter_result.filtered),
            work_related_count=len(filter_result.work_related),
        )

    except ChatFilterError as e:
        # Log but don't fail the transcription
        logger.warning(
            "Chat filtering failed, continuing without filtering",
            meeting_id=str(meeting_id),
            error=str(e),
        )


class TranscriptionRequest(BaseModel):
    """Request body for transcription."""

    enable_chat_filter: bool = True


@router.post(
    "/meetings/{meeting_id}/transcribe",
    response_model=TranscriptionStatusResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def start_transcription(
    meeting_id: UUID,
    background_tasks: BackgroundTasks,
    db: DB,
    request: TranscriptionRequest | None = None,
) -> dict:
    """Start transcription processing for a meeting.

    This endpoint triggers STT processing in the background.
    After STT, runs chat filtering to remove casual talk (can be disabled).
    Use GET /meetings/{meeting_id}/progress to poll for status.

    Args:
        meeting_id: Meeting UUID
        request: Optional request body with enable_chat_filter flag
    """
    enable_chat_filter = request.enable_chat_filter if request else True
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
    background_tasks.add_task(process_transcription, meeting_id, enable_chat_filter)

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
