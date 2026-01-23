"""Realtime meeting orchestration API endpoints."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.lib.dependencies import get_db
from src.lib.logging import get_logger
from src.models import Meeting, MeetingMode, MeetingStatus
from src.models.team import Team
from src.services.meeting_state import InvalidTransitionError, MeetingStateMachine
from src.services.question_tree import QuestionTree, QuestionTreeService
from src.services.weekly_report_parser import WeeklyReportParser

logger = get_logger(__name__)
router = APIRouter()

DB = Annotated[AsyncSession, Depends(get_db)]

state_machine = MeetingStateMachine()
question_tree_service = QuestionTreeService()


# Request/Response schemas
class MeetingStartResponse(BaseModel):
    """Response after starting a realtime meeting."""

    meeting_id: UUID
    status: str
    question_tree: dict


class MeetingProgressUpdate(BaseModel):
    """Request to update meeting progress."""

    current_speaker_index: int
    current_item_index: int


class MeetingProgressResponse(BaseModel):
    """Response with current meeting progress."""

    meeting_id: UUID
    status: str
    current_speaker_index: int | None
    current_item_index: int | None
    question_tree: dict | None


class MeetingEndResponse(BaseModel):
    """Response after ending a realtime meeting."""

    meeting_id: UUID
    status: str


@router.post(
    "/meetings/{meeting_id}/start",
    response_model=MeetingStartResponse,
)
async def start_realtime_meeting(meeting_id: UUID, db: DB) -> dict:
    """Start a realtime meeting.

    Generates question tree from weekly report and transitions to IN_PROGRESS.
    """
    result = await db.execute(
        select(Meeting)
        .where(Meeting.id == meeting_id)
        .options(
            selectinload(Meeting.team).selectinload(Team.members),
            selectinload(Meeting.weekly_report),
        )
    )
    meeting = result.scalar_one_or_none()

    if not meeting:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Meeting not found")

    # Validate mode
    mode_val = meeting.meeting_mode if isinstance(meeting.meeting_mode, str) else meeting.meeting_mode.value
    if mode_val != MeetingMode.REALTIME:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Meeting is not in realtime mode",
        )

    # Validate transition
    status_val = meeting.status.value if isinstance(meeting.status, MeetingStatus) else meeting.status
    try:
        state_machine.validate_transition(status_val, MeetingStatus.IN_PROGRESS, MeetingMode.REALTIME)
    except InvalidTransitionError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot start meeting from status: {status_val}",
        )

    # Generate question tree from weekly report
    question_tree = QuestionTree(speakers=[])
    if meeting.weekly_report and meeting.weekly_report.parsed_data:
        parser = WeeklyReportParser()
        parsed_report = parser.dict_to_parsed_report(meeting.weekly_report.parsed_data)
        attendees = [m.name for m in meeting.team.members if m.is_active]
        question_tree = question_tree_service.generate_tree(parsed_report, attendees)

    # Update meeting
    tree_dict = question_tree.to_dict()
    meeting.status = MeetingStatus.IN_PROGRESS
    meeting.question_tree_data = tree_dict
    meeting.current_speaker_index = 0
    meeting.current_item_index = 0

    await db.commit()

    logger.info("Realtime meeting started", meeting_id=str(meeting_id))

    return {
        "meeting_id": meeting_id,
        "status": MeetingStatus.IN_PROGRESS,
        "question_tree": tree_dict,
    }


@router.get(
    "/meetings/{meeting_id}/progress",
    response_model=MeetingProgressResponse,
)
async def get_meeting_progress(meeting_id: UUID, db: DB) -> dict:
    """Get current meeting progress (orchestration state)."""
    result = await db.execute(select(Meeting).where(Meeting.id == meeting_id))
    meeting = result.scalar_one_or_none()

    if not meeting:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Meeting not found")

    status_val = meeting.status.value if isinstance(meeting.status, MeetingStatus) else meeting.status

    return {
        "meeting_id": meeting_id,
        "status": status_val,
        "current_speaker_index": meeting.current_speaker_index,
        "current_item_index": meeting.current_item_index,
        "question_tree": meeting.question_tree_data,
    }


@router.put(
    "/meetings/{meeting_id}/progress",
    response_model=MeetingProgressResponse,
)
async def update_meeting_progress(
    meeting_id: UUID, data: MeetingProgressUpdate, db: DB
) -> dict:
    """Update meeting progress (current speaker/item)."""
    result = await db.execute(select(Meeting).where(Meeting.id == meeting_id))
    meeting = result.scalar_one_or_none()

    if not meeting:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Meeting not found")

    status_val = meeting.status.value if isinstance(meeting.status, MeetingStatus) else meeting.status
    if status_val != MeetingStatus.IN_PROGRESS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Meeting is not in progress",
        )

    meeting.current_speaker_index = data.current_speaker_index
    meeting.current_item_index = data.current_item_index

    await db.commit()

    return {
        "meeting_id": meeting_id,
        "status": status_val,
        "current_speaker_index": meeting.current_speaker_index,
        "current_item_index": meeting.current_item_index,
        "question_tree": meeting.question_tree_data,
    }


@router.post(
    "/meetings/{meeting_id}/next-item",
    response_model=MeetingProgressResponse,
)
async def advance_to_next_item(meeting_id: UUID, db: DB) -> dict:
    """Advance to the next question item."""
    result = await db.execute(select(Meeting).where(Meeting.id == meeting_id))
    meeting = result.scalar_one_or_none()

    if not meeting:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Meeting not found")

    status_val = meeting.status.value if isinstance(meeting.status, MeetingStatus) else meeting.status
    if status_val != MeetingStatus.IN_PROGRESS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Meeting is not in progress",
        )

    if not meeting.question_tree_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No question tree available",
        )

    tree = QuestionTree.from_dict(meeting.question_tree_data)
    speaker_idx = meeting.current_speaker_index or 0
    item_idx = (meeting.current_item_index or 0) + 1

    # Count total items for current speaker
    if speaker_idx < len(tree.speakers):
        speaker = tree.speakers[speaker_idx]
        total_items = sum(len(c.items) for c in speaker.categories)

        if item_idx >= total_items:
            # Move to next speaker
            speaker_idx += 1
            item_idx = 0

    meeting.current_speaker_index = speaker_idx
    meeting.current_item_index = item_idx

    await db.commit()

    return {
        "meeting_id": meeting_id,
        "status": status_val,
        "current_speaker_index": meeting.current_speaker_index,
        "current_item_index": meeting.current_item_index,
        "question_tree": meeting.question_tree_data,
    }


@router.post(
    "/meetings/{meeting_id}/next-speaker",
    response_model=MeetingProgressResponse,
)
async def advance_to_next_speaker(meeting_id: UUID, db: DB) -> dict:
    """Advance to the next speaker."""
    result = await db.execute(select(Meeting).where(Meeting.id == meeting_id))
    meeting = result.scalar_one_or_none()

    if not meeting:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Meeting not found")

    status_val = meeting.status.value if isinstance(meeting.status, MeetingStatus) else meeting.status
    if status_val != MeetingStatus.IN_PROGRESS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Meeting is not in progress",
        )

    speaker_idx = (meeting.current_speaker_index or 0) + 1
    meeting.current_speaker_index = speaker_idx
    meeting.current_item_index = 0

    await db.commit()

    return {
        "meeting_id": meeting_id,
        "status": status_val,
        "current_speaker_index": meeting.current_speaker_index,
        "current_item_index": meeting.current_item_index,
        "question_tree": meeting.question_tree_data,
    }


@router.post(
    "/meetings/{meeting_id}/end",
    response_model=MeetingEndResponse,
)
async def end_realtime_meeting(meeting_id: UUID, db: DB) -> dict:
    """End a realtime meeting.

    Transitions to RECORDING_DONE, ready for recording upload and STT.
    """
    result = await db.execute(select(Meeting).where(Meeting.id == meeting_id))
    meeting = result.scalar_one_or_none()

    if not meeting:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Meeting not found")

    status_val = meeting.status.value if isinstance(meeting.status, MeetingStatus) else meeting.status
    try:
        state_machine.validate_transition(
            status_val, MeetingStatus.RECORDING_DONE, MeetingMode.REALTIME
        )
    except InvalidTransitionError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot end meeting from status: {status_val}",
        )

    meeting.status = MeetingStatus.RECORDING_DONE

    await db.commit()

    logger.info("Realtime meeting ended", meeting_id=str(meeting_id))

    return {
        "meeting_id": meeting_id,
        "status": MeetingStatus.RECORDING_DONE,
    }


@router.get(
    "/meetings/{meeting_id}/question-tree",
)
async def get_question_tree(meeting_id: UUID, db: DB) -> dict:
    """Get the question tree for a meeting."""
    result = await db.execute(select(Meeting).where(Meeting.id == meeting_id))
    meeting = result.scalar_one_or_none()

    if not meeting:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Meeting not found")

    if not meeting.question_tree_data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No question tree generated for this meeting",
        )

    return meeting.question_tree_data
