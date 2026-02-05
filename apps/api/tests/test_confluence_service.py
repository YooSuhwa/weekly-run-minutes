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


class TestAddLabels:
    @pytest.mark.asyncio
    async def test_add_labels_success(self, confluence_service):
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "results": [
                {"prefix": "global", "name": "회의록", "id": "label-1"},
            ]
        }

        with patch("httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client.post = AsyncMock(return_value=mock_response)
            mock_client_cls.return_value = mock_client

            result = await confluence_service.add_labels("page-1", ["회의록"])
            assert len(result) == 1
            assert result[0]["name"] == "회의록"

            # Verify the request payload
            call_args = mock_client.post.call_args
            assert call_args[1]["json"] == [{"prefix": "global", "name": "회의록"}]

    @pytest.mark.asyncio
    async def test_add_labels_multiple(self, confluence_service):
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "results": [
                {"prefix": "global", "name": "회의록", "id": "label-1"},
                {"prefix": "global", "name": "주간", "id": "label-2"},
            ]
        }

        with patch("httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client.post = AsyncMock(return_value=mock_response)
            mock_client_cls.return_value = mock_client

            result = await confluence_service.add_labels("page-1", ["회의록", "주간"])
            assert len(result) == 2

    @pytest.mark.asyncio
    async def test_add_labels_empty_list(self, confluence_service):
        """Empty labels list should return empty list without API call."""
        result = await confluence_service.add_labels("page-1", [])
        assert result == []

    @pytest.mark.asyncio
    async def test_add_labels_failure_returns_empty(self, confluence_service):
        """Label addition failure should return empty list (non-critical)."""
        mock_response = MagicMock()
        mock_response.status_code = 403
        mock_response.text = "Forbidden"

        with patch("httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client.post = AsyncMock(return_value=mock_response)
            mock_client_cls.return_value = mock_client

            # Should not raise, just return empty
            result = await confluence_service.add_labels("page-1", ["회의록"])
            assert result == []

    @pytest.mark.asyncio
    async def test_add_labels_uses_v1_api(self, confluence_service):
        """Should use V1 REST API endpoint for labels."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"results": []}

        with patch("httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client.post = AsyncMock(return_value=mock_response)
            mock_client_cls.return_value = mock_client

            await confluence_service.add_labels("page-123", ["회의록"])

            call_args = mock_client.post.call_args
            url = call_args[0][0]
            # Should use /rest/api/content/{id}/label (V1), not /api/v2
            assert "/rest/api/content/page-123/label" in url
            assert "/api/v2" not in url


class TestUploadMeetingMinutes:
    @pytest.mark.asyncio
    async def test_upload_success(self, confluence_service):
        with patch.object(
            confluence_service,
            "create_page",
            return_value={"id": "page-99", "title": "2024-01-15 회의록"},
        ), patch.object(
            confluence_service,
            "add_labels",
            return_value=[],
        ):
            result = await confluence_service.upload_meeting_minutes(
                title="2024-01-15 주간회의 회의록",
                markdown_content="# 회의록\n\n## 참석자\n- 이상윤",
            )
            assert result["id"] == "page-99"
            assert "url" in result
            assert "labels" in result

    @pytest.mark.asyncio
    async def test_upload_with_labels(self, confluence_service):
        """Should add labels when provided."""
        with patch.object(
            confluence_service,
            "create_page",
            return_value={"id": "page-99", "title": "2024-01-15 회의록"},
        ) as mock_create, patch.object(
            confluence_service,
            "add_labels",
            return_value=[{"name": "회의록"}],
        ) as mock_labels:
            result = await confluence_service.upload_meeting_minutes(
                title="2024-01-15 주간회의 회의록",
                markdown_content="# 회의록",
                labels=["회의록"],
            )
            assert result["labels"] == ["회의록"]
            mock_labels.assert_called_once_with("page-99", ["회의록"])

    @pytest.mark.asyncio
    async def test_upload_without_labels(self, confluence_service):
        """Should not call add_labels when no labels provided."""
        with patch.object(
            confluence_service,
            "create_page",
            return_value={"id": "page-99", "title": "2024-01-15 회의록"},
        ), patch.object(
            confluence_service,
            "add_labels",
            return_value=[],
        ) as mock_labels:
            result = await confluence_service.upload_meeting_minutes(
                title="2024-01-15 주간회의 회의록",
                markdown_content="# 회의록",
            )
            assert result["labels"] == []
            mock_labels.assert_not_called()


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
        # Markdown needs content between lists to recognize them as separate
        md = "- bullet\n\nSome text\n\n1. numbered"
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

    def test_nested_list_with_2_space_indent(self):
        """Nested lists with 2-space indentation should be properly converted."""
        md = """- Item 1
  - Sub item 1
  - Sub item 2
- Item 2"""
        result = self.service._markdown_to_confluence_html(md)
        # Should have nested <ul> inside <li>
        assert "<ul>" in result
        assert "<li>Item 1<ul>" in result or "<li>Item 1\n<ul>" in result.replace("<br />", "")
        assert "<li>Sub item 1</li>" in result
        assert "<li>Sub item 2</li>" in result
        assert "</ul>\n</li>" in result or "</ul></li>" in result.replace("\n", "")
        assert "<li>Item 2</li>" in result

    def test_nested_list_multiple_levels(self):
        """Multiple levels of nesting should work."""
        md = """- Level 1
  - Level 2
    - Level 3
- Another Level 1"""
        result = self.service._markdown_to_confluence_html(md)
        assert "<li>Level 1" in result
        assert "<li>Level 2" in result
        assert "<li>Level 3</li>" in result
        assert "<li>Another Level 1</li>" in result
        # Should have multiple nested <ul> tags
        assert result.count("<ul>") >= 2

    def test_nested_ordered_list(self):
        """Nested ordered lists should also work."""
        md = """1. First
  1. Sub first
  2. Sub second
2. Second"""
        result = self.service._markdown_to_confluence_html(md)
        assert "<ol>" in result
        assert "<li>First" in result
        assert "<li>Sub first</li>" in result
        assert "<li>Second</li>" in result


class TestNormalizeListIndentation:
    """Tests for _normalize_list_indentation method."""

    @pytest.fixture(autouse=True)
    def setup(self):
        self.service = ConfluenceService()

    def test_no_list_unchanged(self):
        content = "Just some text\nAnother line"
        result = self.service._normalize_list_indentation(content)
        assert result == content

    def test_single_level_list_unchanged(self):
        content = "- Item 1\n- Item 2"
        result = self.service._normalize_list_indentation(content)
        assert result == content

    def test_2_space_to_4_space(self):
        content = "- Item 1\n  - Sub item"
        result = self.service._normalize_list_indentation(content)
        assert result == "- Item 1\n    - Sub item"

    def test_4_space_to_8_space(self):
        content = "- Item 1\n    - Sub item"
        result = self.service._normalize_list_indentation(content)
        assert result == "- Item 1\n        - Sub item"

    def test_mixed_content(self):
        content = """# Title
- Item 1
  - Sub item
- Item 2

Some paragraph"""
        result = self.service._normalize_list_indentation(content)
        assert "    - Sub item" in result
        assert "# Title" in result
        assert "Some paragraph" in result


class TestExtractTaskSections:
    @pytest.fixture(autouse=True)
    def setup(self):
        self.service = ConfluenceService()

    def test_no_tasks(self):
        content = "- Regular item\n- Another item"
        result, tasks = self.service._extract_task_sections(content)
        assert tasks == []
        assert "- Regular item" in result

    def test_single_unchecked_task(self):
        content = "- [ ] Task 1"
        result, tasks = self.service._extract_task_sections(content)
        assert len(tasks) == 1
        assert len(tasks[0]) == 1
        assert tasks[0][0]["text"] == "Task 1"
        assert tasks[0][0]["checked"] is False
        assert tasks[0][0]["assignee"] is None

    def test_single_checked_task(self):
        content = "- [x] Task 1"
        result, tasks = self.service._extract_task_sections(content)
        assert len(tasks) == 1
        assert tasks[0][0]["checked"] is True

    def test_task_with_assignee(self):
        content = "- [ ] @홍길동: 보고서 작성"
        result, tasks = self.service._extract_task_sections(content)
        assert tasks[0][0]["assignee"] == "홍길동"
        assert tasks[0][0]["text"] == "보고서 작성"

    def test_multiple_tasks(self):
        content = """- [ ] Task 1
- [x] Task 2
- [ ] Task 3"""
        result, tasks = self.service._extract_task_sections(content)
        assert len(tasks) == 1
        assert len(tasks[0]) == 3

    def test_tasks_separated_by_text(self):
        content = """- [ ] Task 1

Some text

- [ ] Task 2"""
        result, tasks = self.service._extract_task_sections(content)
        assert len(tasks) == 2
        assert len(tasks[0]) == 1
        assert len(tasks[1]) == 1


class TestBuildTaskListHtml:
    @pytest.fixture(autouse=True)
    def setup(self):
        self.service = ConfluenceService()

    def test_empty_tasks(self):
        result = self.service._build_task_list_html([])
        assert result == ""

    def test_single_task(self):
        tasks = [{"text": "Task 1", "checked": False, "assignee": None, "indent": 0}]
        result = self.service._build_task_list_html(tasks)
        assert "<ac:task-list>" in result
        assert "</ac:task-list>" in result
        assert "<ac:task-status>incomplete</ac:task-status>" in result
        assert "<ac:task-body>Task 1</ac:task-body>" in result

    def test_checked_task(self):
        tasks = [{"text": "Task 1", "checked": True, "assignee": None, "indent": 0}]
        result = self.service._build_task_list_html(tasks)
        assert "<ac:task-status>complete</ac:task-status>" in result

    def test_task_with_assignee(self):
        tasks = [{"text": "보고서 작성", "checked": False, "assignee": "홍길동", "indent": 0}]
        result = self.service._build_task_list_html(tasks)
        assert "<strong>홍길동</strong>: 보고서 작성" in result


class TestMarkdownWithTasksToHtml:
    @pytest.fixture(autouse=True)
    def setup(self):
        self.service = ConfluenceService()

    def test_full_document_with_tasks(self):
        content = """## Action 항목

- [ ] @홍길동: 보고서 작성 (기한: 2024-01-20)
- [ ] @김철수: 코드 리뷰

## 의사 결정

- API 버전을 v2로 업그레이드"""

        result = self.service._markdown_to_confluence_html(content)
        assert "<ac:task-list>" in result
        assert "<strong>홍길동</strong>: 보고서 작성" in result
        assert "<strong>김철수</strong>: 코드 리뷰" in result
        assert "API 버전을 v2로 업그레이드" in result


class TestExtractPageProperties:
    @pytest.fixture(autouse=True)
    def setup(self):
        self.service = ConfluenceService()

    def test_no_properties(self):
        content = "# 회의록\n\n내용입니다."
        result, details = self.service._extract_page_properties(content)
        assert details == ""
        assert "# 회의록" in result

    def test_single_property(self):
        content = "**일시**: 2024-01-15 14:00\n\n# 목표"
        result, details = self.service._extract_page_properties(content)
        assert "<ac:structured-macro ac:name=\"details\">" in details
        assert "<th>일시</th><td>2024-01-15 14:00</td>" in details
        assert "**일시**" not in result

    def test_all_properties(self):
        content = """**일시**: 2024-01-15 14:00
**장소**: 회의실 A
**참여자**: 홍길동, 김철수

# 목표"""
        result, details = self.service._extract_page_properties(content)
        assert "<th>일시</th>" in details
        assert "<th>장소</th>" in details
        assert "<th>참여자</th>" in details
        assert "홍길동, 김철수" in details
        assert "# 목표" in result

    def test_properties_order_maintained(self):
        """Properties should be in order: 일시, 장소, 참여자"""
        content = """**참여자**: 홍길동
**일시**: 2024-01-15
**장소**: 회의실"""
        result, details = self.service._extract_page_properties(content)
        # Check order in output
        일시_pos = details.find("일시")
        장소_pos = details.find("장소")
        참여자_pos = details.find("참여자")
        assert 일시_pos < 장소_pos < 참여자_pos


class TestBuildDetailsMacro:
    @pytest.fixture(autouse=True)
    def setup(self):
        self.service = ConfluenceService()

    def test_empty_properties(self):
        result = self.service._build_details_macro({})
        assert result == ""

    def test_single_property(self):
        result = self.service._build_details_macro({"일시": "2024-01-15"})
        assert "<ac:structured-macro ac:name=\"details\">" in result
        assert "<ac:rich-text-body>" in result
        assert "<th>일시</th><td>2024-01-15</td>" in result

    def test_full_properties(self):
        props = {
            "일시": "2024-01-15 14:00",
            "장소": "회의실 A",
            "참여자": "홍길동, 김철수",
        }
        result = self.service._build_details_macro(props)
        assert "<table>" in result
        assert "<tbody>" in result
        assert "회의실 A" in result


class TestFullDocumentWithDetailsAndTasks:
    @pytest.fixture(autouse=True)
    def setup(self):
        self.service = ConfluenceService()

    def test_full_meeting_minutes(self):
        content = """**일시**: 2024-01-15 14:00
**장소**: 회의실 A
**참여자**: 홍길동, 김철수

# 목표

- 프로젝트 진행 상황 공유

# 회의 내용

## 프로젝트 현황
- 현재 80% 완료

---

## Action 항목

- [ ] @홍길동: 문서 작성 (기한: 2024-01-20)
- [ ] @김철수: 코드 리뷰

## 의사 결정

- API v2 사용 결정"""

        result = self.service._markdown_to_confluence_html(content)

        # Details macro should be at the beginning
        assert result.startswith("<ac:structured-macro ac:name=\"details\">")
        assert "<th>일시</th>" in result
        assert "<th>참여자</th>" in result

        # Task list should be present
        assert "<ac:task-list>" in result
        assert "<strong>홍길동</strong>: 문서 작성" in result

        # Regular content should be present
        assert "프로젝트 진행 상황 공유" in result
        assert "API v2 사용 결정" in result
