"""Confluence API v2 integration service."""

from typing import TYPE_CHECKING

import httpx
from tenacity import retry, stop_after_attempt, wait_exponential

from src.lib.config import settings
from src.lib.logging import get_logger

if TYPE_CHECKING:
    from src.models import Team

logger = get_logger(__name__)


class ConfluenceError(Exception):
    """Confluence API error."""

    def __init__(self, message: str, status_code: int | None = None) -> None:
        super().__init__(message)
        self.status_code = status_code


class ConfluenceService:
    """Confluence API v2 service for fetching and uploading pages."""

    def __init__(
        self,
        base_url: str | None = None,
        username: str | None = None,
        token: str | None = None,
        space_id: str | None = None,
    ) -> None:
        """Initialize Confluence service with optional team-specific credentials.

        Args:
            base_url: Team-specific Confluence base URL (falls back to global settings)
            username: Team-specific Confluence username (falls back to global settings)
            token: Team-specific Confluence token (falls back to global settings)
            space_id: Team-specific space ID/key (falls back to global settings)
        """
        self.base_url = (base_url or settings.CONFLUENCE_BASE_URL).rstrip("/")
        self.api_url = f"{self.base_url}/api/v2"
        self.auth = (
            username or settings.CONFLUENCE_USERNAME,
            token or settings.CONFLUENCE_TOKEN,
        )
        self.space_id = space_id or settings.CONFLUENCE_SPACE_ID

    @classmethod
    def from_team(cls, team: "Team | None") -> "ConfluenceService":
        """Create a ConfluenceService from team-specific settings.

        Reads settings from team.settings and falls back to global settings
        for any missing team settings.

        Args:
            team: Team object with settings relationship loaded, or None

        Returns:
            ConfluenceService configured with team or global settings
        """
        if team is None or team.settings is None:
            return cls()

        settings_obj = team.settings
        return cls(
            base_url=settings_obj.confluence_base_url,
            username=settings_obj.confluence_username,
            token=settings_obj.confluence_token,
            space_id=settings_obj.confluence_space_key,
        )

    def _get_headers(self) -> dict[str, str]:
        """Get common request headers."""
        return {
            "Accept": "application/json",
            "Content-Type": "application/json",
        }

    async def search_user_by_name(self, display_name: str) -> dict | None:
        """Search for a Confluence user by display name.

        Args:
            display_name: User's display name to search for

        Returns:
            User data with accountId if found, None otherwise
        """
        import urllib.parse

        # Use CQL to search for user by fullname
        cql = f'user.fullname~"{display_name}"'
        url = f"{self.base_url}/rest/api/search/user"
        params = {"cql": cql, "limit": 1}

        try:
            async with httpx.AsyncClient(auth=self.auth, timeout=10.0) as client:
                response = await client.get(url, headers=self._get_headers(), params=params)

                if response.status_code != 200:
                    logger.debug(
                        "User search failed",
                        display_name=display_name,
                        status_code=response.status_code,
                    )
                    return None

                data = response.json()
                results = data.get("results", [])
                if results:
                    user = results[0].get("user", {})
                    return {
                        "accountId": user.get("accountId"),
                        "displayName": user.get("displayName"),
                        "email": user.get("email"),
                    }
                return None
        except Exception as e:
            logger.debug("User search error", display_name=display_name, error=str(e))
            return None

    async def get_user_account_ids(self, names: list[str]) -> dict[str, str]:
        """Get account IDs for multiple user names.

        Args:
            names: List of display names to look up

        Returns:
            Dict mapping display name -> accountId (only for found users)
        """
        result = {}
        for name in names:
            user = await self.search_user_by_name(name)
            if user and user.get("accountId"):
                result[name] = user["accountId"]
        return result

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        reraise=True,
    )
    async def get_page_by_id(self, page_id: str) -> dict:
        """Fetch a page by ID with body content.

        Args:
            page_id: The Confluence page ID

        Returns:
            Page data including body content
        """
        url = f"{self.api_url}/pages/{page_id}"
        params = {"body-format": "storage"}  # Get storage format (HTML)

        async with httpx.AsyncClient(auth=self.auth, timeout=30.0) as client:
            response = await client.get(url, headers=self._get_headers(), params=params)

            if response.status_code == 404:
                raise ConfluenceError(f"Page not found: {page_id}", 404)
            if response.status_code != 200:
                raise ConfluenceError(
                    f"Failed to fetch page: {response.text}",
                    response.status_code,
                )

            return response.json()

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        reraise=True,
    )
    async def search_pages(
        self,
        title: str | None = None,
        space_id: str | None = None,
        parent_id: str | None = None,
        limit: int = 25,
    ) -> list[dict]:
        """Search for pages using CQL.

        Args:
            title: Page title to search (partial match)
            space_id: Space ID to search in
            parent_id: Parent page ID for child pages
            limit: Maximum results to return

        Returns:
            List of matching pages
        """
        url = f"{self.api_url}/pages"

        # Build parameters
        params: dict[str, str | int] = {"limit": limit}
        if space_id:
            params["space-id"] = space_id
        if parent_id:
            params["parent-id"] = parent_id
        if title:
            params["title"] = title

        async with httpx.AsyncClient(auth=self.auth, timeout=30.0) as client:
            response = await client.get(url, headers=self._get_headers(), params=params)

            if response.status_code != 200:
                raise ConfluenceError(
                    f"Search failed: {response.text}",
                    response.status_code,
                )

            data = response.json()
            return data.get("results", [])

    async def get_weekly_report_page(self, page_id: str) -> dict:
        """Fetch weekly report page and extract body content.

        Args:
            page_id: The weekly report page ID

        Returns:
            Dict with page metadata and HTML content
        """
        page = await self.get_page_by_id(page_id)

        return {
            "id": page["id"],
            "title": page.get("title", ""),
            "url": f"{self.base_url}/spaces/{self.space_id}/pages/{page['id']}",
            "html_content": page.get("body", {}).get("storage", {}).get("value", ""),
            "version": page.get("version", {}).get("number", 1),
        }

    async def find_weekly_reports(
        self,
        parent_page_id: str | None = None,
        title_contains: str | None = None,
        limit: int = 10,
    ) -> list[dict]:
        """Find weekly report pages under a parent page.

        Args:
            parent_page_id: Parent page ID (defaults to CONFLUENCE_REPORT_PARENT_PAGE_ID)
            title_contains: Filter by title substring
            limit: Maximum results

        Returns:
            List of weekly report page summaries
        """
        parent_id = parent_page_id or settings.CONFLUENCE_REPORT_PARENT_PAGE_ID

        pages = await self.search_pages(
            parent_id=parent_id,
            title=title_contains,
            limit=limit,
        )

        return [
            {
                "id": page["id"],
                "title": page.get("title", ""),
                "url": f"{self.base_url}/spaces/{self.space_id}/pages/{page['id']}",
            }
            for page in pages
        ]

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        reraise=True,
    )
    async def create_page(
        self,
        title: str,
        body_html: str,
        parent_id: str | None = None,
        space_id: str | None = None,
    ) -> dict:
        """Create a new Confluence page.

        Args:
            title: Page title
            body_html: Page body in storage format (HTML)
            parent_id: Parent page ID (defaults to CONFLUENCE_MINUTES_PARENT_PAGE_ID)
            space_id: Space ID (defaults to settings.CONFLUENCE_SPACE_ID)

        Returns:
            Created page data
        """
        url = f"{self.api_url}/pages"

        payload = {
            "spaceId": space_id or self.space_id,
            "status": "current",
            "title": title,
            "parentId": parent_id or settings.CONFLUENCE_MINUTES_PARENT_PAGE_ID,
            "body": {
                "representation": "storage",
                "value": body_html,
            },
        }

        logger.info(
            "Creating Confluence page",
            title=title,
            parent_id=payload["parentId"],
            space_id=payload["spaceId"],
        )

        async with httpx.AsyncClient(auth=self.auth, timeout=30.0) as client:
            response = await client.post(url, headers=self._get_headers(), json=payload)

            if response.status_code not in (200, 201):
                logger.error(
                    "Confluence API error",
                    status_code=response.status_code,
                    response_body=response.text,
                    request_url=url,
                )
                raise ConfluenceError(
                    f"Failed to create page: {response.text}",
                    response.status_code,
                )

            page = response.json()
            logger.info("Page created successfully", page_id=page["id"])
            return page

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        reraise=True,
    )
    async def add_labels(
        self,
        page_id: str,
        labels: list[str],
    ) -> list[dict]:
        """Add labels to a Confluence page.

        Uses V1 API as V2 doesn't support label writes.

        Args:
            page_id: The page ID to add labels to
            labels: List of label names to add

        Returns:
            List of added label data
        """
        if not labels:
            return []

        url = f"{self.base_url}/rest/api/content/{page_id}/label"

        # V1 API expects array of label objects
        payload = [{"prefix": "global", "name": label} for label in labels]

        logger.info("Adding labels to page", page_id=page_id, labels=labels)

        async with httpx.AsyncClient(auth=self.auth, timeout=30.0) as client:
            response = await client.post(url, headers=self._get_headers(), json=payload)

            if response.status_code not in (200, 201):
                logger.warning(
                    "Failed to add labels",
                    page_id=page_id,
                    labels=labels,
                    status_code=response.status_code,
                    response_body=response.text,
                )
                # Don't raise - label addition is not critical
                return []

            result = response.json()
            logger.info("Labels added successfully", page_id=page_id, labels=labels)
            return result.get("results", [])

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        reraise=True,
    )
    async def update_page(
        self,
        page_id: str,
        title: str,
        body_html: str,
        version: int,
    ) -> dict:
        """Update an existing Confluence page.

        Args:
            page_id: Page ID to update
            title: New page title
            body_html: New body in storage format
            version: Current version number (will be incremented)

        Returns:
            Updated page data
        """
        url = f"{self.api_url}/pages/{page_id}"

        payload = {
            "id": page_id,
            "status": "current",
            "title": title,
            "body": {
                "representation": "storage",
                "value": body_html,
            },
            "version": {
                "number": version + 1,
                "message": "Updated by WeeklyRun",
            },
        }

        logger.info("Updating Confluence page", page_id=page_id, version=version + 1)

        async with httpx.AsyncClient(auth=self.auth, timeout=30.0) as client:
            response = await client.put(url, headers=self._get_headers(), json=payload)

            if response.status_code != 200:
                raise ConfluenceError(
                    f"Failed to update page: {response.text}",
                    response.status_code,
                )

            page = response.json()
            logger.info("Page updated successfully", page_id=page["id"])
            return page

    async def upload_meeting_minutes(
        self,
        title: str,
        markdown_content: str,
        parent_id: str | None = None,
        labels: list[str] | None = None,
    ) -> dict:
        """Upload meeting minutes to Confluence.

        Converts markdown to Confluence storage format and creates a page.
        Resolves @mentions to Confluence user links.
        Optionally adds labels to the created page.

        Args:
            title: Meeting minutes title (e.g., "2024-01-15 주간회의 회의록")
            markdown_content: Meeting minutes in markdown format
            parent_id: Parent page ID (defaults to CONFLUENCE_MINUTES_PARENT_PAGE_ID)
            labels: Optional list of labels to add to the page (e.g., ["회의록"])

        Returns:
            Created page info with id, url, and labels
        """
        # Extract @mentions from markdown and look up user account IDs
        mention_names = self._extract_mention_names(markdown_content)
        user_account_ids = {}
        if mention_names:
            logger.info("Looking up user account IDs for mentions", names=mention_names)
            user_account_ids = await self.get_user_account_ids(mention_names)
            logger.info(
                "User account IDs resolved",
                found=list(user_account_ids.keys()),
                not_found=[n for n in mention_names if n not in user_account_ids],
            )

        # Convert markdown to Confluence storage format (basic HTML)
        html_content = self._markdown_to_confluence_html(markdown_content, user_account_ids)

        page = await self.create_page(
            title=title,
            body_html=html_content,
            parent_id=parent_id,
        )

        # Add labels if provided
        added_labels = []
        if labels:
            added_labels = await self.add_labels(page["id"], labels)

        return {
            "id": page["id"],
            "url": f"{self.base_url}/spaces/{self.space_id}/pages/{page['id']}",
            "title": page["title"],
            "labels": [label.get("name") for label in added_labels] if added_labels else [],
        }

    def _extract_mention_names(self, content: str) -> list[str]:
        """Extract @mention names from markdown content.

        Args:
            content: Markdown content

        Returns:
            List of unique mention names
        """
        import re

        # Match @name patterns (followed by : or whitespace)
        pattern = r"@([^\s:]+)[:\s]"
        matches = re.findall(pattern, content)
        return list(set(matches))

    def _markdown_to_confluence_html(
        self,
        markdown_content: str,
        user_account_ids: dict[str, str] | None = None,
    ) -> str:
        """Convert markdown to Confluence storage format HTML.

        Uses the markdown library for proper conversion.
        Handles nested list indentation (2-space to 4-space conversion).
        Converts checkboxes to Confluence task-list macros.
        Converts page properties to Confluence details macro.
        Converts @mentions to Confluence user links.

        Args:
            markdown_content: Markdown content to convert
            user_account_ids: Optional dict mapping display names to Confluence account IDs
        """
        import markdown

        user_account_ids = user_account_ids or {}

        # Pre-process: Extract page properties and convert to details macro
        processed_content, details_macro = self._extract_page_properties(markdown_content)

        # Pre-process: Extract and convert checkboxes to Confluence task format
        processed_content, task_sections = self._extract_task_sections(processed_content)

        # Pre-process: Convert 2-space list indentation to 4-space for nested lists
        # The markdown library requires 4-space indentation for nested lists
        processed_content = self._normalize_list_indentation(processed_content)

        # Convert markdown to HTML with common extensions
        html = markdown.markdown(
            processed_content,
            extensions=[
                "tables",
                "fenced_code",
                "nl2br",  # Convert newlines to <br>
            ],
        )

        # Post-process: Insert Confluence details macro at the beginning
        if details_macro:
            html = details_macro + "\n\n" + html

        # Post-process: Insert Confluence task-list macros with user mentions
        html = self._insert_task_lists(html, task_sections, user_account_ids)

        return html

    def _extract_page_properties(self, content: str) -> tuple[str, str]:
        """Extract page properties (일시, 장소, 참여자) and convert to Confluence details macro.

        Looks for patterns like:
        **일시**: 2024-01-15 14:00
        **장소**: 회의실 A
        **참여자**: 홍길동, 김철수

        Returns:
            Tuple of (content without properties, details macro HTML)
        """
        import re

        properties: dict[str, str] = {}
        lines = content.split("\n")
        result_lines = []
        property_pattern = re.compile(r"^\*\*([^*]+)\*\*[:\s]+(.+)$")

        # Property labels to look for (in order)
        property_labels = ["일시", "장소", "참여자"]

        for line in lines:
            match = property_pattern.match(line.strip())
            if match:
                label = match.group(1).strip()
                value = match.group(2).strip()
                if label in property_labels:
                    properties[label] = value
                    continue  # Skip this line from content
            result_lines.append(line)

        # Build details macro if properties found
        details_macro = ""
        if properties:
            details_macro = self._build_details_macro(properties)

        return "\n".join(result_lines), details_macro

    def _build_details_macro(self, properties: dict[str, str]) -> str:
        """Build Confluence details macro HTML for page properties.

        Args:
            properties: Dict of property label -> value

        Returns:
            Confluence storage format for details macro
        """
        # Build table rows
        rows = []
        # Maintain order: 일시, 장소, 참여자
        for label in ["일시", "장소", "참여자"]:
            if label in properties:
                value = properties[label]
                rows.append(f"<tr><th>{label}</th><td>{value}</td></tr>")

        if not rows:
            return ""

        table_content = "\n".join(rows)

        return f'''<ac:structured-macro ac:name="details">
<ac:rich-text-body>
<table>
<tbody>
{table_content}
</tbody>
</table>
</ac:rich-text-body>
</ac:structured-macro>'''

    def _extract_task_sections(self, content: str) -> tuple[str, list[list[dict]]]:
        """Extract checkbox items and replace with placeholders.

        Returns:
            Tuple of (processed content, list of task sections)
        """
        import re

        lines = content.split("\n")
        result_lines = []
        task_sections: list[list[dict]] = []
        current_tasks: list[dict] = []
        in_task_section = False
        task_placeholder_count = 0

        for line in lines:
            # Match checkbox pattern: - [ ] or - [x]
            checkbox_match = re.match(r"^(\s*)-\s*\[([ xX])\]\s*(.+)$", line)

            if checkbox_match:
                indent = checkbox_match.group(1)
                checked = checkbox_match.group(2).lower() == "x"
                text = checkbox_match.group(3).strip()

                # Parse @mention for assignee
                # Match @name followed by colon and text (e.g., "@홍길동: 작업 내용")
                assignee = None
                assignee_match = re.match(r"@([^:\s]+)[:\s]+(.+)", text)
                if assignee_match:
                    assignee = assignee_match.group(1)
                    text = assignee_match.group(2).strip()

                current_tasks.append({
                    "text": text,
                    "checked": checked,
                    "assignee": assignee,
                    "indent": len(indent),
                })
                in_task_section = True
            else:
                if in_task_section and current_tasks:
                    # End of task section, add placeholder
                    task_sections.append(current_tasks)
                    result_lines.append(f"<!-- TASK_PLACEHOLDER_{task_placeholder_count} -->")
                    task_placeholder_count += 1
                    current_tasks = []
                    in_task_section = False

                result_lines.append(line)

        # Handle trailing tasks
        if current_tasks:
            task_sections.append(current_tasks)
            result_lines.append(f"<!-- TASK_PLACEHOLDER_{task_placeholder_count} -->")

        return "\n".join(result_lines), task_sections

    def _insert_task_lists(
        self,
        html: str,
        task_sections: list[list[dict]],
        user_account_ids: dict[str, str] | None = None,
    ) -> str:
        """Replace task placeholders with Confluence task-list macros."""
        import re

        user_account_ids = user_account_ids or {}

        for i, tasks in enumerate(task_sections):
            placeholder = f"<!-- TASK_PLACEHOLDER_{i} -->"
            task_list_html = self._build_task_list_html(tasks, user_account_ids)
            html = html.replace(placeholder, task_list_html)

        # Clean up any remaining placeholders in comments
        html = re.sub(r"<!--\s*TASK_PLACEHOLDER_\d+\s*-->", "", html)

        return html

    def _build_task_list_html(
        self,
        tasks: list[dict],
        user_account_ids: dict[str, str] | None = None,
    ) -> str:
        """Build Confluence task-list macro HTML.

        Args:
            tasks: List of task dicts with text, checked, assignee, indent
            user_account_ids: Optional dict mapping display names to Confluence account IDs
        """
        if not tasks:
            return ""

        user_account_ids = user_account_ids or {}
        task_items = []

        for task in tasks:
            status = "complete" if task["checked"] else "incomplete"
            text = task["text"]

            # Add assignee mention if present
            if task["assignee"]:
                assignee = task["assignee"]
                account_id = user_account_ids.get(assignee)

                if account_id:
                    # Use Confluence user link macro for real mentions
                    mention_html = (
                        f'<ac:link><ri:user ri:account-id="{account_id}" /></ac:link>'
                    )
                    text = f"{mention_html}: {text}"
                else:
                    # Fallback to bold text if account ID not found
                    text = f"<strong>{assignee}</strong>: {text}"

            task_items.append(
                f'<ac:task>\n'
                f'  <ac:task-status>{status}</ac:task-status>\n'
                f'  <ac:task-body>{text}</ac:task-body>\n'
                f'</ac:task>'
            )

        return (
            '<ac:task-list>\n'
            + "\n".join(task_items)
            + '\n</ac:task-list>'
        )

    def _normalize_list_indentation(self, content: str) -> str:
        """Normalize list indentation from 2-space to 4-space.

        The markdown library requires 4-space indentation for nested lists,
        but many editors use 2-space indentation.
        """
        import re

        lines = content.split("\n")
        result = []

        for line in lines:
            # Match leading spaces followed by list marker (-, *, or number.)
            match = re.match(r"^( +)([-*]|\d+\.)\s", line)
            if match:
                spaces = match.group(1)
                # Convert 2-space indentation levels to 4-space
                # e.g., 2 spaces -> 4 spaces, 4 spaces -> 8 spaces
                indent_level = len(spaces) // 2
                new_spaces = "    " * indent_level
                line = new_spaces + line[len(spaces) :]
            result.append(line)

        return "\n".join(result)
