"""API routers package."""

from fastapi import APIRouter

from src.routers.meetings import router as meetings_router
from src.routers.minutes import router as minutes_router
from src.routers.realtime_meeting import router as realtime_meeting_router
from src.routers.recordings import router as recordings_router
from src.routers.teams import router as teams_router
from src.routers.transcription import router as transcription_router
from src.routers.weekly_reports import router as weekly_reports_router

api_router = APIRouter(prefix="/api/v1")

api_router.include_router(teams_router, prefix="/teams", tags=["teams"])
api_router.include_router(meetings_router, prefix="/meetings", tags=["meetings"])
api_router.include_router(weekly_reports_router, prefix="/weekly-reports", tags=["weekly-reports"])
api_router.include_router(recordings_router, prefix="/recordings", tags=["recordings"])
api_router.include_router(transcription_router, prefix="/transcription", tags=["transcription"])
api_router.include_router(minutes_router, prefix="/minutes", tags=["minutes"])
api_router.include_router(realtime_meeting_router, prefix="/realtime", tags=["realtime-meeting"])
