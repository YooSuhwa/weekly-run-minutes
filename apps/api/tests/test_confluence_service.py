"""Tests for Confluence service."""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from src.services.confluence import ConfluenceError, ConfluenceService


@pytest.fixture
def confluence_service():
    with patch("src.services.confluence.settings") as mock_settings:
        mock_settings.CONFLUENCE_BASE_URL = "https://test.atlassian.net/wiki"
        mock_settings.CONFLUENCE_USERNAME = "test@test.com"
        mock_settings.CONFLUENCE_TOKEN = "test-token"
        mock_settings.CONFLUENCE_SPACE_ID = "TEST"
        mock_settings.CONFLUENCE_REPORT_PARENT_PAGE_ID = "parent-123"
        mock_settings.CONFLUENCE_MINUTES_PARENT_PAGE_ID = "minutes-456"
        yield ConfluenceService()


class TestConfluenceServiceInit:
    def test_service_config(self, confluence_service):
        assert confluence_service.base_url == "https://test.atlassian.net/wiki"
        assert confluence_service.api_url == "https://test.atlassian.net/wiki/api/v2"
        assert confluence_service.space_id == "TEST"

    def test_headers(self, confluence_service):
        headers = confluence_service._get_headers()
        assert headers["Accept"] == "application/json"
        assert headers["Content-Type"] == "application/json"


class TestGetPageById:
    @pytest.mark.asyncio
    async def test_success(self, confluence_service):
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "id": "page-1",
            "title": "Test Page",
            "body": {"storage": {"value": "<p>content</p>"}},
            "version": {"number": 1},
        }

        with patch("httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client.get = AsyncMock(return_value=mock_response)
            mock_client_cls.return_value = mock_client

            result = await confluence_service.get_page_by_id("page-1")
            assert result["id"] == "page-1"
            assert result["title"] == "Test Page"

    @pytest.mark.asyncio
    async def test_page_not_found(self, confluence_service):
        mock_response = MagicMock()
        mock_response.status_code = 404
        mock_response.text = "Not found"

        with patch("httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client.get = AsyncMock(return_value=mock_response)
            mock_client_cls.return_value = mock_client

            with pytest.raises(ConfluenceError, match="not found"):
                await confluence_service.get_page_by_id("nonexistent")

    @pytest.mark.asyncio
    async def test_api_error(self, confluence_service):
        mock_response = MagicMock()
        mock_response.status_code = 500
        mock_response.text = "Server error"

        with patch("httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client.get = AsyncMock(return_value=mock_response)
            mock_client_cls.return_value = mock_client

            with pytest.raises(ConfluenceError, match="Failed to fetch"):
                await confluence_service.get_page_by_id("page-1")


class TestSearchPages:
    @pytest.mark.asyncio
    async def test_search_success(self, confluence_service):
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "results": [
                {"id": "1", "title": "Page 1"},
                {"id": "2", "title": "Page 2"},
            ]
        }

        with patch("httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client.get = AsyncMock(return_value=mock_response)
            mock_client_cls.return_value = mock_client

            result = await confluence_service.search_pages(title="Page")
            assert len(result) == 2

    @pytest.mark.asyncio
    async def test_search_error(self, confluence_service):
        mock_response = MagicMock()
        mock_response.status_code = 403
        mock_response.text = "Forbidden"

        with patch("httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client.get = AsyncMock(return_value=mock_response)
            mock_client_cls.return_value = mock_client

            with pytest.raises(ConfluenceError, match="Search failed"):
                await confluence_service.search_pages()


class TestGetWeeklyReportPage:
    @pytest.mark.asyncio
    async def test_success(self, confluence_service):
        with patch.object(
            confluence_service,
            "get_page_by_id",
            return_value={
                "id": "report-1",
                "title": "2024-01-15 주간업무록",
                "body": {"storage": {"value": "<table>...</table>"}},
                "version": {"number": 3},
            },
        ):
            result = await confluence_service.get_weekly_report_page("report-1")
            assert result["id"] == "report-1"
            assert result["html_content"] == "<table>...</table>"
            assert result["version"] == 3
            assert "url" in result


class TestCreatePage:
    @pytest.mark.asyncio
    async def test_create_success(self, confluence_service):
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "id": "new-page-1",
            "title": "Test Meeting Minutes",
        }

        with patch("httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client.post = AsyncMock(return_value=mock_response)
            mock_client_cls.return_value = mock_client

            result = await confluence_service.create_page(
                title="Test Meeting Minutes",
                body_html="<p>content</p>",
            )
            assert result["id"] == "new-page-1"

    @pytest.mark.asyncio
    async def test_create_error(self, confluence_service):
        mock_response = MagicMock()
        mock_response.status_code = 400
        mock_response.text = "Bad request"

        with patch("httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client.post = AsyncMock(return_value=mock_response)
            mock_client_cls.return_value = mock_client

            with pytest.raises(ConfluenceError, match="Failed to create"):
                await confluence_service.create_page("title", "<p>body</p>")


class TestUpdatePage:
    @pytest.mark.asyncio
    async def test_update_success(self, confluence_service):
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"id": "page-1", "title": "Updated"}

        with patch("httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client.put = AsyncMock(return_value=mock_response)
            mock_client_cls.return_value = mock_client

            result = await confluence_service.update_page("page-1", "Updated", "<p>new</p>", 1)
            assert result["id"] == "page-1"

    @pytest.mark.asyncio
    async def test_update_error(self, confluence_service):
        mock_response = MagicMock()
        mock_response.status_code = 409
        mock_response.text = "Conflict"

        with patch("httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client.put = AsyncMock(return_value=mock_response)
            mock_client_cls.return_value = mock_client

            with pytest.raises(ConfluenceError, match="Failed to update"):
                await confluence_service.update_page("page-1", "title", "<p>b</p>", 1)


class TestUploadMeetingMinutes:
    @pytest.mark.asyncio
    async def test_upload_success(self, confluence_service):
        with patch.object(
            confluence_service,
            "create_page",
            return_value={"id": "page-99", "title": "2024-01-15 회의록"},
        ):
            result = await confluence_service.upload_meeting_minutes(
                title="2024-01-15 주간회의 회의록",
                markdown_content="# 회의록\n\n## 참석자\n- 이상윤",
            )
            assert result["id"] == "page-99"
            assert "url" in result


class TestMarkdownToConfluenceHtml:
    def setup_method(self):
        with patch("src.services.confluence.settings") as mock_settings:
            mock_settings.CONFLUENCE_BASE_URL = "https://test.atlassian.net/wiki"
            mock_settings.CONFLUENCE_USERNAME = "test@test.com"
            mock_settings.CONFLUENCE_TOKEN = "test-token"
            mock_settings.CONFLUENCE_SPACE_ID = "TEST"
            mock_settings.CONFLUENCE_REPORT_PARENT_PAGE_ID = "p1"
            mock_settings.CONFLUENCE_MINUTES_PARENT_PAGE_ID = "p2"
            self.service = ConfluenceService()

    def test_h1(self):
        result = self.service._markdown_to_confluence_html("# Title")
        assert "<h1>Title</h1>" in result

    def test_h2(self):
        result = self.service._markdown_to_confluence_html("## Section")
        assert "<h2>Section</h2>" in result

    def test_h3(self):
        result = self.service._markdown_to_confluence_html("### Subsection")
        assert "<h3>Subsection</h3>" in result

    def test_unordered_list_dash(self):
        result = self.service._markdown_to_confluence_html("- Item 1\n- Item 2")
        assert "<ul>" in result
        assert "<li>Item 1</li>" in result
        assert "<li>Item 2</li>" in result
        assert "</ul>" in result

    def test_unordered_list_asterisk(self):
        result = self.service._markdown_to_confluence_html("* Item")
        assert "<li>Item</li>" in result

    def test_ordered_list(self):
        result = self.service._markdown_to_confluence_html("1. First\n2. Second")
        assert "<ol>" in result
        assert "<li>First</li>" in result
        assert "<li>Second</li>" in result
        assert "</ol>" in result

    def test_paragraph(self):
        result = self.service._markdown_to_confluence_html("Regular text")
        assert "<p>Regular text</p>" in result

    def test_bold(self):
        result = self.service._markdown_to_confluence_html("**bold text**")
        assert "<strong>bold text</strong>" in result

    def test_italic(self):
        result = self.service._markdown_to_confluence_html("*italic text*")
        assert "<em>italic text</em>" in result

    def test_list_type_switch(self):
        md = "- bullet\n1. numbered"
        result = self.service._markdown_to_confluence_html(md)
        assert "</ul>" in result
        assert "<ol>" in result

    def test_empty_line_closes_list(self):
        md = "- item\n\nParagraph"
        result = self.service._markdown_to_confluence_html(md)
        assert "</ul>" in result
        assert "<p>Paragraph</p>" in result

    def test_full_document(self):
        md = """# 회의록

## 참석자
- 이상윤
- 선설희

## 결정사항
1. 일정 확정
2. 리뷰 진행

**중요:** 다음 주 마감"""
        result = self.service._markdown_to_confluence_html(md)
        assert "<h1>회의록</h1>" in result
        assert "<h2>참석자</h2>" in result
        assert "<li>이상윤</li>" in result
        assert "<li>일정 확정</li>" in result
        assert "<strong>중요:</strong>" in result
