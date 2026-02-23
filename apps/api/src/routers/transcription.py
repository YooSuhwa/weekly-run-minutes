"""Transcription API endpoints."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, UploadFile, status
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.lib.database import async_session_factory
from src.lib.dependencies import get_db
from src.lib.logging import get_logger
from src.models import FilteredContent, Meeting, MeetingStatus, MeetingType, Recording, Transcript
from src.services.chat_filter import ChatFilterError, ChatFilterService, TranscriptSegment
from src.services.stt import STTError, STTService
from src.services.transcript_parser import decode_transcript_file, parse_transcript_text
from src.services.weekly_report_parser import WeeklyReportParser

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
            # Get meeting with recording and related data for context
            result = await db.execute(
                select(Meeting)
                .where(Meeting.id == meeting_id)
                .options(
                    selectinload(Meeting.recording),
                    selectinload(Meeting.weekly_report),
                )
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
                await _run_chat_filter(db, meeting, stored_transcripts)

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


def _build_meeting_context(meeting: Meeting) -> str | None:
    """Build meeting context string for chat filtering.

    Args:
        meeting: Meeting object with related data loaded

    Returns:
        Context string for chat filtering, or None if no context available
    """
    context_parts: list[str] = []

    # Add meeting basic info
    context_parts.append(f"회의 제목: {meeting.title}")
    context_parts.append(f"회의 날짜: {meeting.meeting_date}")

    meeting_type = (
        meeting.meeting_type.value
        if isinstance(meeting.meeting_type, MeetingType)
        else meeting.meeting_type
    )

    # For weekly report meetings, include the weekly report summary
    if meeting_type == MeetingType.WEEKLY_REPORT.value and meeting.weekly_report:
        parser = WeeklyReportParser()
        weekly_summary = parser.get_all_members_summary(meeting.weekly_report.parsed_data)
        if weekly_summary:
            context_parts.append("\n## 주간업무록 요약 (업무 관련 키워드 참조용)")
            # Limit to first 2000 chars to avoid token limits
            context_parts.append(weekly_summary[:2000])

    # For general meetings, include agenda if available
    if meeting.agenda_items:
        context_parts.append("\n## 회의 아젠다")
        for i, item in enumerate(meeting.agenda_items, 1):
            title = item.get("title", "")
            description = item.get("description", "")
            context_parts.append(f"{i}. {title}")
            if description:
                context_parts.append(f"   - {description}")

    return "\n".join(context_parts) if context_parts else None


async def _run_chat_filter(
    db: AsyncSession,
    meeting: Meeting,
    transcripts: list[Transcript],
) -> None:
    """Run chat filtering on transcripts and store filtered content.

    Args:
        db: Database session
        meeting: Meeting object with related data
        transcripts: List of transcript segments to filter
    """
    try:
        chat_filter = ChatFilterService()

        # Build meeting context for better filtering
        meeting_context = _build_meeting_context(meeting)

        # Get session-level context from meeting
        context_terms = meeting.context_terms  # List of keywords
        context_instructions = meeting.context_instructions  # Natural language instructions

        logger.info(
            "Running chat filter with context",
            meeting_id=str(meeting.id),
            has_context=meeting_context is not None,
            has_context_terms=bool(context_terms),
            has_context_instructions=bool(context_instructions),
            meeting_type=meeting.meeting_type,
        )

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

        # Run filtering with meeting context and session-level context
        filter_result = await chat_filter.filter_segments(
            filter_segments,
            meeting_context,
            context_terms,
            context_instructions,
        )

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
                meeting_id=meeting.id,
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
            meeting_id=str(meeting.id),
            filtered_count=len(filter_result.filtered),
            work_related_count=len(filter_result.work_related),
        )

    except ChatFilterError as e:
        # Log but don't fail the transcription
        logger.warning(
            "Chat filtering failed, continuing without filtering",
            meeting_id=str(meeting.id),
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

    status_val = (
        meeting.status.value if isinstance(meeting.status, MeetingStatus) else meeting.status
    )

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


MAX_TRANSCRIPT_FILE_SIZE = 5 * 1024 * 1024  # 5MB


async def process_imported_transcript(
    meeting_id: UUID, text: str, enable_chat_filter: bool = True
) -> None:
    """Background task to process an imported transcript text.

    Parses the text into segments, stores them, optionally runs chat filtering,
    and transitions the meeting directly to TRANSCRIBED (skipping STT).

    Args:
        meeting_id: Meeting UUID
        text: Raw transcript text content
        enable_chat_filter: Whether to run chat filtering (default: True)
    """
    async with async_session_factory() as db:
        try:
            result = await db.execute(
                select(Meeting)
                .where(Meeting.id == meeting_id)
                .options(selectinload(Meeting.weekly_report))
            )
            meeting = result.scalar_one_or_none()

            if not meeting:
                logger.error(
                    "Meeting not found for transcript import", meeting_id=str(meeting_id)
                )
                return

            # Update status to transcribing
            meeting.status = MeetingStatus.TRANSCRIBING
            await db.commit()

            # Parse text into segments
            parsed_segments = parse_transcript_text(text)

            # Store transcript segments
            stored_transcripts: list[Transcript] = []
            for segment in parsed_segments:
                transcript = Transcript(
                    meeting_id=meeting_id,
                    start_time=segment.start_time,
                    end_time=segment.end_time,
                    text=segment.text,
                    speaker_label=segment.speaker_label,
                    confidence=None,
                )
                db.add(transcript)
                stored_transcripts.append(transcript)

            # Flush to get IDs for filtering
            await db.flush()

            # Run chat filtering if enabled
            if enable_chat_filter and stored_transcripts:
                await _run_chat_filter(db, meeting, stored_transcripts)

            # Transition directly to TRANSCRIBED (no STT needed)
            meeting.status = MeetingStatus.TRANSCRIBED
            await db.commit()

            logger.info(
                "Transcript import completed",
                meeting_id=str(meeting_id),
                segments=len(parsed_segments),
            )

        except Exception as e:
            logger.exception("Error processing imported transcript", meeting_id=str(meeting_id))
            meeting.status = MeetingStatus.FAILED
            meeting.error_message = f"Transcript import failed: {e}"
            await db.commit()


@router.post(
    "/meetings/{meeting_id}/import-transcript",
    response_model=TranscriptionStatusResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def import_transcript(
    meeting_id: UUID,
    background_tasks: BackgroundTasks,
    db: DB,
    file: UploadFile = File(...),
    enable_chat_filter: bool = True,
) -> dict:
    """Import a pre-transcribed text file (.txt) for a meeting.

    Skips the STT step and directly processes the text into transcript segments.
    The text file is parsed for optional speaker labels and stored as transcript records.

    Args:
        meeting_id: Meeting UUID
        file: .txt file (max 5MB)
        enable_chat_filter: Whether to run chat filtering (default: True)
    """
    # Validate meeting exists
    result = await db.execute(
        select(Meeting)
        .where(Meeting.id == meeting_id)
        .options(
            selectinload(Meeting.recording),
            selectinload(Meeting.transcripts),
        )
    )
    meeting = result.scalar_one_or_none()

    if not meeting:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Meeting not found",
        )

    # Audio recording and script import are mutually exclusive
    if meeting.recording:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Meeting already has a recording. Audio and script import are mutually exclusive.",
        )

    # Check for existing transcripts (allow retry if FAILED)
    status_val = (
        meeting.status.value if isinstance(meeting.status, MeetingStatus) else meeting.status
    )
    if meeting.transcripts and status_val != "failed":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Meeting already has transcripts. Delete existing transcripts before re-importing.",
        )

    if status_val == "transcribing":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Transcription already in progress",
        )

    # Validate file
    if not file.filename or not file.filename.lower().endswith(".txt"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only .txt files are supported",
        )

    content = await file.read()

    if len(content) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File is empty",
        )

    if len(content) > MAX_TRANSCRIPT_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File exceeds maximum size of {MAX_TRANSCRIPT_FILE_SIZE // (1024 * 1024)}MB",
        )

    # Decode file content
    try:
        text = decode_transcript_file(content)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

    # Start background processing
    background_tasks.add_task(process_imported_transcript, meeting_id, text, enable_chat_filter)

    return {
        "meeting_id": meeting_id,
        "status": "transcribing",
        "segments_count": 0,
        "duration_seconds": None,
        "error_message": None,
    }
