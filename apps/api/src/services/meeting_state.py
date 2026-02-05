"""Meeting state machine for validating status transitions."""

from src.lib.logging import get_logger
from src.models import MeetingMode, MeetingStatus

logger = get_logger(__name__)


class InvalidTransitionError(Exception):
    """Raised when an invalid state transition is attempted."""

    def __init__(self, from_status: str, to_status: str) -> None:
        self.from_status = from_status
        self.to_status = to_status
        super().__init__(f"Invalid transition: {from_status} -> {to_status}")


# Valid transitions for upload mode (P1-lite)
UPLOAD_TRANSITIONS: dict[str, set[str]] = {
    MeetingStatus.CREATED: {
        MeetingStatus.WEEKLY_REPORT_LOADED,
        MeetingStatus.RECORDING_UPLOADED,
        MeetingStatus.FAILED,
    },
    MeetingStatus.WEEKLY_REPORT_LOADED: {
        MeetingStatus.RECORDING_UPLOADED,
        MeetingStatus.FAILED,
    },
    MeetingStatus.RECORDING_UPLOADED: {
        MeetingStatus.TRANSCRIBING,
        MeetingStatus.FAILED,
    },
    MeetingStatus.TRANSCRIBING: {
        MeetingStatus.TRANSCRIBED,
        MeetingStatus.FAILED,
    },
    MeetingStatus.TRANSCRIBED: {
        MeetingStatus.GENERATING_MINUTES,
        MeetingStatus.FAILED,
    },
    MeetingStatus.GENERATING_MINUTES: {
        MeetingStatus.DRAFT_READY,
        MeetingStatus.FAILED,
    },
    MeetingStatus.DRAFT_READY: {
        MeetingStatus.PUBLISHED,
        MeetingStatus.GENERATING_MINUTES,  # regenerate
        MeetingStatus.FAILED,
    },
    MeetingStatus.PUBLISHED: set(),
    MeetingStatus.FAILED: {
        MeetingStatus.CREATED,  # retry from scratch
        MeetingStatus.TRANSCRIBING,  # retry STT
        MeetingStatus.GENERATING_MINUTES,  # retry minutes
    },
}

# Valid transitions for realtime mode (P1-full)
REALTIME_TRANSITIONS: dict[str, set[str]] = {
    MeetingStatus.CREATED: {
        MeetingStatus.WEEKLY_REPORT_LOADED,
        MeetingStatus.PREPARING,
        MeetingStatus.FAILED,
    },
    MeetingStatus.WEEKLY_REPORT_LOADED: {
        MeetingStatus.PREPARING,
        MeetingStatus.FAILED,
    },
    MeetingStatus.PREPARING: {
        MeetingStatus.IN_PROGRESS,
        MeetingStatus.FAILED,
    },
    MeetingStatus.IN_PROGRESS: {
        MeetingStatus.RECORDING_DONE,
        MeetingStatus.FAILED,
    },
    MeetingStatus.RECORDING_DONE: {
        MeetingStatus.RECORDING_UPLOADED,
        MeetingStatus.TRANSCRIBING,
        MeetingStatus.FAILED,
    },
    MeetingStatus.RECORDING_UPLOADED: {
        MeetingStatus.TRANSCRIBING,
        MeetingStatus.FAILED,
    },
    MeetingStatus.TRANSCRIBING: {
        MeetingStatus.TRANSCRIBED,
        MeetingStatus.FAILED,
    },
    MeetingStatus.TRANSCRIBED: {
        MeetingStatus.GENERATING_MINUTES,
        MeetingStatus.FAILED,
    },
    MeetingStatus.GENERATING_MINUTES: {
        MeetingStatus.DRAFT_READY,
        MeetingStatus.FAILED,
    },
    MeetingStatus.DRAFT_READY: {
        MeetingStatus.PUBLISHED,
        MeetingStatus.GENERATING_MINUTES,
        MeetingStatus.FAILED,
    },
    MeetingStatus.PUBLISHED: set(),
    MeetingStatus.FAILED: {
        MeetingStatus.CREATED,
        MeetingStatus.PREPARING,
        MeetingStatus.TRANSCRIBING,
        MeetingStatus.GENERATING_MINUTES,
    },
}


class MeetingStateMachine:
    """Validates meeting status transitions based on meeting mode."""

    def can_transition(
        self, current_status: str, target_status: str, mode: str = MeetingMode.UPLOAD
    ) -> bool:
        """Check if a transition is valid.

        Args:
            current_status: Current meeting status value
            target_status: Target status value
            mode: Meeting mode (upload or realtime)

        Returns:
            True if the transition is valid
        """
        transitions = REALTIME_TRANSITIONS if mode == MeetingMode.REALTIME else UPLOAD_TRANSITIONS
        allowed = transitions.get(current_status, set())
        return target_status in allowed

    def validate_transition(
        self, current_status: str, target_status: str, mode: str = MeetingMode.UPLOAD
    ) -> None:
        """Validate a transition, raising error if invalid.

        Args:
            current_status: Current meeting status value
            target_status: Target status value
            mode: Meeting mode

        Raises:
            InvalidTransitionError: If transition is not allowed
        """
        if not self.can_transition(current_status, target_status, mode):
            raise InvalidTransitionError(current_status, target_status)
