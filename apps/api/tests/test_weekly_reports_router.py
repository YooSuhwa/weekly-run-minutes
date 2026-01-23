"""Tests for weekly reports API endpoints."""

from unittest.mock import AsyncMock, patch
from uuid import UUID

import pytest
from httpx import AsyncClient

from src.models import WeeklyReport


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
async def meeting_with_report(client: AsyncClient, meeting_id: str, db_session) -> str:  # noqa: ARG001
    """Create a meeting with a weekly report attached."""
    report = WeeklyReport(
        meeting_id=UUID(meeting_id),
        confluence_page_id="page-123",
        confluence_page_url="https://test.atlassian.net/wiki/pages/123",
        raw_html="<table><tr><td>이상윤</td></tr></table>",
        parsed_data={
            "team_members": [
                {
                    "name": "이상윤",
                    "categories": [
                        {
                            "name": "AI",
                            "tasks": [
                                {
                                    "status": "완료",
                                    "title": "GPT 프롬프트 개선",
                                    "details": ["정확도 향상"],
                                }
                            ],
                        }
                    ],
                },
                {
                    "name": "선설희",
                    "categories": [
                        {
                            "name": "SDK",
                            "tasks": [
                                {
                                    "status": "진행",
                                    "title": "SDK 연동",
                                    "details": [],
                                }
                            ],
                        }
                    ],
                },
            ]
        },
    )
    db_session.add(report)
    await db_session.commit()
    return meeting_id


class TestListWeeklyReportPages:
    @pytest.mark.asyncio
    async def test_list_pages_success(self, client: AsyncClient):
        """Should return list of Confluence pages."""
        mock_pages = [
            {"id": "page-1", "title": "주간업무록 2024-01-15", "url": "https://test.atlassian.net/1"},
            {"id": "page-2", "title": "주간업무록 2024-01-08", "url": "https://test.atlassian.net/2"},
        ]
        with patch("src.routers.weekly_reports.ConfluenceService") as mock_cls:
            mock_service = AsyncMock()
            mock_service.find_weekly_reports = AsyncMock(return_value=mock_pages)
            mock_cls.return_value = mock_service

            response = await client.get("/api/v1/weekly-reports/confluence/pages")
            assert response.status_code == 200
            data = response.json()
            assert len(data) == 2
            assert data[0]["id"] == "page-1"
            assert data[0]["title"] == "주간업무록 2024-01-15"

    @pytest.mark.asyncio
    async def test_list_pages_with_filter(self, client: AsyncClient):
        """Should pass title_contains filter."""
        with patch("src.routers.weekly_reports.ConfluenceService") as mock_cls:
            mock_service = AsyncMock()
            mock_service.find_weekly_reports = AsyncMock(return_value=[])
            mock_cls.return_value = mock_service

            response = await client.get(
                "/api/v1/weekly-reports/confluence/pages",
                params={"title_contains": "2024-01", "limit": "5"},
            )
            assert response.status_code == 200
            mock_service.find_weekly_reports.assert_called_once_with(
                title_contains="2024-01", limit=5
            )

    @pytest.mark.asyncio
    async def test_list_pages_confluence_error(self, client: AsyncClient):
        """Should return error on Confluence failure."""
        from src.services.confluence import ConfluenceError

        with patch("src.routers.weekly_reports.ConfluenceService") as mock_cls:
            mock_service = AsyncMock()
            mock_service.find_weekly_reports = AsyncMock(
                side_effect=ConfluenceError("Auth failed", 401)
            )
            mock_cls.return_value = mock_service

            response = await client.get("/api/v1/weekly-reports/confluence/pages")
            assert response.status_code == 401


class TestLoadWeeklyReport:
    @pytest.mark.asyncio
    async def test_meeting_not_found(self, client: AsyncClient):
        response = await client.post(
            "/api/v1/weekly-reports/meetings/00000000-0000-0000-0000-000000000000/weekly-report",
            json={"confluence_page_id": "page-1"},
        )
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_already_loaded(self, client: AsyncClient, meeting_with_report: str):
        """Should reject if report already exists."""
        response = await client.post(
            f"/api/v1/weekly-reports/meetings/{meeting_with_report}/weekly-report",
            json={"confluence_page_id": "page-999"},
        )
        assert response.status_code == 409
        assert "already loaded" in response.json()["detail"]

    @pytest.mark.asyncio
    async def test_confluence_fetch_error(self, client: AsyncClient, meeting_id: str):
        """Should return error when Confluence fetch fails."""
        from src.services.confluence import ConfluenceError

        with patch("src.routers.weekly_reports.ConfluenceService") as mock_cls:
            mock_service = AsyncMock()
            mock_service.get_weekly_report_page = AsyncMock(
                side_effect=ConfluenceError("Page not found", 404)
            )
            mock_cls.return_value = mock_service

            response = await client.post(
                f"/api/v1/weekly-reports/meetings/{meeting_id}/weekly-report",
                json={"confluence_page_id": "nonexistent"},
            )
            assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_load_success(self, client: AsyncClient, meeting_id: str):
        """Should load, parse, and store weekly report."""
        mock_page_data = {
            "html_content": "<table><tr><td>이상윤</td></tr></table>",
            "url": "https://test.atlassian.net/wiki/pages/456",
        }

        with patch("src.routers.weekly_reports.ConfluenceService") as mock_cls:
            mock_service = AsyncMock()
            mock_service.get_weekly_report_page = AsyncMock(return_value=mock_page_data)
            mock_cls.return_value = mock_service

            with patch("src.routers.weekly_reports.WeeklyReportParser") as mock_parser_cls:
                mock_parser = mock_parser_cls.return_value
                mock_parser.parse.return_value = {
                    "team_members": [
                        {"name": "이상윤", "categories": []}
                    ]
                }

                response = await client.post(
                    f"/api/v1/weekly-reports/meetings/{meeting_id}/weekly-report",
                    json={"confluence_page_id": "page-456"},
                )

        assert response.status_code == 201
        data = response.json()
        assert data["confluence_page_id"] == "page-456"
        assert data["confluence_page_url"] == "https://test.atlassian.net/wiki/pages/456"
        assert data["meeting_id"] == meeting_id
        assert len(data["parsed_data"]["team_members"]) == 1


class TestGetMeetingWeeklyReport:
    @pytest.mark.asyncio
    async def test_not_found(self, client: AsyncClient, meeting_id: str):
        response = await client.get(
            f"/api/v1/weekly-reports/meetings/{meeting_id}/weekly-report"
        )
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_get_report(self, client: AsyncClient, meeting_with_report: str):
        response = await client.get(
            f"/api/v1/weekly-reports/meetings/{meeting_with_report}/weekly-report"
        )
        assert response.status_code == 200
        data = response.json()
        assert data["confluence_page_id"] == "page-123"
        assert len(data["parsed_data"]["team_members"]) == 2


class TestGetWeeklyReportSummary:
    @pytest.mark.asyncio
    async def test_not_found(self, client: AsyncClient, meeting_id: str):
        response = await client.get(
            f"/api/v1/weekly-reports/meetings/{meeting_id}/weekly-report/summary"
        )
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_all_members_summary(self, client: AsyncClient, meeting_with_report: str):
        """Should return summary for all members."""
        response = await client.get(
            f"/api/v1/weekly-reports/meetings/{meeting_with_report}/weekly-report/summary"
        )
        assert response.status_code == 200
        data = response.json()
        assert data["member_name"] is None
        assert data["summary"] != ""

    @pytest.mark.asyncio
    async def test_specific_member_summary(self, client: AsyncClient, meeting_with_report: str):
        """Should return summary for specific member."""
        response = await client.get(
            f"/api/v1/weekly-reports/meetings/{meeting_with_report}/weekly-report/summary",
            params={"member_name": "이상윤"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["member_name"] == "이상윤"
