from collections.abc import AsyncIterator, Awaitable, Callable
from contextlib import asynccontextmanager
from typing import Literal
from uuid import uuid4

import structlog
from fastapi import FastAPI, Request, Response, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy import text

from src.lib.config import settings
from src.lib.database import async_session_factory
from src.lib.logging import configure_logging, get_logger
from src.routers import api_router

# Configure logging first
configure_logging()
logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    """Application lifespan handler for startup/shutdown events."""
    # Startup
    logger.info("Starting WeeklyRun API", env=settings.PROJECT_ENV)
    yield
    # Shutdown
    logger.info("Shutting down WeeklyRun API")


app = FastAPI(
    title=settings.PROJECT_NAME,
    version="0.1.0",
    description="WeeklyRun - AI Meeting Orchestration API",
    lifespan=lifespan,
    docs_url="/docs" if settings.PROJECT_ENV != "prod" else None,
    redoc_url="/redoc" if settings.PROJECT_ENV != "prod" else None,
)


# Request ID middleware
@app.middleware("http")
async def request_id_middleware(
    request: Request, call_next: Callable[[Request], Awaitable[Response]]
) -> Response:
    """Add request ID to each request for tracing."""
    request_id = request.headers.get("X-Request-ID", str(uuid4()))

    # Bind request ID to structlog context
    structlog.contextvars.clear_contextvars()
    structlog.contextvars.bind_contextvars(request_id=request_id)

    response = await call_next(request)
    response.headers["X-Request-ID"] = request_id
    return response


# Error response model
class ErrorDetail(BaseModel):
    """Error detail structure."""

    code: str
    message: str
    details: dict | None = None


class ErrorResponse(BaseModel):
    """Standard error response format."""

    error: ErrorDetail
    request_id: str | None = None


# Global exception handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Handle all unhandled exceptions with consistent format."""
    request_id = request.headers.get("X-Request-ID")

    # Log the exception
    logger.exception(
        "Unhandled exception",
        exc_info=exc,
        request_id=request_id,
        path=request.url.path,
        method=request.method,
    )

    # Return consistent error response
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content=ErrorResponse(
            error=ErrorDetail(
                code="INTERNAL_SERVER_ERROR",
                message="An unexpected error occurred"
                if settings.PROJECT_ENV == "prod"
                else str(exc),
            ),
            request_id=request_id,
        ).model_dump(),
    )


# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ServiceStatus(BaseModel):
    """Individual service health status."""

    status: Literal["healthy", "unhealthy"]
    latency_ms: float | None = None
    error: str | None = None


class HealthResponse(BaseModel):
    """Health check response with detailed service statuses."""

    status: Literal["healthy", "degraded", "unhealthy"]
    version: str = "0.1.0"
    services: dict[str, ServiceStatus]


async def check_database() -> ServiceStatus:
    """Check database connectivity."""
    import time

    start = time.perf_counter()
    try:
        async with async_session_factory() as session:
            await session.execute(text("SELECT 1"))
        latency = (time.perf_counter() - start) * 1000
        return ServiceStatus(status="healthy", latency_ms=round(latency, 2))
    except Exception as e:
        latency = (time.perf_counter() - start) * 1000
        return ServiceStatus(status="unhealthy", latency_ms=round(latency, 2), error=str(e))


@app.get("/health")
async def health_check() -> HealthResponse:
    """Detailed health check endpoint with service statuses."""
    services: dict[str, ServiceStatus] = {}

    # Check database
    services["database"] = await check_database()

    # Determine overall status
    statuses = [s.status for s in services.values()]
    if all(s == "healthy" for s in statuses):
        overall_status: Literal["healthy", "degraded", "unhealthy"] = "healthy"
    elif all(s == "unhealthy" for s in statuses):
        overall_status = "unhealthy"
    else:
        overall_status = "degraded"

    return HealthResponse(
        status=overall_status,
        version="0.1.0",
        services=services,
    )


@app.get("/health/live")
async def liveness_check() -> dict[str, str]:
    """Simple liveness probe."""
    return {"status": "ok"}


app.include_router(api_router)


@app.get("/")
async def root() -> dict:
    """Root endpoint with API info."""
    return {
        "service": settings.PROJECT_NAME,
        "version": "0.1.0",
        "docs": "/docs" if settings.PROJECT_ENV != "prod" else None,
    }
