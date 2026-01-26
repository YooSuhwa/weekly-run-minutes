"""Tests for minutes API endpoints."""

from contextlib import asynccontextmanager
from unittest.mock import AsyncMock, patch
from uuid import UUID

import pytest
from httpx import AsyncClient
from sqlalchemy import select

from src.models import Meeting, MeetingMinutes, MeetingStatus, Transcript
from src.models.team import Team, TeamMember
from src.models.weekly_report import WeeklyReport
from src.routers.minutes import generate_minutes_task
from src.services.minutes_generator import (
    CorrectionItem,
    MinutesGenerationError,
    MinutesGenerationResult,
)


@pytest.fixture
async def team_id(client: AsyncClient) -> str:
    response = await client.post("/api/v1/teams", json={"name": "제품기술팀"})
    return response.json()["id"]


@pytest.fixture
async def meeting_id(client: AsyncClient, team_id: str) -> str:
    response = await client.post(
        "/api/v1/meetings",
        json={"team_id": team_id, "meeting_date": "2024-01-15", "title": "주간회의"},
    )
    return response.json()["id"]


@pytest.fixture
async def meeting_with_minutes(client: AsyncClient, meeting_id: str, db_session) -> str:
    """Create a meeting with minutes attached."""
    from uuid import UUID

    # Update meeting status to DRAFT_READY
    await client.patch(
        f"/api/v1/meetings/{meeting_id}/status",
        json={"status": "draft_ready"},
    )

    # Create minutes directly in DB with position data for highlighting
    minutes = MeetingMinutes(
        meeting_id=UUID(meeting_id),
        content_markdown="# 2024-01-15 주간회의 회의록\n\n## 참석자\n- 이상윤",
        ai_model="gpt-4o",
        prompt_version="1.1.0",
        corrections=[
            {
                "original": "에스디케이",
                "corrected": "SDK",
                "category": "terminology",
                "paragraph_index": 3,
                "start_offset": 2,
                "end_offset": 5,
            },
            {
                "original": "2024.1.15",
                "corrected": "2024-01-15",
                "category": "formatting",
                "paragraph_index": 0,
                "start_offset": 2,
                "end_offset": 12,
            },
        ],
    )
    db_session.add(minutes)
    await db_session.commit()
    return meeting_id


class TestStartMinutesGeneration:
    @pytest.mark.asyncio
    async def test_not_found(self, client: AsyncClient):
        response = await client.post(
            "/api/v1/minutes/meetings/00000000-0000-0000-0000-000000000000/generate-minutes"
        )
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_transcription_not_done(self, client: AsyncClient, meeting_id: str):
        """Should reject if meeting is in CREATED status."""
        response = await client.post(
            f"/api/v1/minutes/meetings/{meeting_id}/generate-minutes"
        )
        assert response.status_code == 400
        assert "Transcription must be completed" in response.json()["detail"]

    @pytest.mark.asyncio
    async def test_start_generation_success(self, client: AsyncClient, meeting_id: str):
        """Should accept if meeting is TRANSCRIBED."""
        # Set status to TRANSCRIBED
        await client.patch(
            f"/api/v1/meetings/{meeting_id}/status",
            json={"status": "transcribed"},
        )

        # Mock background task to avoid DB connection issues in test
        with patch("src.routers.minutes.generate_minutes_task"):
            response = await client.post(
                f"/api/v1/minutes/meetings/{meeting_id}/generate-minutes"
            )
        assert response.status_code == 202
        data = response.json()
        assert data["status"] == "generating_minutes"
        assert data["has_minutes"] is False

    @pytest.mark.asyncio
    async def test_already_has_minutes(self, client: AsyncClient, meeting_with_minutes: str):
        """Should return existing if minutes already generated."""
        response = await client.post(
            f"/api/v1/minutes/meetings/{meeting_with_minutes}/generate-minutes"
        )
        assert response.status_code == 202
        data = response.json()
        assert data["has_minutes"] is True

    @pytest.mark.asyncio
    async def test_already_generating(self, client: AsyncClient, meeting_id: str):
        """Should not start again if already generating."""
        await client.patch(
            f"/api/v1/meetings/{meeting_id}/status",
            json={"status": "generating_minutes"},
        )

        response = await client.post(
            f"/api/v1/minutes/meetings/{meeting_id}/generate-minutes"
        )
        assert response.status_code == 202
        assert response.json()["status"] == "generating_minutes"


class TestGetMeetingMinutes:
    @pytest.mark.asyncio
    async def test_get_minutes(self, client: AsyncClient, meeting_with_minutes: str):
        response = await client.get(
            f"/api/v1/minutes/meetings/{meeting_with_minutes}/minutes"
        )
        assert response.status_code == 200
        data = response.json()
        assert "회의록" in data["content_markdown"]
        assert data["ai_model"] == "gpt-4o"
        assert data["is_edited"] is False

    @pytest.mark.asyncio
    async def test_get_minutes_includes_corrections(
        self, client: AsyncClient, meeting_with_minutes: str
    ):
        response = await client.get(
            f"/api/v1/minutes/meetings/{meeting_with_minutes}/minutes"
        )
        assert response.status_code == 200
        data = response.json()
        assert "corrections" in data
        assert len(data["corrections"]) == 2
        assert data["corrections"][0]["original"] == "에스디케이"
        assert data["corrections"][0]["corrected"] == "SDK"
        assert data["corrections"][0]["category"] == "terminology"
        assert data["corrections"][1]["category"] == "formatting"

    @pytest.mark.asyncio
    async def test_get_minutes_corrections_include_position_data(
        self, client: AsyncClient, meeting_with_minutes: str
    ):
        """Verify that corrections include position data for inline highlighting."""
        response = await client.get(
            f"/api/v1/minutes/meetings/{meeting_with_minutes}/minutes"
        )
        assert response.status_code == 200
        data = response.json()

        # First correction should have position data
        correction_0 = data["corrections"][0]
        assert correction_0["paragraph_index"] == 3
        assert correction_0["start_offset"] == 2
        assert correction_0["end_offset"] == 5

        # Second correction should also have position data
        correction_1 = data["corrections"][1]
        assert correction_1["paragraph_index"] == 0
        assert correction_1["start_offset"] == 2
        assert correction_1["end_offset"] == 12

    @pytest.mark.asyncio
    async def test_get_minutes_not_found(self, client: AsyncClient, meeting_id: str):
        response = await client.get(f"/api/v1/minutes/meetings/{meeting_id}/minutes")
        assert response.status_code == 404


class TestUpdateMeetingMinutes:
    @pytest.mark.asyncio
    async def test_update_minutes(self, client: AsyncClient, meeting_with_minutes: str):
        response = await client.put(
            f"/api/v1/minutes/meetings/{meeting_with_minutes}/minutes",
            json={"content_markdown": "# 수정된 회의록\n\n## 내용\n- 수정됨"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["is_edited"] is True
        assert data["edited_content"] == "# 수정된 회의록\n\n## 내용\n- 수정됨"

    @pytest.mark.asyncio
    async def test_update_minutes_not_found(self, client: AsyncClient, meeting_id: str):
        response = await client.put(
            f"/api/v1/minutes/meetings/{meeting_id}/minutes",
            json={"content_markdown": "test"},
        )
        assert response.status_code == 404


class TestPublishMinutes:
    @pytest.mark.asyncio
    async def test_publish_not_found(self, client: AsyncClient):
        response = await client.post(
            "/api/v1/minutes/meetings/00000000-0000-0000-0000-000000000000/publish"
        )
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_publish_no_minutes(self, client: AsyncClient, meeting_id: str):
        response = await client.post(f"/api/v1/minutes/meetings/{meeting_id}/publish")
        assert response.status_code == 400
        assert "Minutes must be generated first" in response.json()["detail"]

    @pytest.mark.asyncio
    async def test_publish_success(self, client: AsyncClient, meeting_with_minutes: str):
        with patch("src.routers.minutes.ConfluenceService") as mock_service_cls:
            mock_service = AsyncMock()
            mock_service.upload_meeting_minutes = AsyncMock(
                return_value={
                    "id": "confluence-page-123",
                    "url": "https://test.atlassian.net/wiki/pages/123",
                    "title": "회의록",
                }
            )
            mock_service_cls.return_value = mock_service

            response = await client.post(
                f"/api/v1/minutes/meetings/{meeting_with_minutes}/publish"
            )
            assert response.status_code == 200
            data = response.json()
            assert data["confluence_page_id"] == "confluence-page-123"
            assert data["confluence_page_url"] == "https://test.atlassian.net/wiki/pages/123"

    @pytest.mark.asyncio
    async def test_publish_already_published(
        self, client: AsyncClient, meeting_with_minutes: str
    ):
        # First publish
        with patch("src.routers.minutes.ConfluenceService") as mock_service_cls:
            mock_service = AsyncMock()
            mock_service.upload_meeting_minutes = AsyncMock(
                return_value={
                    "id": "page-1",
                    "url": "https://test.atlassian.net/wiki/pages/1",
                    "title": "회의록",
                }
            )
            mock_service_cls.return_value = mock_service
            await client.post(f"/api/v1/minutes/meetings/{meeting_with_minutes}/publish")

        # Second publish should fail
        response = await client.post(
            f"/api/v1/minutes/meetings/{meeting_with_minutes}/publish"
        )
        assert response.status_code == 409

    @pytest.mark.asyncio
    async def test_publish_confluence_error(
        self, client: AsyncClient, meeting_with_minutes: str
    ):
        from src.services.confluence import ConfluenceError

        with patch("src.routers.minutes.ConfluenceService") as mock_service_cls:
            mock_service = AsyncMock()
            mock_service.upload_meeting_minutes = AsyncMock(
                side_effect=ConfluenceError("Upload failed", 500)
            )
            mock_service_cls.return_value = mock_service

            response = await client.post(
                f"/api/v1/minutes/meetings/{meeting_with_minutes}/publish"
            )
            assert response.status_code == 500


class TestExportMinutes:
    @pytest.mark.asyncio
    async def test_export_markdown(self, client: AsyncClient, meeting_with_minutes: str):
        response = await client.get(
            f"/api/v1/minutes/meetings/{meeting_with_minutes}/minutes/export?format=markdown"
        )
        assert response.status_code == 200
        data = response.json()
        assert data["format"] == "markdown"
        assert "회의록" in data["content"]

    @pytest.mark.asyncio
    async def test_export_not_found(self, client: AsyncClient, meeting_id: str):
        response = await client.get(
            f"/api/v1/minutes/meetings/{meeting_id}/minutes/export"
        )
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_export_html(self, client: AsyncClient, meeting_with_minutes: str):
        """Should convert markdown to HTML and return it."""
        response = await client.get(
            f"/api/v1/minutes/meetings/{meeting_with_minutes}/minutes/export?format=html"
        )
        assert response.status_code == 200
        data = response.json()
        assert data["format"] == "html"
        # The markdown heading should be converted to an HTML h1 tag
        assert "<h1>" in data["content"] or "<h1 " in data["content"]
        assert "회의록" in data["content"]

    @pytest.mark.asyncio
    async def test_export_unsupported_format(
        self, client: AsyncClient, meeting_with_minutes: str
    ):
        response = await client.get(
            f"/api/v1/minutes/meetings/{meeting_with_minutes}/minutes/export?format=pdf"
        )
        assert response.status_code == 400


class TestGenerateMinutesTask:
    """Tests for the generate_minutes_task background task."""

    @pytest.fixture
    async def meeting_with_transcripts_for_generation(
        self, client: AsyncClient, db_session
    ) -> str:
        """Create a full meeting setup with team, members, transcripts, and weekly report."""
        # Create team with members
        team_response = await client.post("/api/v1/teams", json={"name": "제품기술팀"})
        team_id = team_response.json()["id"]

        # Add team members
        await client.post(
            f"/api/v1/teams/{team_id}/members",
            json={"name": "이상윤", "presentation_order": 1},
        )
        await client.post(
            f"/api/v1/teams/{team_id}/members",
            json={"name": "선설희", "presentation_order": 2},
        )

        # Create meeting
        meeting_response = await client.post(
            "/api/v1/meetings",
            json={"team_id": team_id, "meeting_date": "2024-01-15", "title": "주간회의"},
        )
        meeting_id = meeting_response.json()["id"]
        mid = UUID(meeting_id)

        # Set status to transcribed
        await client.patch(
            f"/api/v1/meetings/{meeting_id}/status",
            json={"status": "transcribed"},
        )

        # Add transcript segments
        segments = [
            Transcript(
                meeting_id=mid,
                start_time=0.0,
                end_time=5.0,
                text="안녕하세요, 주간회의 시작합니다.",
                speaker_label="speaker_0",
                speaker_name="이상윤",
                confidence=0.95,
            ),
            Transcript(
                meeting_id=mid,
                start_time=5.0,
                end_time=12.0,
                text="에스디케이 연동 작업 완료했습니다.",
                speaker_label="speaker_0",
                speaker_name="이상윤",
                confidence=0.90,
            ),
        ]
        for seg in segments:
            db_session.add(seg)

        # Add weekly report
        weekly_report = WeeklyReport(
            meeting_id=mid,
            confluence_page_id="page-123",
            confluence_page_url="https://confluence.example.com/page/123",
            raw_html="<table><tr><td>이상윤</td><td>SDK</td><td>[진행] SDK 연동</td><td>상세</td></tr></table>",
            parsed_data={
                "team_members": [
                    {
                        "name": "이상윤",
                        "categories": [
                            {
                                "name": "SDK",
                                "tasks": [
                                    {
                                        "status": "진행",
                                        "title": "SDK 연동",
                                        "details": ["API 연동 진행 중"],
                                    }
                                ],
                            }
                        ],
                    }
                ]
            },
        )
        db_session.add(weekly_report)
        await db_session.commit()

        return meeting_id

    @pytest.mark.asyncio
    async def test_successful_generation(
        self, client: AsyncClient, meeting_with_transcripts_for_generation: str, db_session
    ):
        """Should generate minutes and store them with corrections."""
        meeting_id = UUID(meeting_with_transcripts_for_generation)

        mock_minutes_result = MinutesGenerationResult(
            content_markdown="# 2024-01-15 주간회의 회의록\n\n## 참석자\n- 이상윤\n- 선설희\n\n## 팀원별 업무 보고\n\n### 이상윤\n- [완료] SDK 연동 작업 완료",
            ai_model="gpt-4o",
            prompt_version="2.0.0",
            corrections=[
                CorrectionItem(
                    original="에스디케이",
                    corrected="SDK",
                    category="terminology",
                    paragraph_index=7,
                    start_offset=8,
                    end_offset=11,
                ),
            ],
        )

        @asynccontextmanager
        async def mock_session_factory():
            yield db_session

        with (
            patch("src.routers.minutes.async_session_factory", mock_session_factory),
            patch("src.routers.minutes.MinutesGeneratorService") as mock_gen_cls,
        ):
            mock_gen = AsyncMock()
            mock_gen.generate_minutes = AsyncMock(return_value=mock_minutes_result)
            mock_gen_cls.return_value = mock_gen

            await generate_minutes_task(meeting_id)

        # Verify meeting status is DRAFT_READY
        result = await db_session.execute(
            select(Meeting).where(Meeting.id == meeting_id)
        )
        meeting = result.scalar_one()
        assert meeting.status == MeetingStatus.DRAFT_READY

        # Verify minutes were stored
        minutes_result = await db_session.execute(
            select(MeetingMinutes).where(MeetingMinutes.meeting_id == meeting_id)
        )
        minutes = minutes_result.scalar_one()
        assert "회의록" in minutes.content_markdown
        assert minutes.ai_model == "gpt-4o"
        assert minutes.prompt_version == "2.0.0"
        assert len(minutes.corrections) == 1
        assert minutes.corrections[0]["original"] == "에스디케이"
        assert minutes.corrections[0]["corrected"] == "SDK"
        assert minutes.corrections[0]["category"] == "terminology"
        assert minutes.corrections[0]["paragraph_index"] == 7
        assert minutes.corrections[0]["start_offset"] == 8
        assert minutes.corrections[0]["end_offset"] == 11

    @pytest.mark.asyncio
    async def test_meeting_not_found(self, db_session):
        """Should return early if meeting not found."""
        fake_id = UUID("00000000-0000-0000-0000-000000000099")

        @asynccontextmanager
        async def mock_session_factory():
            yield db_session

        with patch("src.routers.minutes.async_session_factory", mock_session_factory):
            # Should not raise, just return
            await generate_minutes_task(fake_id)

    @pytest.mark.asyncio
    async def test_no_transcripts_sets_failed(
        self, client: AsyncClient, db_session
    ):
        """Should set FAILED status if no transcripts exist."""
        # Create a team and meeting without transcripts
        team_response = await client.post("/api/v1/teams", json={"name": "빈팀"})
        team_id = team_response.json()["id"]

        # Add at least one member
        await client.post(
            f"/api/v1/teams/{team_id}/members",
            json={"name": "테스터", "presentation_order": 1},
        )

        meeting_response = await client.post(
            "/api/v1/meetings",
            json={"team_id": team_id, "meeting_date": "2024-02-01", "title": "빈 회의"},
        )
        meeting_id = UUID(meeting_response.json()["id"])

        # Set status to transcribed (even though no transcripts)
        await client.patch(
            f"/api/v1/meetings/{str(meeting_id)}/status",
            json={"status": "transcribed"},
        )

        @asynccontextmanager
        async def mock_session_factory():
            yield db_session

        with patch("src.routers.minutes.async_session_factory", mock_session_factory):
            await generate_minutes_task(meeting_id)

        # Verify meeting is FAILED
        result = await db_session.execute(
            select(Meeting).where(Meeting.id == meeting_id)
        )
        meeting = result.scalar_one()
        assert meeting.status == MeetingStatus.FAILED
        assert "No transcripts available" in meeting.error_message

    @pytest.mark.asyncio
    async def test_minutes_generation_error_sets_failed(
        self, client: AsyncClient, meeting_with_transcripts_for_generation: str, db_session
    ):
        """Should set FAILED status when MinutesGenerationError occurs."""
        meeting_id = UUID(meeting_with_transcripts_for_generation)

        @asynccontextmanager
        async def mock_session_factory():
            yield db_session

        with (
            patch("src.routers.minutes.async_session_factory", mock_session_factory),
            patch("src.routers.minutes.MinutesGeneratorService") as mock_gen_cls,
        ):
            mock_gen = AsyncMock()
            mock_gen.generate_minutes = AsyncMock(
                side_effect=MinutesGenerationError("GPT API rate limit exceeded")
            )
            mock_gen_cls.return_value = mock_gen

            await generate_minutes_task(meeting_id)

        # Verify meeting is FAILED with correct error message
        result = await db_session.execute(
            select(Meeting).where(Meeting.id == meeting_id)
        )
        meeting = result.scalar_one()
        assert meeting.status == MeetingStatus.FAILED
        assert "GPT API rate limit exceeded" in meeting.error_message

    @pytest.mark.asyncio
    async def test_unexpected_error_sets_failed(
        self, client: AsyncClient, meeting_with_transcripts_for_generation: str, db_session
    ):
        """Should set FAILED status when unexpected exception occurs."""
        meeting_id = UUID(meeting_with_transcripts_for_generation)

        @asynccontextmanager
        async def mock_session_factory():
            yield db_session

        with (
            patch("src.routers.minutes.async_session_factory", mock_session_factory),
            patch("src.routers.minutes.MinutesGeneratorService") as mock_gen_cls,
        ):
            mock_gen = AsyncMock()
            mock_gen.generate_minutes = AsyncMock(
                side_effect=RuntimeError("Unexpected network failure")
            )
            mock_gen_cls.return_value = mock_gen

            await generate_minutes_task(meeting_id)

        # Verify meeting is FAILED with generic message
        result = await db_session.execute(
            select(Meeting).where(Meeting.id == meeting_id)
        )
        meeting = result.scalar_one()
        assert meeting.status == MeetingStatus.FAILED
        assert "Minutes generation failed" in meeting.error_message
        assert "Unexpected network failure" in meeting.error_message

    @pytest.mark.asyncio
    async def test_generation_without_weekly_report(
        self, client: AsyncClient, db_session
    ):
        """Should generate minutes even without a weekly report."""
        # Create team with members
        team_response = await client.post("/api/v1/teams", json={"name": "리포트없는팀"})
        team_id = team_response.json()["id"]

        await client.post(
            f"/api/v1/teams/{team_id}/members",
            json={"name": "김테스트", "presentation_order": 1},
        )

        # Create meeting
        meeting_response = await client.post(
            "/api/v1/meetings",
            json={"team_id": team_id, "meeting_date": "2024-03-01", "title": "주간회의"},
        )
        meeting_id = UUID(meeting_response.json()["id"])

        # Set status to transcribed
        await client.patch(
            f"/api/v1/meetings/{str(meeting_id)}/status",
            json={"status": "transcribed"},
        )

        # Add transcript (no weekly report)
        transcript = Transcript(
            meeting_id=meeting_id,
            start_time=0.0,
            end_time=5.0,
            text="이번 주 업무를 보고합니다.",
            speaker_label="speaker_0",
            confidence=0.88,
        )
        db_session.add(transcript)
        await db_session.commit()

        mock_result = MinutesGenerationResult(
            content_markdown="# 2024-03-01 주간회의 회의록\n\n## 참석자\n- 김테스트",
            ai_model="gpt-4o",
            prompt_version="2.0.0",
            corrections=[],
        )

        @asynccontextmanager
        async def mock_session_factory():
            yield db_session

        with (
            patch("src.routers.minutes.async_session_factory", mock_session_factory),
            patch("src.routers.minutes.MinutesGeneratorService") as mock_gen_cls,
        ):
            mock_gen = AsyncMock()
            mock_gen.generate_minutes = AsyncMock(return_value=mock_result)
            mock_gen_cls.return_value = mock_gen

            await generate_minutes_task(meeting_id)

            # Verify generate_minutes was called with empty weekly_report_summary
            call_kwargs = mock_gen.generate_minutes.call_args[1]
            assert call_kwargs["weekly_report_summary"] == ""

        # Verify meeting status is DRAFT_READY
        result = await db_session.execute(
            select(Meeting).where(Meeting.id == meeting_id)
        )
        meeting = result.scalar_one()
        assert meeting.status == MeetingStatus.DRAFT_READY

    @pytest.mark.asyncio
    async def test_transcript_text_building(
        self, client: AsyncClient, db_session
    ):
        """Should build transcript text with correct speaker labels."""
        # Create team with members
        team_response = await client.post("/api/v1/teams", json={"name": "발화팀"})
        team_id = team_response.json()["id"]

        await client.post(
            f"/api/v1/teams/{team_id}/members",
            json={"name": "발화자A", "presentation_order": 1},
        )

        # Create meeting
        meeting_response = await client.post(
            "/api/v1/meetings",
            json={"team_id": team_id, "meeting_date": "2024-04-01", "title": "주간회의"},
        )
        meeting_id = UUID(meeting_response.json()["id"])

        await client.patch(
            f"/api/v1/meetings/{str(meeting_id)}/status",
            json={"status": "transcribed"},
        )

        # Add transcripts with various speaker configurations
        transcripts = [
            Transcript(
                meeting_id=meeting_id,
                start_time=0.0,
                end_time=3.0,
                text="첫번째 발화",
                speaker_name="발화자A",  # has speaker_name
                speaker_label="speaker_0",
                confidence=0.9,
            ),
            Transcript(
                meeting_id=meeting_id,
                start_time=3.0,
                end_time=6.0,
                text="두번째 발화",
                speaker_name=None,  # no speaker_name, has label
                speaker_label="speaker_1",
                confidence=0.85,
            ),
            Transcript(
                meeting_id=meeting_id,
                start_time=6.0,
                end_time=9.0,
                text="세번째 발화",
                speaker_name=None,  # no speaker_name or label
                speaker_label=None,
                confidence=0.8,
            ),
        ]
        for t in transcripts:
            db_session.add(t)
        await db_session.commit()

        mock_result = MinutesGenerationResult(
            content_markdown="# 회의록",
            ai_model="gpt-4o",
            prompt_version="2.0.0",
            corrections=[],
        )

        @asynccontextmanager
        async def mock_session_factory():
            yield db_session

        with (
            patch("src.routers.minutes.async_session_factory", mock_session_factory),
            patch("src.routers.minutes.MinutesGeneratorService") as mock_gen_cls,
        ):
            mock_gen = AsyncMock()
            mock_gen.generate_minutes = AsyncMock(return_value=mock_result)
            mock_gen_cls.return_value = mock_gen

            await generate_minutes_task(meeting_id)

            # Verify transcript_text was built correctly
            call_kwargs = mock_gen.generate_minutes.call_args[1]
            transcript_text = call_kwargs["transcript_text"]

            # speaker_name takes priority
            assert "[발화자A] 첫번째 발화" in transcript_text
            # Falls back to speaker_label
            assert "[speaker_1] 두번째 발화" in transcript_text
            # Falls back to "Speaker"
            assert "[Speaker] 세번째 발화" in transcript_text
