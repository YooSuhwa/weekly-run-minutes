"""Confluence API v2 integration service."""

import httpx
from tenacity import retry, stop_after_attempt, wait_exponential

from src.lib.config import settings
from src.lib.logging import get_logger

logger = get_logger(__name__)


class ConfluenceError(Exception):
    """Confluence API error."""

    def __init__(self, message: str, status_code: int | None = None) -> None:
        super().__init__(message)
        self.status_code = status_code


class ConfluenceService:
    """Confluence API v2 service for fetching and uploading pages."""

    def __init__(self) -> None:
        self.base_url = settings.CONFLUENCE_BASE_URL.rstrip("/")
        self.api_url = f"{self.base_url}/api/v2"
        self.auth = (settings.CONFLUENCE_USERNAME, settings.CONFLUENCE_TOKEN)
        self.space_id = settings.CONFLUENCE_SPACE_ID

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
            "url": f"{self.base_url}/pages/{page['id']}",
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
                "url": f"{self.base_url}/pages/{page['id']}",
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

        logger.info("Creating Confluence page", title=title, parent_id=parent_id)

        async with httpx.AsyncClient(auth=self.auth, timeout=30.0) as client:
            response = await client.post(url, headers=self._get_headers(), json=payload)

            if response.status_code not in (200, 201):
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
            "url": f"{self.base_url}/pages/{page['id']}",
            "title": page["title"],
        }

    def _markdown_to_confluence_html(self, markdown_content: str) -> str:
        """Convert markdown to Confluence storage format HTML.

        Basic conversion for meeting minutes structure.
        """
        import re

        lines = markdown_content.split("\n")
        html_parts: list[str] = []
        in_list = False
        list_type = ""

        for line in lines:
            stripped = line.strip()

            # Headers
            if stripped.startswith("# "):
                if in_list:
                    html_parts.append(f"</{list_type}>")
                    in_list = False
                html_parts.append(f"<h1>{stripped[2:]}</h1>")
            elif stripped.startswith("## "):
                if in_list:
                    html_parts.append(f"</{list_type}>")
                    in_list = False
                html_parts.append(f"<h2>{stripped[3:]}</h2>")
            elif stripped.startswith("### "):
                if in_list:
                    html_parts.append(f"</{list_type}>")
                    in_list = False
                html_parts.append(f"<h3>{stripped[4:]}</h3>")
            # Unordered list
            elif stripped.startswith("- ") or stripped.startswith("* "):
                if not in_list or list_type != "ul":
                    if in_list:
                        html_parts.append(f"</{list_type}>")
                    html_parts.append("<ul>")
                    in_list = True
                    list_type = "ul"
                html_parts.append(f"<li>{stripped[2:]}</li>")
            # Ordered list
            elif re.match(r"^\d+\.\s", stripped):
                if not in_list or list_type != "ol":
                    if in_list:
                        html_parts.append(f"</{list_type}>")
                    html_parts.append("<ol>")
                    in_list = True
                    list_type = "ol"
                content = re.sub(r"^\d+\.\s", "", stripped)
                html_parts.append(f"<li>{content}</li>")
            # Empty line
            elif not stripped:
                if in_list:
                    html_parts.append(f"</{list_type}>")
                    in_list = False
            # Regular paragraph
            else:
                if in_list:
                    html_parts.append(f"</{list_type}>")
                    in_list = False
                # Handle bold and italic
                text = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", stripped)
                text = re.sub(r"\*(.+?)\*", r"<em>\1</em>", text)
                html_parts.append(f"<p>{text}</p>")

        if in_list:
            html_parts.append(f"</{list_type}>")

        return "\n".join(html_parts)
