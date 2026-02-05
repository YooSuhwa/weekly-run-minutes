"""Recording upload API endpoints."""

import os
from datetime import datetime
from pathlib import Path
from typing import Annotated
from uuid import UUID, uuid4

import aiofiles
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.lib.config import settings
from src.lib.dependencies import get_db
from src.lib.logging import get_logger
from src.models import Meeting, MeetingMode, MeetingStatus, Recording
from src.models.recording import RecordingSource

logger = get_logger(__name__)
router = APIRouter()

# Dependency type alias
DB = Annotated[AsyncSession, Depends(get_db)]

# Allowed audio MIME types
ALLOWED_AUDIO_TYPES = {
    "audio/mpeg",  # MP3
    "audio/mp3",
    "audio/wav",
    "audio/wave",
    "audio/x-wav",
    "audio/webm",
    "audio/ogg",
    "audio/m4a",
    "audio/x-m4a",
    "audio/mp4",
    "audio/aac",
    "audio/flac",
}


class RecordingResponse(BaseModel):
    """Recording response model."""

    id: UUID
    meeting_id: UUID
    original_filename: str
    stored_filename: str
    file_size: int
    mime_type: str
    duration_seconds: float | None
    source: str

    model_config = ConfigDict(from_attributes=True)


def get_upload_dir() -> Path:
    """Get the upload directory, creating it if necessary."""
    upload_dir = Path(settings.UPLOAD_DIR)
    upload_dir.mkdir(parents=True, exist_ok=True)
    return upload_dir


def generate_stored_filename(original_filename: str, meeting_id: UUID) -> str:
    """Generate a unique filename for storage."""
    ext = Path(original_filename).suffix.lower()
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    unique_id = uuid4().hex[:8]
    return f"{meeting_id}_{timestamp}_{unique_id}{ext}"


@router.post(
    "/meetings/{meeting_id}/recording",
    response_model=RecordingResponse,
    status_code=status.HTTP_201_CREATED,
)
async def upload_recording(
    meeting_id: UUID,
    db: DB,
    file: UploadFile = File(...),
    source: str = Form(default=RecordingSource.UPLOAD),
) -> Recording:
    """Upload a recording file for a meeting.

    Max file size: 100MB
    Supported formats: MP3, WAV, WebM, OGG, M4A, AAC, FLAC
    """
    # Verify meeting exists
    result = await db.execute(select(Meeting).where(Meeting.id == meeting_id))
    meeting = result.scalar_one_or_none()
    if not meeting:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Meeting not found",
        )

    # Check if recording already exists
    existing = await db.execute(select(Recording).where(Recording.meeting_id == meeting_id))
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Recording already uploaded for this meeting. Delete it first to upload a new one.",
        )

    # Validate file type
    content_type = file.content_type or "application/octet-stream"
    if content_type not in ALLOWED_AUDIO_TYPES:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Unsupported audio format: {content_type}. Supported: MP3, WAV, WebM, OGG, M4A, AAC, FLAC",
        )

    # Read file content and check size
    content = await file.read()
    file_size = len(content)

    if file_size > settings.MAX_FILE_SIZE:
        max_mb = settings.MAX_FILE_SIZE // (1024 * 1024)
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File too large. Maximum size is {max_mb}MB",
        )

    if file_size == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Empty file uploaded",
        )

    # Generate stored filename and path
    original_filename = file.filename or "recording.mp3"
    stored_filename = generate_stored_filename(original_filename, meeting_id)
    upload_dir = get_upload_dir()
    file_path = upload_dir / stored_filename

    # Save file asynchronously
    try:
        async with aiofiles.open(file_path, "wb") as f:
            await f.write(content)
    except OSError as e:
        logger.exception("Failed to save recording file", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to save recording file",
        )

    # Validate source
    source_val = source if isinstance(source, str) else source.value
    if source_val not in (RecordingSource.UPLOAD, RecordingSource.BROWSER):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid source: {source_val}. Must be 'upload' or 'browser'",
        )

    # Create recording record
    recording = Recording(
        meeting_id=meeting_id,
        original_filename=original_filename,
        stored_filename=stored_filename,
        file_path=str(file_path),
        file_size=file_size,
        mime_type=content_type,
        source=source_val,
    )
    db.add(recording)

    # Update meeting status (only for upload mode)
    # For realtime mode, the meeting is already at RECORDING_DONE
    mode_val = (
        meeting.meeting_mode
        if isinstance(meeting.meeting_mode, str)
        else meeting.meeting_mode.value
    )
    if mode_val == MeetingMode.UPLOAD:
        meeting.status = MeetingStatus.RECORDING_UPLOADED

    await db.commit()
    await db.refresh(recording)

    logger.info(
        "Recording uploaded",
        meeting_id=str(meeting_id),
        filename=original_filename,
        size_mb=round(file_size / (1024 * 1024), 2),
    )

    return recording


@router.get("/meetings/{meeting_id}/recording", response_model=RecordingResponse)
async def get_meeting_recording(
    meeting_id: UUID,
    db: DB,
) -> Recording:
    """Get recording info for a meeting."""
    result = await db.execute(select(Recording).where(Recording.meeting_id == meeting_id))
    recording = result.scalar_one_or_none()
    if not recording:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Recording not found for this meeting",
        )
    return recording


@router.delete(
    "/meetings/{meeting_id}/recording",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_meeting_recording(
    meeting_id: UUID,
    db: DB,
) -> None:
    """Delete a recording from a meeting."""
    result = await db.execute(select(Recording).where(Recording.meeting_id == meeting_id))
    recording = result.scalar_one_or_none()
    if not recording:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Recording not found for this meeting",
        )

    # Delete file from disk
    file_path = Path(recording.file_path)
    if file_path.exists():
        try:
            os.remove(file_path)
        except OSError as e:
            logger.warning("Failed to delete recording file", error=str(e), path=str(file_path))

    # Delete database record
    await db.delete(recording)

    # Update meeting status if needed (only for upload mode)
    meeting_result = await db.execute(select(Meeting).where(Meeting.id == meeting_id))
    meeting = meeting_result.scalar_one_or_none()
    if meeting and meeting.status == MeetingStatus.RECORDING_UPLOADED:
        mode_val = (
            meeting.meeting_mode
            if isinstance(meeting.meeting_mode, str)
            else meeting.meeting_mode.value
        )
        if mode_val == MeetingMode.UPLOAD:
            meeting.status = MeetingStatus.WEEKLY_REPORT_LOADED

    await db.commit()

    logger.info("Recording deleted", meeting_id=str(meeting_id))
