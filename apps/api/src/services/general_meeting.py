"""General meeting minutes generation service using GPT.

P2 Feature: Generates free-form meeting minutes for general meetings
without requiring weekly report structure.
"""

import json
from dataclasses import dataclass, field

from openai import AsyncOpenAI
from tenacity import retry, stop_after_attempt, wait_exponential

from src.lib.config import settings
from src.lib.logging import get_logger
from src.services.minutes_generator import CorrectionItem, MinutesGenerationError

logger = get_logger(__name__)


@dataclass
class AgendaItemData:
    """Agenda item data for general meetings."""

    title: str
    description: str | None = None
    presenter: str | None = None
    duration_minutes: int | None = None


@dataclass
class GeneralMinutesResult:
    """Result from general meeting minutes generation."""

    content_markdown: str
    ai_model: str
    prompt_version: str
    corrections: list[CorrectionItem] = field(default_factory=list)
    action_items: list[dict] = field(default_factory=list)
    decisions: list[str] = field(default_factory=list)
    topics_summary: list[dict] = field(default_factory=list)


# Current prompt version for tracking
GENERAL_PROMPT_VERSION = "1.0.0"

# System prompt for general meeting minutes generation
GENERAL_SYSTEM_PROMPT = """당신은 회의록을 작성하는 전문 비서입니다.
제공된 회의 녹취록과 아젠다를 기반으로 회의록을 작성합니다.

회의록 작성 규칙:
1. 마크다운 형식으로 작성합니다.
2. 아젠다가 있으면 각 아젠다 항목별로 논의 내용을 정리합니다.
3. 아젠다가 없으면 논의된 주제별로 내용을 정리합니다.
4. 화자별로 주요 발언을 요약합니다.
5. 중요한 결정사항은 별도로 정리합니다.
6. 액션아이템(담당자, 기한)은 별도로 정리합니다.
7. 간결하고 명확하게 작성합니다.
8. 불필요한 인사말이나 잡담은 제외합니다.

회의록 구조:
# [회의 제목] 회의록

## 참석자
- 참석자 목록

## 아젠다 (또는 논의 주제)

### [아젠다/주제 1]
- 논의 내용 요약
- 주요 의견

### [아젠다/주제 2]
...

## 주요 결정사항
- 결정 내용 (있는 경우에만)

## 액션아이템
- [ ] 담당자: 액션 내용 (기한: YYYY-MM-DD) (있는 경우에만)

## 기타 논의사항
- 논의 내용 (있는 경우에만)

응답 형식:
회의록 마크다운을 작성한 후, 마지막에 다음 JSON 블록을 추가합니다:

```json:metadata
{
  "corrections": [
    {"original": "교정 전 텍스트", "corrected": "교정 후 텍스트", "category": "terminology", "paragraph_index": 0, "start_offset": 10, "end_offset": 20}
  ],
  "action_items": [
    {"assignee": "담당자", "task": "할 일", "due_date": "YYYY-MM-DD 또는 null"}
  ],
  "decisions": [
    "결정 사항 1",
    "결정 사항 2"
  ],
  "topics_summary": [
    {"topic": "주제명", "summary": "요약", "speakers": ["화자1", "화자2"]}
  ]
}
```

각 필드 설명:
- "corrections": 용어/포맷팅/문법 교정 목록 (위치 정보 포함)
- "action_items": 액션아이템 목록
- "decisions": 주요 결정사항 목록
- "topics_summary": 주제별 요약 (화자 정보 포함)
"""


class GeneralMeetingService:
    """Service for generating meeting minutes for general meetings using GPT.

    P2 Feature: Generates free-form minutes without weekly report structure.
    Extracts action items, decisions, and provides topic-based summaries.
    """

    def __init__(self) -> None:
        self.client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
        self.model = settings.OPENAI_MODEL

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=30),
        reraise=True,
    )
    async def generate_minutes(
        self,
        transcript_text: str,
        meeting_date: str,
        meeting_title: str,
        team_name: str,
        attendees: list[str],
        agenda_items: list[AgendaItemData] | None = None,
        vocabulary_prompt: str | None = None,
    ) -> GeneralMinutesResult:
        """Generate meeting minutes from transcript for general meetings.

        Args:
            transcript_text: Full transcript text with speaker labels
            meeting_date: Meeting date in YYYY-MM-DD format
            meeting_title: Meeting title
            team_name: Team name
            attendees: List of attendee names
            agenda_items: Optional list of agenda items
            vocabulary_prompt: Formatted vocabulary terms for AI correction

        Returns:
            GeneralMinutesResult with generated markdown and extracted metadata
        """
        logger.info(
            "Generating general meeting minutes",
            model=self.model,
            date=meeting_date,
            team=team_name,
            has_agenda=agenda_items is not None and len(agenda_items) > 0,
            has_vocabulary=vocabulary_prompt is not None,
        )

        # Build agenda section if provided
        agenda_section = ""
        if agenda_items:
            agenda_lines = ["## 아젠다"]
            for i, item in enumerate(agenda_items, 1):
                agenda_lines.append(f"\n### {i}. {item.title}")
                if item.description:
                    agenda_lines.append(f"- 설명: {item.description}")
                if item.presenter:
                    agenda_lines.append(f"- 발표자: {item.presenter}")
                if item.duration_minutes:
                    agenda_lines.append(f"- 예상 시간: {item.duration_minutes}분")
            agenda_section = "\n".join(agenda_lines)

        # Build vocabulary section if provided
        vocabulary_section = ""
        if vocabulary_prompt:
            vocabulary_section = f"\n{vocabulary_prompt}\n"

        # Build user prompt
        user_prompt = f"""다음 정보를 기반으로 회의록을 작성해주세요.

## 회의 정보
- 날짜: {meeting_date}
- 회의 제목: {meeting_title}
- 팀: {team_name}
- 참석자: {", ".join(attendees)}
{vocabulary_section}
{agenda_section}

## 회의 녹취록
{transcript_text}

위 내용을 바탕으로 회의록을 마크다운 형식으로 작성해주세요.
{"1. 아젠다 항목별로 논의 내용을 정리" if agenda_items else "1. 논의된 주제별로 내용을 정리"}
2. 주요 결정사항과 액션아이템을 명확히 표시
3. 화자별 주요 의견 정리
4. 마지막에 메타데이터를 JSON으로 첨부 (시스템 프롬프트의 형식 준수)
"""

        try:
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": GENERAL_SYSTEM_PROMPT},
                    {"role": "user", "content": user_prompt},
                ],
                temperature=0.3,
                max_completion_tokens=4096,
            )

            raw_content = response.choices[0].message.content or ""

            if not raw_content.strip():
                raise MinutesGenerationError("Empty response from GPT")

            # Parse metadata from the response
            content, metadata = self._parse_metadata(raw_content)

            # Validate and fix correction positions
            corrections = self.validate_corrections(content, metadata.get("corrections", []))

            logger.info(
                "General meeting minutes generated successfully",
                model=self.model,
                tokens_used=response.usage.total_tokens if response.usage else 0,
                corrections_count=len(corrections),
                action_items_count=len(metadata.get("action_items", [])),
                decisions_count=len(metadata.get("decisions", [])),
            )

            return GeneralMinutesResult(
                content_markdown=content,
                ai_model=self.model,
                prompt_version=GENERAL_PROMPT_VERSION,
                corrections=corrections,
                action_items=metadata.get("action_items", []),
                decisions=metadata.get("decisions", []),
                topics_summary=metadata.get("topics_summary", []),
            )

        except Exception as e:
            logger.exception("GPT API error during general minutes generation")
            raise MinutesGenerationError(f"Failed to generate minutes: {e}")

    def _parse_metadata(self, raw_content: str) -> tuple[str, dict]:
        """Parse metadata JSON block from GPT response.

        The response format is:
        <minutes markdown>
        ```json:metadata
        {"corrections": [...], "action_items": [...], ...}
        ```

        Returns:
            Tuple of (minutes_markdown, metadata_dict)
        """
        import re

        metadata: dict = {
            "corrections": [],
            "action_items": [],
            "decisions": [],
            "topics_summary": [],
        }

        # Try to find the metadata JSON block
        pattern = r"```json:metadata\s*\n(.*?)\n```"
        match = re.search(pattern, raw_content, re.DOTALL)

        if match:
            json_str = match.group(1).strip()
            # Remove the metadata block from the content
            content = raw_content[: match.start()].rstrip()

            try:
                parsed = json.loads(json_str)
                if isinstance(parsed, dict):
                    metadata = {
                        "corrections": parsed.get("corrections", []),
                        "action_items": parsed.get("action_items", []),
                        "decisions": parsed.get("decisions", []),
                        "topics_summary": parsed.get("topics_summary", []),
                    }
            except (json.JSONDecodeError, TypeError):
                logger.warning("Failed to parse metadata JSON, using defaults")
        else:
            content = raw_content

        return content, metadata

    def validate_corrections(
        self,
        minutes_markdown: str,
        corrections_data: list[dict],
    ) -> list[CorrectionItem]:
        """Validate and fix correction positions against the actual markdown.

        Args:
            minutes_markdown: Generated minutes markdown
            corrections_data: List of correction dicts from GPT

        Returns:
            List of CorrectionItem with validated positions
        """
        paragraphs = minutes_markdown.split("\n")
        validated = []

        for corr_dict in corrections_data:
            if not isinstance(corr_dict, dict):
                continue
            if "original" not in corr_dict or "corrected" not in corr_dict:
                continue

            correction = CorrectionItem(
                original=corr_dict["original"],
                corrected=corr_dict["corrected"],
                category=corr_dict.get("category", "terminology"),
                paragraph_index=corr_dict.get("paragraph_index"),
                start_offset=corr_dict.get("start_offset"),
                end_offset=corr_dict.get("end_offset"),
            )

            corrected_text = correction.corrected
            found = False

            # First try the reported position
            if (
                correction.paragraph_index is not None
                and correction.start_offset is not None
                and correction.end_offset is not None
            ):
                idx = correction.paragraph_index
                if idx < len(paragraphs):
                    para = paragraphs[idx]
                    start = correction.start_offset
                    end = correction.end_offset
                    if end <= len(para) and para[start:end] == corrected_text:
                        validated.append(correction)
                        found = True

            # Search for it if position was wrong or missing
            if not found:
                for i, para in enumerate(paragraphs):
                    offset = para.find(corrected_text)
                    if offset != -1:
                        correction.paragraph_index = i
                        correction.start_offset = offset
                        correction.end_offset = offset + len(corrected_text)
                        validated.append(correction)
                        found = True
                        break

            # Keep correction even without position (still useful for the list)
            if not found:
                correction.paragraph_index = None
                correction.start_offset = None
                correction.end_offset = None
                validated.append(correction)

        return validated

    def format_agenda_summary(self, agenda_items: list[AgendaItemData]) -> str:
        """Format agenda items as a summary string for AI context.

        Args:
            agenda_items: List of agenda items

        Returns:
            Formatted string summary of agenda items
        """
        if not agenda_items:
            return ""

        lines = ["## 회의 아젠다"]
        for i, item in enumerate(agenda_items, 1):
            lines.append(f"\n### {i}. {item.title}")
            if item.description:
                lines.append(f"- {item.description}")
            if item.presenter:
                lines.append(f"- 발표자: {item.presenter}")

        return "\n".join(lines)
