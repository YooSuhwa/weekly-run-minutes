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
    ) -> dict:
        """Upload meeting minutes to Confluence.

        Converts markdown to Confluence storage format and creates a page.

        Args:
            title: Meeting minutes title (e.g., "2024-01-15 주간회의 회의록")
            markdown_content: Meeting minutes in markdown format
            parent_id: Parent page ID (defaults to CONFLUENCE_MINUTES_PARENT_PAGE_ID)

        Returns:
            Created page info with id and url
        """
        # Convert markdown to Confluence storage format (basic HTML)
        html_content = self._markdown_to_confluence_html(markdown_content)

        page = await self.create_page(
            title=title,
            body_html=html_content,
            parent_id=parent_id,
        )

        return {
            "id": page["id"],
            "url": f"{self.base_url}/spaces/{self.space_id}/pages/{page['id']}",
            "title": page["title"],
        }

    def _markdown_to_confluence_html(self, markdown_content: str) -> str:
        """Convert markdown to Confluence storage format HTML.

        Uses the markdown library for proper conversion.
        Handles nested list indentation (2-space to 4-space conversion).
        """
        import re

        import markdown

        # Pre-process: Convert 2-space list indentation to 4-space for nested lists
        # The markdown library requires 4-space indentation for nested lists
        processed_content = self._normalize_list_indentation(markdown_content)

        # Convert markdown to HTML with common extensions
        html = markdown.markdown(
            processed_content,
            extensions=[
                "tables",
                "fenced_code",
                "nl2br",  # Convert newlines to <br>
            ],
        )

        return html

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
