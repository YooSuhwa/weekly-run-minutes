"""Meeting API endpoints."""

from datetime import date
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.lib.dependencies import get_db
from src.models import Meeting, MeetingStatus
from src.schemas.meeting import (
    MeetingCreate,
    MeetingResponse,
    MeetingStatusUpdate,
    MeetingWithDetails,
)

# Dependency type alias
DB = Annotated[AsyncSession, Depends(get_db)]

router = APIRouter()


@router.get("", response_model=list[MeetingResponse])
async def list_meetings(
    db: DB,
    team_id: UUID | None = Query(None),
    status_filter: MeetingStatus | None = Query(None, alias="status"),
    from_date: date | None = Query(None),
    to_date: date | None = Query(None),
) -> list[Meeting]:
    """List meetings with optional filters."""
    query = select(Meeting).order_by(Meeting.meeting_date.desc())

    if team_id:
        query = query.where(Meeting.team_id == team_id)
    if status_filter:
        query = query.where(Meeting.status == status_filter)
    if from_date:
        query = query.where(Meeting.meeting_date >= from_date)
    if to_date:
        query = query.where(Meeting.meeting_date <= to_date)

    result = await db.execute(query)
    return list(result.scalars().all())


@router.post("", response_model=MeetingResponse, status_code=status.HTTP_201_CREATED)
async def create_meeting(
    data: MeetingCreate,
    db: DB,
) -> Meeting:
    """Create a new meeting."""
    meeting = Meeting(
        team_id=data.team_id,
        meeting_date=data.meeting_date,
        title=data.title,
        status=MeetingStatus.CREATED,
    )
    db.add(meeting)
    await db.commit()
    await db.refresh(meeting)
    return meeting


@router.get("/{meeting_id}", response_model=MeetingWithDetails)
async def get_meeting(
    meeting_id: UUID,
    db: DB,
) -> Meeting:
    """Get a meeting by ID with all related data."""
    result = await db.execute(
        select(Meeting)
        .where(Meeting.id == meeting_id)
        .options(
            selectinload(Meeting.recording),
            selectinload(Meeting.weekly_report),
            selectinload(Meeting.minutes),
        )
    )
    meeting = result.scalar_one_or_none()
    if not meeting:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Meeting not found",
        )
    return meeting


@router.patch("/{meeting_id}/status", response_model=MeetingResponse)
async def update_meeting_status(
    meeting_id: UUID,
    data: MeetingStatusUpdate,
    db: DB,
) -> Meeting:
    """Update meeting status."""
    result = await db.execute(select(Meeting).where(Meeting.id == meeting_id))
    meeting = result.scalar_one_or_none()
    if not meeting:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Meeting not found",
        )

    meeting.status = data.status
    if data.error_message:
        meeting.error_message = data.error_message

    await db.commit()
    await db.refresh(meeting)
    return meeting


@router.delete("/{meeting_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_meeting(
    meeting_id: UUID,
    db: DB,
) -> None:
    """Delete a meeting and all related data."""
    result = await db.execute(select(Meeting).where(Meeting.id == meeting_id))
    meeting = result.scalar_one_or_none()
    if not meeting:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Meeting not found",
        )
    await db.delete(meeting)
    await db.commit()


@router.get("/{meeting_id}/progress", response_model=dict)
async def get_meeting_progress(
    meeting_id: UUID,
    db: DB,
) -> dict:
    """Get meeting processing progress for polling."""
    result = await db.execute(
        select(Meeting)
        .where(Meeting.id == meeting_id)
        .options(
            selectinload(Meeting.recording),
            selectinload(Meeting.weekly_report),
            selectinload(Meeting.minutes),
        )
    )
    meeting = result.scalar_one_or_none()
    if not meeting:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Meeting not found",
        )

    status_val = meeting.status.value if isinstance(meeting.status, MeetingStatus) else meeting.status

    return {
        "meeting_id": str(meeting.id),
        "status": status_val,
        "error_message": meeting.error_message,
        "has_recording": meeting.recording is not None,
        "has_weekly_report": meeting.weekly_report is not None,
        "has_minutes": meeting.minutes is not None,
        "steps": {
            "created": True,
            "weekly_report_loaded": status_val
            in [
                "weekly_report_loaded",
                "recording_uploaded",
                "transcribing",
                "transcribed",
                "generating_minutes",
                "draft_ready",
                "published",
            ],
            "recording_uploaded": status_val
            in [
                "recording_uploaded",
                "transcribing",
                "transcribed",
                "generating_minutes",
                "draft_ready",
                "published",
            ],
            "transcribing": status_val == "transcribing",
            "transcribed": status_val
            in ["transcribed", "generating_minutes", "draft_ready", "published"],
            "generating_minutes": status_val == "generating_minutes",
            "draft_ready": status_val in ["draft_ready", "published"],
            "published": status_val == "published",
            "failed": status_val == "failed",
        },
    }
