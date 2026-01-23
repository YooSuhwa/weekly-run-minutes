"""Transcript model for STT results."""

from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import Float, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.models.base import BaseModel

if TYPE_CHECKING:
    from src.models.meeting import Meeting


class Transcript(BaseModel):
    """Transcript model - STT 결과 (발화 구간별)."""

    __tablename__ = "transcripts"

    meeting_id: Mapped[UUID] = mapped_column(
        ForeignKey("meetings.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Time info (in seconds)
    start_time: Mapped[float] = mapped_column(Float, nullable=False)
    end_time: Mapped[float] = mapped_column(Float, nullable=False)

    # Speaker info (from AI speaker diarization)
    speaker_label: Mapped[str | None] = mapped_column(String(50), nullable=True)
    speaker_name: Mapped[str | None] = mapped_column(String(50), nullable=True)

    # Content
    text: Mapped[str] = mapped_column(Text, nullable=False)
    confidence: Mapped[float | None] = mapped_column(Float, nullable=True)

    # Relationships
    meeting: Mapped["Meeting"] = relationship("Meeting", back_populates="transcripts")
