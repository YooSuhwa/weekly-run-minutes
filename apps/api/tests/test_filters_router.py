"""Tests for filters router endpoints."""

from datetime import date
from uuid import uuid4

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.models import FilteredContent, Meeting, Team


@pytest.fixture
async def team(db_session: AsyncSession) -> Team:
    """Create a test team."""
    team = Team(name="테스트팀")
    db_session.add(team)
    await db_session.commit()
    await db_session.refresh(team)
    return team


@pytest.fixture
async def meeting(db_session: AsyncSession, team: Team) -> Meeting:
    """Create a test meeting."""
    meeting = Meeting(
        team_id=team.id,
        title="주간회의",
        meeting_date=date(2024, 1, 15),
    )
    db_session.add(meeting)
    await db_session.commit()
    await db_session.refresh(meeting)
    return meeting


@pytest.fixture
async def filtered_contents(
    db_session: AsyncSession,
    meeting: Meeting,
) -> list[FilteredContent]:
    """Create test filtered content items."""
    contents = [
        FilteredContent(
            meeting_id=meeting.id,
            content="안녕하세요, 좋은 아침이에요.",
            filter_reason="greeting",
            confidence=0.9,
            speaker_name="이상윤",
            start_time=0.0,
            end_time=3.0,
        ),
        FilteredContent(
            meeting_id=meeting.id,
            content="오늘 날씨 좋네요.",
            filter_reason="casual_talk",
            confidence=0.85,
            speaker_name="선설희",
            start_time=3.0,
            end_time=5.0,
        ),
        FilteredContent(
            meeting_id=meeting.id,
            content="주말에 뭐 하셨어요?",
            filter_reason="small_talk",
            confidence=0.8,
            speaker_name="최보연",
            start_time=5.0,
            end_time=8.0,
            is_restored=True,  # Already restored
        ),
    ]
    for content in contents:
        db_session.add(content)
    await db_session.commit()
    for content in contents:
        await db_session.refresh(content)
    return contents


class TestGetFilteredContent:
    """Tests for GET /api/v1/filters/meetings/{meeting_id}/filtered."""

    @pytest.mark.asyncio
    async def test_get_filtered_content_success(
        self,
        client: AsyncClient,
        meeting: Meeting,
        filtered_contents: list[FilteredContent],  # noqa: ARG002
    ):
        """Should return filtered content for a meeting."""
        response = await client.get(
            f"/api/v1/filters/meetings/{meeting.id}/filtered"
        )

        assert response.status_code == 200
        data = response.json()
        assert data["meeting_id"] == str(meeting.id)
        assert data["total_count"] == 3
        # By default, restored items are excluded
        assert len(data["items"]) == 2
        assert data["restored_count"] == 1

    @pytest.mark.asyncio
    async def test_get_filtered_content_include_restored(
        self,
        client: AsyncClient,
        meeting: Meeting,
        filtered_contents: list[FilteredContent],  # noqa: ARG002
    ):
        """Should include restored items when requested."""
        response = await client.get(
            f"/api/v1/filters/meetings/{meeting.id}/filtered",
            params={"include_restored": True},
        )

        assert response.status_code == 200
        data = response.json()
        assert len(data["items"]) == 3

    @pytest.mark.asyncio
    async def test_get_filtered_content_meeting_not_found(
        self,
        client: AsyncClient,
    ):
        """Should return 404 for non-existent meeting."""
        response = await client.get(
            f"/api/v1/filters/meetings/{uuid4()}/filtered"
        )

        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_get_filtered_content_empty(
        self,
        client: AsyncClient,
        meeting: Meeting,
    ):
        """Should return empty list when no filtered content."""
        response = await client.get(
            f"/api/v1/filters/meetings/{meeting.id}/filtered"
        )

        assert response.status_code == 200
        data = response.json()
        assert len(data["items"]) == 0
        assert data["total_count"] == 0


class TestGetFilteredContentById:
    """Tests for GET /api/v1/filters/meetings/{meeting_id}/filtered/{content_id}."""

    @pytest.mark.asyncio
    async def test_get_by_id_success(
        self,
        client: AsyncClient,
        meeting: Meeting,
        filtered_contents: list[FilteredContent],  # noqa: ARG002
    ):
        """Should return specific filtered content."""
        content = filtered_contents[0]
        response = await client.get(
            f"/api/v1/filters/meetings/{meeting.id}/filtered/{content.id}"
        )

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == str(content.id)
        assert data["content"] == content.content
        assert data["filter_reason"] == content.filter_reason

    @pytest.mark.asyncio
    async def test_get_by_id_not_found(
        self,
        client: AsyncClient,
        meeting: Meeting,
    ):
        """Should return 404 for non-existent content."""
        response = await client.get(
            f"/api/v1/filters/meetings/{meeting.id}/filtered/{uuid4()}"
        )

        assert response.status_code == 404


class TestRestoreFilteredContent:
    """Tests for POST /api/v1/filters/meetings/{meeting_id}/filtered/{id}/restore."""

    @pytest.mark.asyncio
    async def test_restore_success(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
        meeting: Meeting,
        filtered_contents: list[FilteredContent],  # noqa: ARG002
    ):
        """Should restore filtered content."""
        content = filtered_contents[0]
        assert content.is_restored is False

        response = await client.post(
            f"/api/v1/filters/meetings/{meeting.id}/filtered/{content.id}/restore"
        )

        assert response.status_code == 200
        data = response.json()
        assert data["is_restored"] is True
        assert "restored successfully" in data["message"]

        # Verify in database
        await db_session.refresh(content)
        assert content.is_restored is True
        assert content.is_confirmed is False

    @pytest.mark.asyncio
    async def test_restore_already_restored(
        self,
        client: AsyncClient,
        meeting: Meeting,
        filtered_contents: list[FilteredContent],  # noqa: ARG002
    ):
        """Should handle already restored content gracefully."""
        content = filtered_contents[2]  # Already restored
        assert content.is_restored is True

        response = await client.post(
            f"/api/v1/filters/meetings/{meeting.id}/filtered/{content.id}/restore"
        )

        assert response.status_code == 200
        data = response.json()
        assert "already restored" in data["message"]

    @pytest.mark.asyncio
    async def test_restore_not_found(
        self,
        client: AsyncClient,
        meeting: Meeting,
    ):
        """Should return 404 for non-existent content."""
        response = await client.post(
            f"/api/v1/filters/meetings/{meeting.id}/filtered/{uuid4()}/restore"
        )

        assert response.status_code == 404


class TestConfirmFilteredContent:
    """Tests for POST /api/v1/filters/meetings/{meeting_id}/filtered/{id}/confirm."""

    @pytest.mark.asyncio
    async def test_confirm_success(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
        meeting: Meeting,
        filtered_contents: list[FilteredContent],  # noqa: ARG002
    ):
        """Should confirm filtered content as casual talk."""
        content = filtered_contents[0]

        response = await client.post(
            f"/api/v1/filters/meetings/{meeting.id}/filtered/{content.id}/confirm"
        )

        assert response.status_code == 200
        data = response.json()
        assert data["is_confirmed"] is True

        # Verify in database
        await db_session.refresh(content)
        assert content.is_confirmed is True

    @pytest.mark.asyncio
    async def test_confirm_restored_content_fails(
        self,
        client: AsyncClient,
        meeting: Meeting,
        filtered_contents: list[FilteredContent],  # noqa: ARG002
    ):
        """Should reject confirming restored content."""
        content = filtered_contents[2]  # Already restored
        assert content.is_restored is True

        response = await client.post(
            f"/api/v1/filters/meetings/{meeting.id}/filtered/{content.id}/confirm"
        )

        assert response.status_code == 400
        assert "Cannot confirm restored content" in response.json()["detail"]

    @pytest.mark.asyncio
    async def test_confirm_already_confirmed(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
        meeting: Meeting,
        filtered_contents: list[FilteredContent],  # noqa: ARG002
    ):
        """Should handle already confirmed content gracefully."""
        content = filtered_contents[0]
        content.is_confirmed = True
        await db_session.commit()

        response = await client.post(
            f"/api/v1/filters/meetings/{meeting.id}/filtered/{content.id}/confirm"
        )

        assert response.status_code == 200
        assert "already confirmed" in response.json()["message"]


class TestUndoRestore:
    """Tests for DELETE /api/v1/filters/meetings/{meeting_id}/filtered/{id}/restore."""

    @pytest.mark.asyncio
    async def test_undo_restore_success(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
        meeting: Meeting,
        filtered_contents: list[FilteredContent],  # noqa: ARG002
    ):
        """Should undo restore action."""
        content = filtered_contents[2]  # Already restored
        assert content.is_restored is True

        response = await client.delete(
            f"/api/v1/filters/meetings/{meeting.id}/filtered/{content.id}/restore"
        )

        assert response.status_code == 200
        data = response.json()
        assert data["is_restored"] is False

        # Verify in database
        await db_session.refresh(content)
        assert content.is_restored is False

    @pytest.mark.asyncio
    async def test_undo_restore_not_restored(
        self,
        client: AsyncClient,
        meeting: Meeting,
        filtered_contents: list[FilteredContent],  # noqa: ARG002
    ):
        """Should handle non-restored content gracefully."""
        content = filtered_contents[0]
        assert content.is_restored is False

        response = await client.delete(
            f"/api/v1/filters/meetings/{meeting.id}/filtered/{content.id}/restore"
        )

        assert response.status_code == 200
        assert "was not restored" in response.json()["message"]


class TestGetFilterStats:
    """Tests for GET /api/v1/filters/meetings/{meeting_id}/filtered/stats."""

    @pytest.mark.asyncio
    async def test_get_stats_success(
        self,
        client: AsyncClient,
        meeting: Meeting,
        filtered_contents: list[FilteredContent],  # noqa: ARG002
    ):
        """Should return filter statistics."""
        response = await client.get(
            f"/api/v1/filters/meetings/{meeting.id}/filtered/stats"
        )

        assert response.status_code == 200
        data = response.json()
        assert data["meeting_id"] == str(meeting.id)
        assert data["total_filtered"] == 3
        assert data["restored_count"] == 1
        assert "greeting" in data["by_reason"]
        assert "casual_talk" in data["by_reason"]
        assert "small_talk" in data["by_reason"]
        assert data["average_confidence"] is not None

    @pytest.mark.asyncio
    async def test_get_stats_empty(
        self,
        client: AsyncClient,
        meeting: Meeting,
    ):
        """Should return zero stats when no filtered content."""
        response = await client.get(
            f"/api/v1/filters/meetings/{meeting.id}/filtered/stats"
        )

        assert response.status_code == 200
        data = response.json()
        assert data["total_filtered"] == 0
        assert data["by_reason"] == {}
        assert data["average_confidence"] is None

    @pytest.mark.asyncio
    async def test_get_stats_meeting_not_found(
        self,
        client: AsyncClient,
    ):
        """Should return 404 for non-existent meeting."""
        response = await client.get(
            f"/api/v1/filters/meetings/{uuid4()}/filtered/stats"
        )

        assert response.status_code == 404


class TestRestoreAll:
    """Tests for POST /api/v1/filters/meetings/{meeting_id}/filtered/restore-all."""

    @pytest.mark.asyncio
    async def test_restore_all_success(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
        meeting: Meeting,
        filtered_contents: list[FilteredContent],  # noqa: ARG002
    ):
        """Should restore all non-restored filtered content."""
        response = await client.post(
            f"/api/v1/filters/meetings/{meeting.id}/filtered/restore-all"
        )

        assert response.status_code == 200
        data = response.json()
        # Only 2 items were not restored
        assert data["restored_count"] == 2

        # Verify in database
        result = await db_session.execute(
            select(FilteredContent).where(FilteredContent.meeting_id == meeting.id)
        )
        all_items = list(result.scalars().all())
        assert all(item.is_restored for item in all_items)

    @pytest.mark.asyncio
    async def test_restore_all_meeting_not_found(
        self,
        client: AsyncClient,
    ):
        """Should return 404 for non-existent meeting."""
        response = await client.post(
            f"/api/v1/filters/meetings/{uuid4()}/filtered/restore-all"
        )

        assert response.status_code == 404


class TestConfirmAll:
    """Tests for POST /api/v1/filters/meetings/{meeting_id}/filtered/confirm-all."""

    @pytest.mark.asyncio
    async def test_confirm_all_success(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
        meeting: Meeting,
        filtered_contents: list[FilteredContent],  # noqa: ARG002
    ):
        """Should confirm all non-restored filtered content."""
        response = await client.post(
            f"/api/v1/filters/meetings/{meeting.id}/filtered/confirm-all"
        )

        assert response.status_code == 200
        data = response.json()
        # Only 2 items are not restored and not confirmed
        assert data["confirmed_count"] == 2

        # Verify in database
        result = await db_session.execute(
            select(FilteredContent).where(
                FilteredContent.meeting_id == meeting.id,
                FilteredContent.is_restored == False,  # noqa: E712
            )
        )
        non_restored = list(result.scalars().all())
        assert all(item.is_confirmed for item in non_restored)

    @pytest.mark.asyncio
    async def test_confirm_all_meeting_not_found(
        self,
        client: AsyncClient,
    ):
        """Should return 404 for non-existent meeting."""
        response = await client.post(
            f"/api/v1/filters/meetings/{uuid4()}/filtered/confirm-all"
        )

        assert response.status_code == 404


class TestFilteredContentResponse:
    """Tests for FilteredContentResponse schema."""

    @pytest.mark.asyncio
    async def test_response_includes_all_fields(
        self,
        client: AsyncClient,
        meeting: Meeting,
        filtered_contents: list[FilteredContent],  # noqa: ARG002
    ):
        """Should include all expected fields in response."""
        content = filtered_contents[0]
        response = await client.get(
            f"/api/v1/filters/meetings/{meeting.id}/filtered/{content.id}"
        )

        assert response.status_code == 200
        data = response.json()

        # Check all expected fields
        assert "id" in data
        assert "meeting_id" in data
        assert "content" in data
        assert "filter_reason" in data
        assert "confidence" in data
        assert "is_restored" in data
        assert "is_confirmed" in data
        assert "speaker_label" in data
        assert "speaker_name" in data
        assert "start_time" in data
        assert "end_time" in data
        assert "created_at" in data
