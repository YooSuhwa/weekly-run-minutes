"""Recording model for audio files."""

from enum import Enum
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import BigInteger, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.models.base import BaseModel

if TYPE_CHECKING:
    from src.models.meeting import Meeting


class RecordingSource(str, Enum):
    """Recording source enum."""

    UPLOAD = "upload"  # 파일 업로드
    BROWSER = "browser"  # 브라우저 MediaRecorder


class Recording(BaseModel):
    """Recording model - 녹음 파일 정보."""

    __tablename__ = "recordings"

    meeting_id: Mapped[UUID] = mapped_column(
        ForeignKey("meetings.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )

    # File info
    original_filename: Mapped[str] = mapped_column(String(255), nullable=False)
    stored_filename: Mapped[str] = mapped_column(String(255), nullable=False)
    file_path: Mapped[str] = mapped_column(String(500), nullable=False)
    file_size: Mapped[int] = mapped_column(BigInteger, nullable=False)
    mime_type: Mapped[str] = mapped_column(String(100), nullable=False)
    duration_seconds: Mapped[float | None] = mapped_column(nullable=True)
    source: Mapped[str] = mapped_column(String(20), default=RecordingSource.UPLOAD, nullable=False)

    # Relationships
    meeting: Mapped["Meeting"] = relationship("Meeting", back_populates="recording")
