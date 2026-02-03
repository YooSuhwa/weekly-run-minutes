"""Weekly report API endpoints."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.lib.dependencies import get_db
from src.lib.logging import get_logger
from src.models import Meeting, MeetingStatus, WeeklyReport
from src.services.confluence import ConfluenceError, ConfluenceService
from src.services.weekly_report_parser import WeeklyReportParser

logger = get_logger(__name__)
router = APIRouter()

# Dependency type alias
DB = Annotated[AsyncSession, Depends(get_db)]


class ConfluencePageSummary(BaseModel):
    """Summary of a Confluence page."""

    id: str
    title: str
    url: str


class WeeklyReportLoadRequest(BaseModel):
    """Request to load a weekly report for a meeting."""

    confluence_page_id: str


class WeeklyReportResponse(BaseModel):
    """Response with loaded weekly report data."""

    id: UUID
    meeting_id: UUID
    confluence_page_id: str
    confluence_page_url: str
    parsed_data: dict

    model_config = ConfigDict(from_attributes=True)


@router.get("/confluence/pages", response_model=list[ConfluencePageSummary])
async def list_weekly_report_pages(
    title_contains: str | None = None,
    limit: int = 10,
) -> list[dict]:
    """List available weekly report pages from Confluence."""
    service = ConfluenceService()

    try:
        pages = await service.find_weekly_reports(
            title_contains=title_contains,
            limit=limit,
        )
        return pages
    except ConfluenceError as e:
        raise HTTPException(
            status_code=e.status_code or 500,
            detail=f"Confluence error: {e}",
        )


@router.post(
    "/meetings/{meeting_id}/weekly-report",
    response_model=WeeklyReportResponse,
    status_code=status.HTTP_201_CREATED,
)
async def load_weekly_report_for_meeting(
    meeting_id: UUID,
    data: WeeklyReportLoadRequest,
    db: DB,
) -> WeeklyReport:
    """Load and parse a weekly report for a meeting.

    Fetches the Confluence page, parses the HTML to extract structured
    task data, and stores it associated with the meeting.
    """
    # Verify meeting exists
    result = await db.execute(select(Meeting).where(Meeting.id == meeting_id))
    meeting = result.scalar_one_or_none()
    if not meeting:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Meeting not found",
        )

    # Check if weekly report already exists
    existing = await db.execute(select(WeeklyReport).where(WeeklyReport.meeting_id == meeting_id))
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Weekly report already loaded for this meeting",
        )

    # Fetch from Confluence
    service = ConfluenceService()
    try:
        page_data = await service.get_weekly_report_page(data.confluence_page_id)
    except ConfluenceError as e:
        raise HTTPException(
            status_code=e.status_code or 500,
            detail=f"Failed to fetch Confluence page: {e}",
        )

    # Parse the HTML content
    parser = WeeklyReportParser()
    parsed_data = parser.parse(page_data["html_content"])
    logger.info(
        "Weekly report parsed",
        members_count=len(parsed_data.get("team_members", [])),
        html_length=len(page_data["html_content"]),
        has_expand_macro="ac:structured-macro" in page_data["html_content"],
        parser_module=WeeklyReportParser.__module__,
    )

    # Create weekly report record
    weekly_report = WeeklyReport(
        meeting_id=meeting_id,
        confluence_page_id=data.confluence_page_id,
        confluence_page_url=page_data["url"],
        raw_html=page_data["html_content"],
        parsed_data=parsed_data,
    )
    db.add(weekly_report)

    # Update meeting status
    meeting.status = MeetingStatus.WEEKLY_REPORT_LOADED

    await db.commit()
    await db.refresh(weekly_report)

    logger.info(
        "Weekly report loaded",
        meeting_id=str(meeting_id),
        page_id=data.confluence_page_id,
        members_count=len(parsed_data.get("team_members", [])),
    )

    return weekly_report


@router.get("/meetings/{meeting_id}/weekly-report", response_model=WeeklyReportResponse)
async def get_meeting_weekly_report(
    meeting_id: UUID,
    db: DB,
) -> WeeklyReport:
    """Get the weekly report for a meeting."""
    result = await db.execute(select(WeeklyReport).where(WeeklyReport.meeting_id == meeting_id))
    weekly_report = result.scalar_one_or_none()
    if not weekly_report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Weekly report not found for this meeting",
        )
    return weekly_report


@router.get("/meetings/{meeting_id}/weekly-report/summary")
async def get_weekly_report_summary(
    meeting_id: UUID,
    db: DB,
    member_name: str | None = None,
) -> dict:
    """Get a text summary of the weekly report for AI context.

    Args:
        meeting_id: Meeting ID
        member_name: Optional - get summary for specific member only
    """
    result = await db.execute(select(WeeklyReport).where(WeeklyReport.meeting_id == meeting_id))
    weekly_report = result.scalar_one_or_none()
    if not weekly_report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Weekly report not found for this meeting",
        )

    parser = WeeklyReportParser()

    if member_name:
        summary = parser.get_member_summary(weekly_report.parsed_data, member_name)
    else:
        summary = parser.get_all_members_summary(weekly_report.parsed_data)

    return {
        "meeting_id": str(meeting_id),
        "member_name": member_name,
        "summary": summary,
    }
