"""Filtered content API endpoints for chat/casual talk filtering."""

from datetime import datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.lib.dependencies import get_db
from src.lib.logging import get_logger
from src.models import FilteredContent, Meeting

logger = get_logger(__name__)
router = APIRouter()

# Dependency type alias
DB = Annotated[AsyncSession, Depends(get_db)]


class FilteredContentResponse(BaseModel):
    """Filtered content response."""

    id: UUID
    meeting_id: UUID
    content: str
    filter_reason: str
    confidence: float | None
    is_restored: bool
    is_confirmed: bool
    speaker_label: str | None
    speaker_name: str | None
    start_time: float | None
    end_time: float | None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class FilteredContentListResponse(BaseModel):
    """List response for filtered contents."""

    meeting_id: UUID
    items: list[FilteredContentResponse]
    total_count: int
    restored_count: int
    confirmed_count: int


class RestoreResponse(BaseModel):
    """Response after restoring filtered content."""

    id: UUID
    meeting_id: UUID
    is_restored: bool
    message: str


class ConfirmResponse(BaseModel):
    """Response after confirming content as casual talk."""

    id: UUID
    meeting_id: UUID
    is_confirmed: bool
    message: str


class FilterStatsResponse(BaseModel):
    """Statistics about filtered content for a meeting."""

    meeting_id: UUID
    total_filtered: int
    by_reason: dict[str, int]
    restored_count: int
    confirmed_count: int
    average_confidence: float | None


# ============================================================================
# Static path routes (must come BEFORE dynamic {content_id} routes)
# ============================================================================


@router.get(
    "/meetings/{meeting_id}/filtered",
    response_model=FilteredContentListResponse,
)
async def get_filtered_content(
    meeting_id: UUID,
    db: DB,
    include_restored: bool = False,
) -> dict:
    """Get all filtered content for a meeting.

    Args:
        meeting_id: Meeting ID
        include_restored: If True, include content that was restored (default: False)

    Returns:
        List of filtered content items
    """
    # Verify meeting exists
    meeting_result = await db.execute(select(Meeting).where(Meeting.id == meeting_id))
    if not meeting_result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Meeting not found",
        )

    # Build query
    query = select(FilteredContent).where(FilteredContent.meeting_id == meeting_id)

    if not include_restored:
        query = query.where(FilteredContent.is_restored == False)  # noqa: E712

    query = query.order_by(FilteredContent.start_time.nulls_last(), FilteredContent.created_at)

    result = await db.execute(query)
    items = list(result.scalars().all())

    # Get counts
    all_query = select(FilteredContent).where(FilteredContent.meeting_id == meeting_id)
    all_result = await db.execute(all_query)
    all_items = list(all_result.scalars().all())

    restored_count = sum(1 for item in all_items if item.is_restored)
    confirmed_count = sum(1 for item in all_items if item.is_confirmed)

    return {
        "meeting_id": meeting_id,
        "items": items,
        "total_count": len(all_items),
        "restored_count": restored_count,
        "confirmed_count": confirmed_count,
    }


@router.get(
    "/meetings/{meeting_id}/filtered/stats",
    response_model=FilterStatsResponse,
)
async def get_filter_stats(
    meeting_id: UUID,
    db: DB,
) -> dict:
    """Get statistics about filtered content for a meeting."""
    # Verify meeting exists
    meeting_result = await db.execute(select(Meeting).where(Meeting.id == meeting_id))
    if not meeting_result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Meeting not found",
        )

    result = await db.execute(
        select(FilteredContent).where(FilteredContent.meeting_id == meeting_id)
    )
    items = list(result.scalars().all())

    if not items:
        return {
            "meeting_id": meeting_id,
            "total_filtered": 0,
            "by_reason": {},
            "restored_count": 0,
            "confirmed_count": 0,
            "average_confidence": None,
        }

    # Count by reason
    by_reason: dict[str, int] = {}
    for item in items:
        reason = item.filter_reason
        by_reason[reason] = by_reason.get(reason, 0) + 1

    # Calculate averages and counts
    restored_count = sum(1 for item in items if item.is_restored)
    confirmed_count = sum(1 for item in items if item.is_confirmed)

    confidences = [item.confidence for item in items if item.confidence is not None]
    avg_confidence = sum(confidences) / len(confidences) if confidences else None

    return {
        "meeting_id": meeting_id,
        "total_filtered": len(items),
        "by_reason": by_reason,
        "restored_count": restored_count,
        "confirmed_count": confirmed_count,
        "average_confidence": round(avg_confidence, 3) if avg_confidence else None,
    }


@router.post(
    "/meetings/{meeting_id}/filtered/restore-all",
    response_model=dict,
)
async def restore_all_filtered_content(
    meeting_id: UUID,
    db: DB,
) -> dict:
    """Restore all filtered content for a meeting."""
    # Verify meeting exists
    meeting_result = await db.execute(select(Meeting).where(Meeting.id == meeting_id))
    if not meeting_result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Meeting not found",
        )

    result = await db.execute(
        select(FilteredContent).where(
            FilteredContent.meeting_id == meeting_id,
            FilteredContent.is_restored == False,  # noqa: E712
        )
    )
    items = list(result.scalars().all())

    for item in items:
        item.is_restored = True
        item.is_confirmed = False

    await db.commit()

    logger.info(
        "All filtered content restored",
        meeting_id=str(meeting_id),
        count=len(items),
    )

    return {
        "meeting_id": str(meeting_id),
        "restored_count": len(items),
        "message": f"Restored {len(items)} items",
    }


@router.post(
    "/meetings/{meeting_id}/filtered/confirm-all",
    response_model=dict,
)
async def confirm_all_filtered_content(
    meeting_id: UUID,
    db: DB,
) -> dict:
    """Confirm all non-restored filtered content as casual talk."""
    # Verify meeting exists
    meeting_result = await db.execute(select(Meeting).where(Meeting.id == meeting_id))
    if not meeting_result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Meeting not found",
        )

    result = await db.execute(
        select(FilteredContent).where(
            FilteredContent.meeting_id == meeting_id,
            FilteredContent.is_restored == False,  # noqa: E712
            FilteredContent.is_confirmed == False,  # noqa: E712
        )
    )
    items = list(result.scalars().all())

    for item in items:
        item.is_confirmed = True

    await db.commit()

    logger.info(
        "All filtered content confirmed",
        meeting_id=str(meeting_id),
        count=len(items),
    )

    return {
        "meeting_id": str(meeting_id),
        "confirmed_count": len(items),
        "message": f"Confirmed {len(items)} items as casual talk",
    }


# ============================================================================
# Dynamic path routes with {content_id} (must come AFTER static path routes)
# ============================================================================


@router.get(
    "/meetings/{meeting_id}/filtered/{content_id}",
    response_model=FilteredContentResponse,
)
async def get_filtered_content_by_id(
    meeting_id: UUID,
    content_id: UUID,
    db: DB,
) -> FilteredContent:
    """Get a specific filtered content item."""
    result = await db.execute(
        select(FilteredContent).where(
            FilteredContent.id == content_id,
            FilteredContent.meeting_id == meeting_id,
        )
    )
    content = result.scalar_one_or_none()

    if not content:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Filtered content not found",
        )

    return content


@router.post(
    "/meetings/{meeting_id}/filtered/{content_id}/restore",
    response_model=RestoreResponse,
)
async def restore_filtered_content(
    meeting_id: UUID,
    content_id: UUID,
    db: DB,
) -> dict:
    """Restore filtered content back to the transcript.

    This marks the content as restored, indicating the user
    disagrees with the AI's classification.
    """
    result = await db.execute(
        select(FilteredContent).where(
            FilteredContent.id == content_id,
            FilteredContent.meeting_id == meeting_id,
        )
    )
    content = result.scalar_one_or_none()

    if not content:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Filtered content not found",
        )

    if content.is_restored:
        return {
            "id": content_id,
            "meeting_id": meeting_id,
            "is_restored": True,
            "message": "Content was already restored",
        }

    content.is_restored = True
    # If restoring, it's not confirmed as casual talk
    content.is_confirmed = False

    await db.commit()

    logger.info(
        "Filtered content restored",
        content_id=str(content_id),
        meeting_id=str(meeting_id),
    )

    return {
        "id": content_id,
        "meeting_id": meeting_id,
        "is_restored": True,
        "message": "Content restored successfully",
    }


@router.post(
    "/meetings/{meeting_id}/filtered/{content_id}/confirm",
    response_model=ConfirmResponse,
)
async def confirm_filtered_content(
    meeting_id: UUID,
    content_id: UUID,
    db: DB,
) -> dict:
    """Confirm that filtered content is indeed casual talk.

    This is used for AI learning - confirmed items can be used
    to improve future filtering accuracy.
    """
    result = await db.execute(
        select(FilteredContent).where(
            FilteredContent.id == content_id,
            FilteredContent.meeting_id == meeting_id,
        )
    )
    content = result.scalar_one_or_none()

    if not content:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Filtered content not found",
        )

    if content.is_restored:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot confirm restored content as casual talk",
        )

    if content.is_confirmed:
        return {
            "id": content_id,
            "meeting_id": meeting_id,
            "is_confirmed": True,
            "message": "Content was already confirmed",
        }

    content.is_confirmed = True

    await db.commit()

    logger.info(
        "Filtered content confirmed as casual talk",
        content_id=str(content_id),
        meeting_id=str(meeting_id),
        filter_reason=content.filter_reason,
    )

    return {
        "id": content_id,
        "meeting_id": meeting_id,
        "is_confirmed": True,
        "message": "Content confirmed as casual talk",
    }


@router.delete(
    "/meetings/{meeting_id}/filtered/{content_id}/restore",
    response_model=RestoreResponse,
)
async def undo_restore(
    meeting_id: UUID,
    content_id: UUID,
    db: DB,
) -> dict:
    """Undo a restore action - mark content as filtered again."""
    result = await db.execute(
        select(FilteredContent).where(
            FilteredContent.id == content_id,
            FilteredContent.meeting_id == meeting_id,
        )
    )
    content = result.scalar_one_or_none()

    if not content:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Filtered content not found",
        )

    if not content.is_restored:
        return {
            "id": content_id,
            "meeting_id": meeting_id,
            "is_restored": False,
            "message": "Content was not restored",
        }

    content.is_restored = False

    await db.commit()

    logger.info(
        "Restore undone for filtered content",
        content_id=str(content_id),
        meeting_id=str(meeting_id),
    )

    return {
        "id": content_id,
        "meeting_id": meeting_id,
        "is_restored": False,
        "message": "Restore undone successfully",
    }
