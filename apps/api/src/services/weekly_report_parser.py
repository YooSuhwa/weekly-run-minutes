"""Weekly report HTML parser for extracting structured task data."""

import re
from dataclasses import dataclass, field
from html.parser import HTMLParser

from src.lib.logging import get_logger

logger = get_logger(__name__)


@dataclass
class TaskItem:
    """Individual task item."""

    status: str  # "완료", "진행", "예정"
    title: str
    details: list[str] = field(default_factory=list)


@dataclass
class TaskCategory:
    """Category of tasks (대분류)."""

    name: str
    tasks: list[TaskItem] = field(default_factory=list)


@dataclass
class MemberTasks:
    """Tasks for a team member."""

    name: str
    categories: list[TaskCategory] = field(default_factory=list)


@dataclass
class ParsedWeeklyReport:
    """Parsed weekly report structure."""

    team_members: list[MemberTasks] = field(default_factory=list)


class WeeklyReportHTMLParser(HTMLParser):
    """HTML parser for weekly report tables from Confluence."""

    def __init__(self) -> None:
        super().__init__()
        self.result = ParsedWeeklyReport()

        # Current parsing state
        self._in_table = False
        self._in_row = False
        self._in_cell = False
        self._current_row: list[str] = []
        self._current_cell_content: list[str] = []
        self._rows: list[list[str]] = []

    def handle_starttag(self, tag: str, _attrs: list[tuple[str, str | None]]) -> None:
        if tag == "table":
            self._in_table = True
            self._rows = []
        elif tag == "tr" and self._in_table:
            self._in_row = True
            self._current_row = []
        elif tag in ("td", "th") and self._in_row:
            self._in_cell = True
            self._current_cell_content = []
        elif tag == "br" and self._in_cell:
            self._current_cell_content.append("\n")

    def handle_endtag(self, tag: str) -> None:
        if tag == "table":
            self._in_table = False
        elif tag == "tr" and self._in_row:
            self._in_row = False
            if self._current_row:
                self._rows.append(self._current_row)
        elif tag in ("td", "th") and self._in_cell:
            self._in_cell = False
            cell_text = "".join(self._current_cell_content).strip()
            self._current_row.append(cell_text)

    def handle_data(self, data: str) -> None:
        if self._in_cell:
            self._current_cell_content.append(data)

    def get_rows(self) -> list[list[str]]:
        """Get all parsed rows."""
        return self._rows


class WeeklyReportParser:
    """Parser for weekly report HTML from Confluence."""

    # Status tag patterns
    STATUS_PATTERNS = {
        "완료": re.compile(r"\[완료\]|\[done\]", re.IGNORECASE),
        "진행": re.compile(r"\[진행\]|\[ing\]|\[wip\]", re.IGNORECASE),
        "예정": re.compile(r"\[예정\]|\[todo\]|\[plan\]", re.IGNORECASE),
    }

    def parse(self, html_content: str) -> dict:
        """Parse HTML content and return structured data.

        Args:
            html_content: Raw HTML from Confluence page

        Returns:
            Dict with parsed team_members structure
        """
        parser = WeeklyReportHTMLParser()
        parser.feed(html_content)
        rows = parser.get_rows()

        if not rows:
            logger.warning("No table rows found in weekly report")
            return {"team_members": []}

        # Parse the table structure
        # Expected format: Name | Category | Status+Task | Details
        result = self._parse_table_rows(rows)

        return {"team_members": [self._member_to_dict(m) for m in result.team_members]}

    def _parse_table_rows(self, rows: list[list[str]]) -> ParsedWeeklyReport:
        """Parse table rows into structured data.

        Weekly report table structure:
        - Row 0: Header row (이름, 대분류, 업무, 상세)
        - Subsequent rows: Data with merged cells for name and category
        """
        result = ParsedWeeklyReport()

        current_member: MemberTasks | None = None
        current_category: TaskCategory | None = None

        # Skip header row
        data_rows = rows[1:] if rows else []

        for row in data_rows:
            if not row:
                continue

            # Normalize row length (handle merged cells)
            while len(row) < 4:
                row.insert(0, "")

            name, category, task_text, details = (
                row[0],
                row[1],
                row[2],
                row[3] if len(row) > 3 else "",
            )

            # New member
            if name.strip():
                if current_member:
                    if current_category:
                        current_member.categories.append(current_category)
                    result.team_members.append(current_member)
                current_member = MemberTasks(name=name.strip())
                current_category = None

            # New category
            if category.strip():
                if current_category and current_member:
                    current_member.categories.append(current_category)
                current_category = TaskCategory(name=category.strip())

            # Parse task
            if task_text.strip() and current_category:
                task = self._parse_task(task_text, details)
                current_category.tasks.append(task)

        # Don't forget the last member/category
        if current_member:
            if current_category:
                current_member.categories.append(current_category)
            result.team_members.append(current_member)

        return result

    def _parse_task(self, task_text: str, details_text: str) -> TaskItem:
        """Parse a single task from text.

        Args:
            task_text: Task text possibly containing status tag
            details_text: Details text (may contain newlines)

        Returns:
            TaskItem with extracted status, title, and details
        """
        status = "진행"  # Default status
        title = task_text.strip()

        # Extract status from text
        for status_name, pattern in self.STATUS_PATTERNS.items():
            if pattern.search(task_text):
                status = status_name
                title = pattern.sub("", task_text).strip()
                break

        # Parse details (split by newlines or bullet points)
        details: list[str] = []
        if details_text:
            # Split by various delimiters
            parts = re.split(r"\n|•|·|[-*]\s", details_text)
            details = [p.strip() for p in parts if p.strip()]

        return TaskItem(status=status, title=title, details=details)

    def _member_to_dict(self, member: MemberTasks) -> dict:
        """Convert MemberTasks to dict for JSON serialization."""
        return {
            "name": member.name,
            "categories": [
                {
                    "name": cat.name,
                    "tasks": [
                        {
                            "status": task.status,
                            "title": task.title,
                            "details": task.details,
                        }
                        for task in cat.tasks
                    ],
                }
                for cat in member.categories
            ],
        }

    def get_member_summary(self, parsed_data: dict, member_name: str) -> str:
        """Get a text summary of a member's tasks for AI context.

        Args:
            parsed_data: Parsed weekly report data
            member_name: Name of team member

        Returns:
            Formatted text summary of member's tasks
        """
        for member in parsed_data.get("team_members", []):
            if member["name"] == member_name:
                lines = [f"## {member_name}의 주간업무"]
                for cat in member.get("categories", []):
                    lines.append(f"\n### {cat['name']}")
                    for task in cat.get("tasks", []):
                        status_emoji = {"완료": "✅", "진행": "🔄", "예정": "📋"}.get(
                            task["status"], "•"
                        )
                        lines.append(f"- {status_emoji} [{task['status']}] {task['title']}")
                        for detail in task.get("details", []):
                            lines.append(f"  - {detail}")
                return "\n".join(lines)

        return f"'{member_name}'의 업무 정보를 찾을 수 없습니다."

    def get_all_members_summary(self, parsed_data: dict) -> str:
        """Get text summary of all members' tasks for AI context.

        Args:
            parsed_data: Parsed weekly report data

        Returns:
            Formatted text summary of all members' tasks
        """
        summaries = []
        for member in parsed_data.get("team_members", []):
            summaries.append(self.get_member_summary(parsed_data, member["name"]))
        return "\n\n".join(summaries)
