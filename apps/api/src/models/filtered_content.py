"""FilteredContent model for chat/casual talk filtering."""

from enum import Enum
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import Boolean, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.models.base import BaseModel

if TYPE_CHECKING:
    from src.models.meeting import Meeting


class FilterReason(str, Enum):
    """Reason why content was filtered."""

    CASUAL_TALK = "casual_talk"  # 잡담 (날씨, 음식, 취미 등)
    GREETING = "greeting"  # 인사말, 안부
    OFF_TOPIC = "off_topic"  # 주제와 무관한 이야기
    PERSONAL = "personal"  # 개인적인 이야기 (건강, 가족, 연애 등)
    SMALL_TALK = "small_talk"  # 소소한 대화, 농담
    GOSSIP = "gossip"  # 뒷담화, 험담, 부재자 비판
    NOISE = "noise"  # 회의 운영 잡음 (마이크 체크, "잠깐만요" 등)


class FilteredContent(BaseModel):
    """FilteredContent model - AI가 필터링한 잡담/비업무 내용."""

    __tablename__ = "filtered_contents"

    meeting_id: Mapped[UUID] = mapped_column(
        ForeignKey("meetings.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Original content that was filtered
    content: Mapped[str] = mapped_column(Text, nullable=False)

    # Why it was filtered
    filter_reason: Mapped[str] = mapped_column(
        String(50),
        default=FilterReason.CASUAL_TALK,
        nullable=False,
    )

    # AI confidence score (0.0 ~ 1.0)
    confidence: Mapped[float | None] = mapped_column(nullable=True)

    # Whether user restored this content back to transcript
    is_restored: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )

    # Whether user confirmed this as casual talk (for AI learning)
    is_confirmed: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )

    # Speaker info (from original transcript)
    speaker_label: Mapped[str | None] = mapped_column(String(50), nullable=True)
    speaker_name: Mapped[str | None] = mapped_column(String(50), nullable=True)

    # Time info from original transcript (in seconds)
    start_time: Mapped[float | None] = mapped_column(nullable=True)
    end_time: Mapped[float | None] = mapped_column(nullable=True)

    # Relationships
    meeting: Mapped["Meeting"] = relationship("Meeting", back_populates="filtered_contents")
