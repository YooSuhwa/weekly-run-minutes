"""Tests for meeting state machine service."""

import pytest

from src.models import MeetingMode, MeetingStatus
from src.services.meeting_state import (
    InvalidTransitionError,
    MeetingStateMachine,
    REALTIME_TRANSITIONS,
    UPLOAD_TRANSITIONS,
)


@pytest.fixture
def state_machine():
    return MeetingStateMachine()


class TestUploadModeTransitions:
    """Test transitions for UPLOAD mode (P1-lite)."""

    def test_created_to_weekly_report_loaded(self, state_machine):
        assert state_machine.can_transition(
            MeetingStatus.CREATED, MeetingStatus.WEEKLY_REPORT_LOADED, MeetingMode.UPLOAD
        )

    def test_created_to_recording_uploaded(self, state_machine):
        assert state_machine.can_transition(
            MeetingStatus.CREATED, MeetingStatus.RECORDING_UPLOADED, MeetingMode.UPLOAD
        )

    def test_weekly_report_to_recording_uploaded(self, state_machine):
        assert state_machine.can_transition(
            MeetingStatus.WEEKLY_REPORT_LOADED,
            MeetingStatus.RECORDING_UPLOADED,
            MeetingMode.UPLOAD,
        )

    def test_recording_uploaded_to_transcribing(self, state_machine):
        assert state_machine.can_transition(
            MeetingStatus.RECORDING_UPLOADED, MeetingStatus.TRANSCRIBING, MeetingMode.UPLOAD
        )

    def test_transcribing_to_transcribed(self, state_machine):
        assert state_machine.can_transition(
            MeetingStatus.TRANSCRIBING, MeetingStatus.TRANSCRIBED, MeetingMode.UPLOAD
        )

    def test_transcribed_to_generating_minutes(self, state_machine):
        assert state_machine.can_transition(
            MeetingStatus.TRANSCRIBED, MeetingStatus.GENERATING_MINUTES, MeetingMode.UPLOAD
        )

    def test_generating_minutes_to_draft_ready(self, state_machine):
        assert state_machine.can_transition(
            MeetingStatus.GENERATING_MINUTES, MeetingStatus.DRAFT_READY, MeetingMode.UPLOAD
        )

    def test_draft_ready_to_published(self, state_machine):
        assert state_machine.can_transition(
            MeetingStatus.DRAFT_READY, MeetingStatus.PUBLISHED, MeetingMode.UPLOAD
        )

    def test_draft_ready_to_regenerate(self, state_machine):
        """Test regeneration flow."""
        assert state_machine.can_transition(
            MeetingStatus.DRAFT_READY, MeetingStatus.GENERATING_MINUTES, MeetingMode.UPLOAD
        )

    def test_published_is_terminal(self, state_machine):
        """Published status has no outgoing transitions."""
        for status in MeetingStatus:
            if status != MeetingStatus.PUBLISHED:
                assert not state_machine.can_transition(
                    MeetingStatus.PUBLISHED, status, MeetingMode.UPLOAD
                )

    def test_any_to_failed(self, state_machine):
        """Most statuses can transition to FAILED."""
        statuses_with_failure = [
            MeetingStatus.CREATED,
            MeetingStatus.WEEKLY_REPORT_LOADED,
            MeetingStatus.RECORDING_UPLOADED,
            MeetingStatus.TRANSCRIBING,
            MeetingStatus.TRANSCRIBED,
            MeetingStatus.GENERATING_MINUTES,
            MeetingStatus.DRAFT_READY,
        ]
        for status in statuses_with_failure:
            assert state_machine.can_transition(status, MeetingStatus.FAILED, MeetingMode.UPLOAD)

    def test_failed_recovery_to_created(self, state_machine):
        assert state_machine.can_transition(
            MeetingStatus.FAILED, MeetingStatus.CREATED, MeetingMode.UPLOAD
        )

    def test_failed_recovery_to_transcribing(self, state_machine):
        assert state_machine.can_transition(
            MeetingStatus.FAILED, MeetingStatus.TRANSCRIBING, MeetingMode.UPLOAD
        )

    def test_failed_recovery_to_generating_minutes(self, state_machine):
        assert state_machine.can_transition(
            MeetingStatus.FAILED, MeetingStatus.GENERATING_MINUTES, MeetingMode.UPLOAD
        )

    def test_invalid_backward_transition(self, state_machine):
        """Cannot go backwards in the pipeline (except from FAILED)."""
        assert not state_machine.can_transition(
            MeetingStatus.TRANSCRIBED, MeetingStatus.RECORDING_UPLOADED, MeetingMode.UPLOAD
        )

    def test_skip_step_not_allowed(self, state_machine):
        """Cannot skip steps in pipeline."""
        assert not state_machine.can_transition(
            MeetingStatus.CREATED, MeetingStatus.TRANSCRIBING, MeetingMode.UPLOAD
        )


class TestRealtimeModeTransitions:
    """Test transitions for REALTIME mode (P1-full)."""

    def test_created_to_preparing(self, state_machine):
        assert state_machine.can_transition(
            MeetingStatus.CREATED, MeetingStatus.PREPARING, MeetingMode.REALTIME
        )

    def test_weekly_report_to_preparing(self, state_machine):
        assert state_machine.can_transition(
            MeetingStatus.WEEKLY_REPORT_LOADED, MeetingStatus.PREPARING, MeetingMode.REALTIME
        )

    def test_preparing_to_in_progress(self, state_machine):
        assert state_machine.can_transition(
            MeetingStatus.PREPARING, MeetingStatus.IN_PROGRESS, MeetingMode.REALTIME
        )

    def test_in_progress_to_recording_done(self, state_machine):
        assert state_machine.can_transition(
            MeetingStatus.IN_PROGRESS, MeetingStatus.RECORDING_DONE, MeetingMode.REALTIME
        )

    def test_recording_done_to_recording_uploaded(self, state_machine):
        assert state_machine.can_transition(
            MeetingStatus.RECORDING_DONE, MeetingStatus.RECORDING_UPLOADED, MeetingMode.REALTIME
        )

    def test_recording_done_to_transcribing_directly(self, state_machine):
        """Can go directly to transcribing if recording already uploaded inline."""
        assert state_machine.can_transition(
            MeetingStatus.RECORDING_DONE, MeetingStatus.TRANSCRIBING, MeetingMode.REALTIME
        )

    def test_realtime_pipeline_continues_to_publish(self, state_machine):
        """Verify full pipeline from transcribing to published."""
        assert state_machine.can_transition(
            MeetingStatus.TRANSCRIBING, MeetingStatus.TRANSCRIBED, MeetingMode.REALTIME
        )
        assert state_machine.can_transition(
            MeetingStatus.TRANSCRIBED, MeetingStatus.GENERATING_MINUTES, MeetingMode.REALTIME
        )
        assert state_machine.can_transition(
            MeetingStatus.GENERATING_MINUTES, MeetingStatus.DRAFT_READY, MeetingMode.REALTIME
        )
        assert state_machine.can_transition(
            MeetingStatus.DRAFT_READY, MeetingStatus.PUBLISHED, MeetingMode.REALTIME
        )

    def test_failed_recovery_to_preparing(self, state_machine):
        assert state_machine.can_transition(
            MeetingStatus.FAILED, MeetingStatus.PREPARING, MeetingMode.REALTIME
        )

    def test_invalid_skip_to_in_progress(self, state_machine):
        """Cannot skip directly to IN_PROGRESS from CREATED."""
        assert not state_machine.can_transition(
            MeetingStatus.CREATED, MeetingStatus.IN_PROGRESS, MeetingMode.REALTIME
        )


class TestValidateTransition:
    """Test validate_transition method raises errors."""

    def test_valid_transition_no_error(self, state_machine):
        # Should not raise
        state_machine.validate_transition(
            MeetingStatus.CREATED, MeetingStatus.RECORDING_UPLOADED, MeetingMode.UPLOAD
        )

    def test_invalid_transition_raises(self, state_machine):
        with pytest.raises(InvalidTransitionError) as exc_info:
            state_machine.validate_transition(
                MeetingStatus.CREATED, MeetingStatus.TRANSCRIBING, MeetingMode.UPLOAD
            )
        assert exc_info.value.from_status == MeetingStatus.CREATED
        assert exc_info.value.to_status == MeetingStatus.TRANSCRIBING

    def test_error_message_format(self, state_machine):
        with pytest.raises(InvalidTransitionError) as exc_info:
            state_machine.validate_transition(
                MeetingStatus.PUBLISHED, MeetingStatus.CREATED, MeetingMode.UPLOAD
            )
        assert "published" in str(exc_info.value).lower()
        assert "created" in str(exc_info.value).lower()


class TestModeSelection:
    """Test that correct transition map is used based on mode."""

    def test_upload_uses_upload_transitions(self, state_machine):
        # PREPARING is only in REALTIME mode
        assert not state_machine.can_transition(
            MeetingStatus.CREATED, MeetingStatus.PREPARING, MeetingMode.UPLOAD
        )

    def test_realtime_uses_realtime_transitions(self, state_machine):
        # IN_PROGRESS is in REALTIME mode
        assert state_machine.can_transition(
            MeetingStatus.PREPARING, MeetingStatus.IN_PROGRESS, MeetingMode.REALTIME
        )

    def test_default_mode_is_upload(self, state_machine):
        """Default mode should be UPLOAD."""
        # Using can_transition without mode should use UPLOAD
        result = state_machine.can_transition(
            MeetingStatus.CREATED, MeetingStatus.RECORDING_UPLOADED
        )
        assert result is True

        # PREPARING requires REALTIME mode, should fail with default
        result = state_machine.can_transition(MeetingStatus.CREATED, MeetingStatus.PREPARING)
        assert result is False


class TestTransitionMapsCompleteness:
    """Test that transition maps are complete."""

    def test_upload_map_covers_required_statuses(self):
        """UPLOAD transitions should cover all upload-relevant statuses."""
        required_statuses = {
            MeetingStatus.CREATED,
            MeetingStatus.WEEKLY_REPORT_LOADED,
            MeetingStatus.RECORDING_UPLOADED,
            MeetingStatus.TRANSCRIBING,
            MeetingStatus.TRANSCRIBED,
            MeetingStatus.GENERATING_MINUTES,
            MeetingStatus.DRAFT_READY,
            MeetingStatus.PUBLISHED,
            MeetingStatus.FAILED,
        }
        map_statuses = set(UPLOAD_TRANSITIONS.keys())
        assert required_statuses.issubset(map_statuses)

    def test_realtime_map_covers_all_statuses(self):
        """All statuses should be keys in realtime transitions."""
        all_statuses = {s.value for s in MeetingStatus}
        map_statuses = {k.value if hasattr(k, "value") else k for k in REALTIME_TRANSITIONS.keys()}
        assert all_statuses == map_statuses
