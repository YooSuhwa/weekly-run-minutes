"""Weekly report HTML parser for extracting structured task data.

Supports Confluence storage format with ac:structured-macro (expand) and nested ul/li,
as well as traditional HTML table format.
"""

import re
from dataclasses import dataclass, field
from xml.etree import ElementTree as ET

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


# Status tag patterns
STATUS_PATTERNS = {
    "완료": re.compile(r"\[완료\]|\[done\]", re.IGNORECASE),
    "진행": re.compile(r"\[진행\]|\[ing\]|\[wip\]", re.IGNORECASE),
    "예정": re.compile(r"\[예정\]|\[todo\]|\[plan\]", re.IGNORECASE),
}


def _extract_text(element: ET.Element) -> str:
    """Recursively extract all text from an XML element."""
    parts: list[str] = []
    if element.text:
        parts.append(element.text)
    for child in element:
        parts.append(_extract_text(child))
        if child.tail:
            parts.append(child.tail)
    return "".join(parts).strip()


def _parse_status(text: str) -> tuple[str, str]:
    """Extract status and clean title from text.

    Returns:
        Tuple of (status, cleaned_title)
    """
    for status_name, pattern in STATUS_PATTERNS.items():
        if pattern.search(text):
            title = pattern.sub("", text).strip()
            # Remove trailing status info like "(1/27, 완료)" or "(~2/6, 진행)"
            title = re.sub(r"\s*\(.*?\)\s*$", "", title).strip()
            return status_name, title

    # No explicit status tag - try to infer from trailing text
    if re.search(r"완료\)?\s*$", text):
        return "완료", re.sub(r"\s*\(.*?\)\s*$", "", text).strip()
    if re.search(r"진행\)?\s*$", text):
        return "진행", re.sub(r"\s*\(.*?\)\s*$", "", text).strip()
    if re.search(r"예정\)?\s*$", text):
        return "예정", re.sub(r"\s*\(.*?\)\s*$", "", text).strip()

    return "진행", text.strip()


class WeeklyReportParser:
    """Parser for weekly report HTML from Confluence.

    Supports two formats:
    1. Confluence expand macros (ac:structured-macro) with nested ul/li
    2. Traditional HTML tables
    """

    def parse(self, html_content: str) -> dict:
        """Parse HTML content and return structured data.

        Args:
            html_content: Raw HTML from Confluence page (storage format)

        Returns:
            Dict with parsed team_members structure
        """
        if not html_content or not html_content.strip():
            logger.warning("Empty HTML content")
            return {"team_members": []}

        logger.info(
            "WeeklyReportParser.parse called",
            html_length=len(html_content),
            has_expand="ac:structured-macro" in html_content,
            parser_version="v2-expand-macro",
        )

        # Try Confluence expand macro format first
        if "ac:structured-macro" in html_content and 'ac:name="expand"' in html_content:
            result = self._parse_expand_macros(html_content)
            if result.team_members:
                logger.info(
                    "Parsed weekly report (expand macro format)",
                    members=len(result.team_members),
                )
                return {"team_members": [self._member_to_dict(m) for m in result.team_members]}

        # Fallback to regex-based parsing for non-XML-safe content
        result = self._parse_with_regex(html_content)
        if result.team_members:
            logger.info(
                "Parsed weekly report (regex format)",
                members=len(result.team_members),
            )
            return {"team_members": [self._member_to_dict(m) for m in result.team_members]}

        logger.warning("Could not parse weekly report content")
        return {"team_members": []}

    def _parse_expand_macros(self, html_content: str) -> ParsedWeeklyReport:
        """Parse Confluence expand macro format.

        Structure:
        <ac:structured-macro ac:name="expand">
          <ac:parameter ac:name="title">팀원명</ac:parameter>
          <ac:rich-text-body>
            <ul>
              <li><p><strong>대분류</strong></p>
                <ul>
                  <li><p>[상태] 업무내용</p>
                    <ul><li><p>상세내용</p></li></ul>
                  </li>
                </ul>
              </li>
            </ul>
          </ac:rich-text-body>
        </ac:structured-macro>
        """
        result = ParsedWeeklyReport()

        # Extract expand macro sections using regex (more reliable than XML parsing
        # since Confluence storage format mixes namespaces)
        expand_pattern = re.compile(
            r'<ac:structured-macro[^>]*ac:name="expand"[^>]*>'
            r'.*?<ac:parameter ac:name="title">(.*?)</ac:parameter>'
            r".*?<ac:rich-text-body>(.*?)</ac:rich-text-body>"
            r".*?</ac:structured-macro>",
            re.DOTALL,
        )

        # Find all expand macros
        seen_members: set[str] = set()
        for match in expand_pattern.finditer(html_content):
            member_name = match.group(1).strip()
            body_html = match.group(2).strip()

            # Skip guide/instruction sections and duplicate names
            if not body_html or len(member_name) > 10:
                continue

            # Skip if we already processed this member (take the last/most complete one)
            if member_name in seen_members:
                # Remove previous entry
                result.team_members = [m for m in result.team_members if m.name != member_name]

            seen_members.add(member_name)
            member = self._parse_member_body(member_name, body_html)
            if member.categories:
                result.team_members.append(member)

        return result

    def _parse_member_body(self, name: str, body_html: str) -> MemberTasks:
        """Parse a member's body HTML to extract categories and tasks.

        The structure is nested <ul>/<li>:
        - Level 1 li: <strong>Category</strong>
        - Level 2 li: [status] task title (with optional <a> or <ac:link>)
        - Level 3 li: detail items
        """
        member = MemberTasks(name=name)

        # Strip all Confluence-specific tags to get clean HTML
        clean_html = self._clean_confluence_html(body_html)

        # Try to parse as XML
        try:
            # Wrap in root element
            xml_str = f"<root>{clean_html}</root>"
            root = ET.fromstring(xml_str)
        except ET.ParseError:
            logger.debug("XML parse failed for member %s, using regex fallback", name)
            return self._parse_member_body_regex(name, body_html)

        # Find the top-level <ul>
        top_ul = root.find(".//ul")
        if top_ul is None:
            return member

        # Each top-level <li> is a category
        for cat_li in top_ul.findall("./li"):
            category = self._parse_category_li(cat_li)
            if category and (category.tasks or category.name):
                member.categories.append(category)

        return member

    def _parse_category_li(self, li: ET.Element) -> TaskCategory | None:
        """Parse a category <li> element.

        Expected: <li><p><strong>CategoryName</strong></p><ul>...tasks...</ul></li>
        """
        # Get category name from <strong> in first <p>
        cat_name = ""
        p_elem = li.find("./p")
        if p_elem is not None:
            strong = p_elem.find("./strong")
            if strong is not None:
                cat_name = _extract_text(strong).strip()

        if not cat_name:
            return None

        category = TaskCategory(name=cat_name)

        # Find task list (nested <ul>)
        task_ul = li.find("./ul")
        if task_ul is None:
            return category

        for task_li in task_ul.findall("./li"):
            task = self._parse_task_li(task_li)
            if task:
                category.tasks.append(task)

        return category

    def _parse_task_li(self, li: ET.Element) -> TaskItem | None:
        """Parse a task <li> element.

        Expected: <li><p>[status] task title</p><ul>...details...</ul></li>
        """
        # Get task text from <p>
        p_elem = li.find("./p")
        if p_elem is None:
            return None

        task_text = _extract_text(p_elem).strip()
        if not task_text:
            return None

        status, title = _parse_status(task_text)

        # Get details from nested <ul>
        details: list[str] = []
        detail_ul = li.find("./ul")
        if detail_ul is not None:
            for detail_li in detail_ul.findall("./li"):
                detail_text = _extract_text(detail_li).strip()
                if detail_text:
                    details.append(detail_text)

        return TaskItem(status=status, title=title, details=details)

    def _clean_confluence_html(self, html: str) -> str:
        """Remove Confluence-specific XML elements and clean for standard HTML parsing."""
        # Remove ac:link elements, keeping link body text
        html = re.sub(
            r"<ac:link>.*?<ac:link-body>(.*?)</ac:link-body>.*?</ac:link>",
            r"\1",
            html,
            flags=re.DOTALL,
        )

        # Remove remaining ac: and ri: elements
        html = re.sub(r"</?ac:[^>]*>", "", html)
        html = re.sub(r"</?ri:[^>]*>", "", html)

        # Remove Confluence-specific attributes (local-id, etc.)
        html = re.sub(r'\s+local-id="[^"]*"', "", html)

        # Self-close void elements that might not be self-closed
        html = re.sub(r"<(br|hr|img)([^>]*?)(?<!/)>", r"<\1\2 />", html)

        return html

    def _parse_member_body_regex(self, name: str, body_html: str) -> MemberTasks:
        """Fallback regex-based parser for member body."""
        member = MemberTasks(name=name)

        # Extract text content, stripping all tags
        text = re.sub(r"<[^>]+>", "\n", body_html)
        text = re.sub(r"\n{2,}", "\n", text).strip()

        current_category: TaskCategory | None = None

        for line in text.split("\n"):
            line = line.strip()
            if not line:
                continue

            # Check if this looks like a category (bold text, no status tag)
            is_status_line = any(p.search(line) for p in STATUS_PATTERNS.values())

            if not is_status_line and len(line) < 30 and not line.startswith("("):
                # Likely a category name
                if current_category and current_category.tasks:
                    member.categories.append(current_category)
                current_category = TaskCategory(name=line)
            elif is_status_line and current_category:
                status, title = _parse_status(line)
                current_category.tasks.append(TaskItem(status=status, title=title))

        if current_category and current_category.tasks:
            member.categories.append(current_category)

        return member

    def _parse_with_regex(self, html_content: str) -> ParsedWeeklyReport:
        """Regex-based fallback parser for non-standard HTML."""
        result = ParsedWeeklyReport()

        # Try to find member sections by looking for expand macro titles
        title_pattern = re.compile(r'<ac:parameter ac:name="title">(.*?)</ac:parameter>')
        body_pattern = re.compile(
            r"<ac:rich-text-body>(.*?)</ac:rich-text-body>",
            re.DOTALL,
        )

        titles = list(title_pattern.finditer(html_content))
        bodies = list(body_pattern.finditer(html_content))

        if not titles:
            return result

        # Match titles with their bodies
        seen: set[str] = set()
        for _, title_match in enumerate(titles):
            name = title_match.group(1).strip()
            if len(name) > 20 or name in seen:
                continue

            # Find the next body after this title
            title_end = title_match.end()
            for body_match in bodies:
                if body_match.start() > title_end:
                    seen.add(name)
                    member = self._parse_member_body_regex(name, body_match.group(1))
                    if member.categories:
                        result.team_members.append(member)
                    break

        return result

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

    def dict_to_parsed_report(self, parsed_data: dict) -> ParsedWeeklyReport:
        """Convert stored dict back to ParsedWeeklyReport dataclass."""
        members = []
        for member_dict in parsed_data.get("team_members", []):
            categories = []
            for cat_dict in member_dict.get("categories", []):
                tasks = [
                    TaskItem(
                        status=t["status"],
                        title=t["title"],
                        details=t.get("details", []),
                    )
                    for t in cat_dict.get("tasks", [])
                ]
                categories.append(TaskCategory(name=cat_dict["name"], tasks=tasks))
            members.append(MemberTasks(name=member_dict["name"], categories=categories))
        return ParsedWeeklyReport(team_members=members)

    def get_member_summary(self, parsed_data: dict, member_name: str) -> str:
        """Get a text summary of a member's tasks for AI context."""
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
        """Get text summary of all members' tasks for AI context."""
        summaries = []
        for member in parsed_data.get("team_members", []):
            summaries.append(self.get_member_summary(parsed_data, member["name"]))
        return "\n\n".join(summaries)
