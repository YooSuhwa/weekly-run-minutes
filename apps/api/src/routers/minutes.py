"""Meeting minutes API endpoints."""

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
from src.models import Meeting, MeetingMinutes, MeetingStatus, Transcript
from src.models.team import Team
from src.services.confluence import ConfluenceError, ConfluenceService
from src.services.minutes_generator import MinutesGenerationError, MinutesGeneratorService
from src.services.weekly_report_parser import WeeklyReportParser

logger = get_logger(__name__)
router = APIRouter()

# Dependency type alias
DB = Annotated[AsyncSession, Depends(get_db)]


class CorrectionItemResponse(BaseModel):
    """Single correction item."""

    original: str
    corrected: str
    category: str
    paragraph_index: int | None = None
    start_offset: int | None = None
    end_offset: int | None = None


class MinutesResponse(BaseModel):
    """Meeting minutes response."""

    id: UUID
    meeting_id: UUID
    content_markdown: str
    ai_model: str
    prompt_version: str
    is_edited: bool
    edited_content: str | None
    corrections: list[CorrectionItemResponse]

    model_config = ConfigDict(from_attributes=True)


class MinutesUpdateRequest(BaseModel):
    """Request to update minutes content."""

    content_markdown: str


class MinutesGenerationStatusResponse(BaseModel):
    """Status response for minutes generation."""

    meeting_id: UUID
    status: str
    has_minutes: bool
    error_message: str | None


class PublishResponse(BaseModel):
    """Response after publishing to Confluence."""

    meeting_id: UUID
    confluence_page_id: str
    confluence_page_url: str


async def generate_minutes_task(meeting_id: UUID) -> None:
    """Background task to generate meeting minutes."""
    meeting = None
    async with async_session_factory() as db:
        try:
            # Get meeting with all related data
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
                logger.error("Meeting not found for minutes generation", meeting_id=str(meeting_id))
                return

            # Get transcripts
            transcript_result = await db.execute(
                select(Transcript)
                .where(Transcript.meeting_id == meeting_id)
                .order_by(Transcript.start_time)
            )
            transcripts = list(transcript_result.scalars().all())

            if not transcripts:
                meeting.status = MeetingStatus.FAILED
                meeting.error_message = "No transcripts available for minutes generation"
                await db.commit()
                return

            # Update status
            meeting.status = MeetingStatus.GENERATING_MINUTES
            await db.commit()

            # Build transcript text
            transcript_lines = []
            for t in transcripts:
                speaker = t.speaker_name or t.speaker_label or "Speaker"
                transcript_lines.append(f"[{speaker}] {t.text}")
            transcript_text = "\n".join(transcript_lines)

            # Get weekly report summary
            weekly_report_summary = ""
            if meeting.weekly_report:
                parser = WeeklyReportParser()
                weekly_report_summary = parser.get_all_members_summary(
                    meeting.weekly_report.parsed_data
                )

            # Get attendees
            attendees = [m.name for m in meeting.team.members if m.is_active]

            # Generate minutes
            generator = MinutesGeneratorService()
            result = await generator.generate_minutes(
                transcript_text=transcript_text,
                weekly_report_summary=weekly_report_summary,
                meeting_date=meeting.meeting_date.isoformat(),
                team_name=meeting.team.name,
                attendees=attendees,
            )

            # Store minutes with corrections (including position data)
            minutes = MeetingMinutes(
                meeting_id=meeting_id,
                content_markdown=result.content_markdown,
                ai_model=result.ai_model,
                prompt_version=result.prompt_version,
                corrections=[
                    {
                        "original": c.original,
                        "corrected": c.corrected,
                        "category": c.category,
                        "paragraph_index": c.paragraph_index,
                        "start_offset": c.start_offset,
                        "end_offset": c.end_offset,
                    }
                    for c in result.corrections
                ],
            )
            db.add(minutes)

            meeting.status = MeetingStatus.DRAFT_READY
            await db.commit()

            logger.info(
                "Minutes generated successfully",
                meeting_id=str(meeting_id),
            )

        except MinutesGenerationError as e:
            logger.exception("Minutes generation error", meeting_id=str(meeting_id))
            if meeting:
                meeting.status = MeetingStatus.FAILED
                meeting.error_message = str(e)
                await db.commit()

        except Exception as e:
            logger.exception(
                "Unexpected error during minutes generation", meeting_id=str(meeting_id)
            )
            if meeting:
                meeting.status = MeetingStatus.FAILED
                meeting.error_message = f"Minutes generation failed: {e}"
                await db.commit()


@router.post(
    "/meetings/{meeting_id}/generate-minutes",
    response_model=MinutesGenerationStatusResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def start_minutes_generation(
    meeting_id: UUID,
    background_tasks: BackgroundTasks,
    db: DB,
) -> dict:
    """Start meeting minutes generation.

    Requires transcription to be completed first.
    Uses GPT to generate minutes from transcript and weekly report.
    """
    # Get meeting
    result = await db.execute(
        select(Meeting).where(Meeting.id == meeting_id).options(selectinload(Meeting.minutes))
    )
    meeting = result.scalar_one_or_none()

    if not meeting:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Meeting not found",
        )

    # Check if transcription is done
    status_val = meeting.status.value if isinstance(meeting.status, MeetingStatus) else meeting.status
    allowed_statuses = {"transcribed", "generating_minutes", "draft_ready", "published"}
    if status_val not in allowed_statuses:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Transcription must be completed first. Current status: {status_val}",
        )

    # If already has minutes, return existing
    if meeting.minutes:
        return {
            "meeting_id": meeting_id,
            "status": status_val,
            "has_minutes": True,
            "error_message": None,
        }

    # If already generating, don't start again
    if status_val == "generating_minutes":
        return {
            "meeting_id": meeting_id,
            "status": "generating_minutes",
            "has_minutes": False,
            "error_message": None,
        }

    # Start background generation
    background_tasks.add_task(generate_minutes_task, meeting_id)

    return {
        "meeting_id": meeting_id,
        "status": "generating_minutes",
        "has_minutes": False,
        "error_message": None,
    }


@router.get("/meetings/{meeting_id}/minutes", response_model=MinutesResponse)
async def get_meeting_minutes(
    meeting_id: UUID,
    db: DB,
) -> MeetingMinutes:
    """Get meeting minutes."""
    result = await db.execute(select(MeetingMinutes).where(MeetingMinutes.meeting_id == meeting_id))
    minutes = result.scalar_one_or_none()

    if not minutes:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Minutes not found for this meeting",
        )

    return minutes


@router.put("/meetings/{meeting_id}/minutes", response_model=MinutesResponse)
async def update_meeting_minutes(
    meeting_id: UUID,
    data: MinutesUpdateRequest,
    db: DB,
) -> MeetingMinutes:
    """Update meeting minutes content.

    Stores the edited version and marks as edited.
    """
    result = await db.execute(select(MeetingMinutes).where(MeetingMinutes.meeting_id == meeting_id))
    minutes = result.scalar_one_or_none()

    if not minutes:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Minutes not found for this meeting",
        )

    minutes.edited_content = data.content_markdown
    minutes.is_edited = True

    await db.commit()
    await db.refresh(minutes)

    logger.info("Minutes updated", meeting_id=str(meeting_id))

    return minutes


@router.post(
    "/meetings/{meeting_id}/publish",
    response_model=PublishResponse,
)
async def publish_minutes_to_confluence(
    meeting_id: UUID,
    db: DB,
) -> dict:
    """Publish meeting minutes to Confluence.

    Creates a new Confluence page with the minutes content.
    """
    # Get meeting with minutes
    result = await db.execute(
        select(Meeting).where(Meeting.id == meeting_id).options(selectinload(Meeting.minutes))
    )
    meeting = result.scalar_one_or_none()

    if not meeting:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Meeting not found",
        )

    if not meeting.minutes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Minutes must be generated first",
        )

    if meeting.confluence_page_id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Minutes already published to Confluence",
        )

    # Get the content to publish (edited if available, otherwise original)
    content = meeting.minutes.edited_content or meeting.minutes.content_markdown

    # Create Confluence page
    confluence = ConfluenceService()
    try:
        page_result = await confluence.upload_meeting_minutes(
            title=f"{meeting.meeting_date.isoformat()} {meeting.title} 회의록",
            markdown_content=content,
        )
    except ConfluenceError as e:
        raise HTTPException(
            status_code=e.status_code or 500,
            detail=f"Confluence upload failed: {e}",
        )

    # Update meeting with Confluence info
    meeting.confluence_page_id = page_result["id"]
    meeting.confluence_page_url = page_result["url"]
    meeting.status = MeetingStatus.PUBLISHED

    await db.commit()

    logger.info(
        "Minutes published to Confluence",
        meeting_id=str(meeting_id),
        page_id=page_result["id"],
    )

    return {
        "meeting_id": meeting_id,
        "confluence_page_id": page_result["id"],
        "confluence_page_url": page_result["url"],
    }


@router.get("/meetings/{meeting_id}/minutes/export")
async def export_minutes(
    meeting_id: UUID,
    db: DB,
    format: str = "markdown",
) -> dict:
    """Export meeting minutes in various formats.

    Supported formats: markdown, html
    """
    result = await db.execute(select(MeetingMinutes).where(MeetingMinutes.meeting_id == meeting_id))
    minutes = result.scalar_one_or_none()

    if not minutes:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Minutes not found for this meeting",
        )

    content = minutes.edited_content or minutes.content_markdown

    if format == "markdown":
        return {
            "meeting_id": str(meeting_id),
            "format": "markdown",
            "content": content,
        }
    elif format == "html":
        # Basic markdown to HTML conversion
        import markdown

        html_content = markdown.markdown(content, extensions=["tables", "fenced_code"])
        return {
            "meeting_id": str(meeting_id),
            "format": "html",
            "content": html_content,
        }
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported format: {format}. Supported: markdown, html",
        )
