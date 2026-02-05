"""Meeting minutes generation service using GPT."""

import json
from dataclasses import dataclass, field

from openai import AsyncOpenAI
from tenacity import retry, stop_after_attempt, wait_exponential

from src.lib.config import settings
from src.lib.logging import get_logger
from src.prompts import load_prompt

logger = get_logger(__name__)


class MinutesGenerationError(Exception):
    """Minutes generation error."""

    pass


@dataclass
class CorrectionItem:
    """A single AI correction."""

    original: str
    corrected: str
    category: str  # "terminology" | "formatting" | "grammar"
    paragraph_index: int | None = None  # 0-indexed paragraph in the markdown
    start_offset: int | None = None  # character offset within the paragraph
    end_offset: int | None = None  # character end offset within the paragraph


@dataclass
class MinutesGenerationResult:
    """Result from minutes generation."""

    content_markdown: str
    ai_model: str
    prompt_version: str
    corrections: list[CorrectionItem] = field(default_factory=list)


# Current prompt version for tracking
PROMPT_VERSION = "2.0.0"


def get_system_prompt() -> str:
    """Load the system prompt from file."""
    return load_prompt("minutes_system")


def get_user_prompt_template() -> str:
    """Load the user prompt template from file."""
    return load_prompt("minutes_user")


class MinutesGeneratorService:
    """Service for generating meeting minutes using GPT."""

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
        weekly_report_summary: str,
        meeting_date: str,
        team_name: str,
        attendees: list[str],
        vocabulary_prompt: str | None = None,
        context_terms: list[str] | None = None,
        context_instructions: str | None = None,
        location: str | None = None,
    ) -> MinutesGenerationResult:
        """Generate meeting minutes from transcript and weekly report.

        Args:
            transcript_text: Full transcript text with speaker labels
            weekly_report_summary: Parsed weekly report summary
            meeting_date: Meeting date in YYYY-MM-DD format
            team_name: Team name
            attendees: List of attendee names
            vocabulary_prompt: Formatted vocabulary terms for AI correction
            context_terms: Session-level keywords for terminology correction
            context_instructions: Natural language instructions for generation

        Returns:
            MinutesGenerationResult with generated markdown
        """
        logger.info(
            "Generating meeting minutes",
            model=self.model,
            date=meeting_date,
            team=team_name,
            has_vocabulary=vocabulary_prompt is not None,
            has_context_terms=bool(context_terms),
            has_context_instructions=bool(context_instructions),
        )

        # Build vocabulary section if provided
        vocabulary_section = ""
        if vocabulary_prompt:
            vocabulary_section = f"\n{vocabulary_prompt}\n"

        # Build context terms section
        context_terms_section = ""
        if context_terms:
            terms_str = ", ".join(context_terms)
            context_terms_section = f"""
## 세션 용어 (이 용어들은 정확하게 표기해주세요)
{terms_str}
"""

        # Build context instructions section (emphasize more strongly)
        context_instructions_section = ""
        if context_instructions:
            context_instructions_section = f"""
## ⚠️ 특별 지시사항 (최우선 - 반드시 따라주세요!)

다음 지시사항은 다른 모든 규칙보다 우선합니다. 반드시 회의록에 반영하세요:

> {context_instructions}
"""

        # Build location line if provided
        location_line = f"\n- 장소: {location}" if location else ""

        # Build user prompt with context
        user_prompt = f"""다음 정보를 기반으로 회의록을 작성해주세요.
{context_instructions_section}
## 회의 정보
- 날짜: {meeting_date}
- 팀: {team_name}
- 참석자: {", ".join(attendees)}{location_line}

**중요**: 참석자는 위에 명시된 사람들만 포함하세요. 임의로 추가하지 마세요.
{vocabulary_section}{context_terms_section}
## 주간업무록 (각 팀원의 업무 현황)
{weekly_report_summary}

## 회의 녹취록
{transcript_text}

---

위 내용을 바탕으로 회의록을 마크다운 형식으로 작성해주세요.
1. 각 팀원의 발표 내용과 주간업무록의 내용을 매칭하여 정리
2. 업무 상태([완료], [진행], [예정])를 명확히 표시
3. 주간업무록에 있지만 회의에서 언급되지 않은 항목은 "※ 언급되지 않음"으로 표시
4. 녹취록의 비표준 용어를 용어 사전/세션 용어의 공식 용어로 교정
5. 제목/소제목 사이에 빈 줄을 넣어 가독성을 높여주세요
6. 팀원별 업무 보고 / 결정사항 / 액션아이템 사이에 --- 구분선을 넣어주세요
7. 마지막에 교정 목록을 JSON으로 첨부 (시스템 프롬프트의 형식 준수)
{"8. ⚠️ 특별 지시사항이 있으면 반드시 최우선으로 따라주세요!" if context_instructions else ""}
"""

        try:
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": get_system_prompt()},
                    {"role": "user", "content": user_prompt},
                ],
                temperature=0.3,
                max_completion_tokens=4096,
            )

            raw_content = response.choices[0].message.content or ""

            if not raw_content.strip():
                raise MinutesGenerationError("Empty response from GPT")

            # Parse corrections from the response
            content, corrections = self._parse_corrections(raw_content)

            # Validate and fix correction positions
            corrections = self.validate_corrections(content, corrections)

            logger.info(
                "Minutes generated successfully",
                model=self.model,
                tokens_used=response.usage.total_tokens if response.usage else 0,
                corrections_count=len(corrections),
            )

            return MinutesGenerationResult(
                content_markdown=content,
                ai_model=self.model,
                prompt_version=PROMPT_VERSION,
                corrections=corrections,
            )

        except Exception as e:
            logger.exception("GPT API error during minutes generation")
            raise MinutesGenerationError(f"Failed to generate minutes: {e}")

    def _parse_corrections(self, raw_content: str) -> tuple[str, list[CorrectionItem]]:
        """Parse corrections JSON block from GPT response.

        The response format is:
        <minutes markdown>
        ```json:corrections
        [{"original": "...", "corrected": "...", "category": "..."}]
        ```

        Returns:
            Tuple of (minutes_markdown, corrections_list)
        """
        corrections: list[CorrectionItem] = []

        # Try to find the corrections JSON block
        import re

        pattern = r"```json:corrections\s*\n(.*?)\n```"
        match = re.search(pattern, raw_content, re.DOTALL)

        if match:
            json_str = match.group(1).strip()
            # Remove the corrections block from the content
            content = raw_content[: match.start()].rstrip()

            try:
                items = json.loads(json_str)
                if isinstance(items, list):
                    for item in items:
                        if isinstance(item, dict) and "original" in item and "corrected" in item:
                            corrections.append(
                                CorrectionItem(
                                    original=item["original"],
                                    corrected=item["corrected"],
                                    category=item.get("category", "terminology"),
                                    paragraph_index=item.get("paragraph_index"),
                                    start_offset=item.get("start_offset"),
                                    end_offset=item.get("end_offset"),
                                )
                            )
            except (json.JSONDecodeError, TypeError):
                logger.warning("Failed to parse corrections JSON, ignoring")
        else:
            content = raw_content

        return content, corrections

    async def regenerate_section(
        self,
        original_minutes: str,
        section_name: str,
        additional_context: str | None = None,
    ) -> str:
        """Regenerate a specific section of the minutes.

        Args:
            original_minutes: Original minutes markdown
            section_name: Name of section to regenerate
            additional_context: Additional context or instructions

        Returns:
            Updated minutes markdown
        """
        user_prompt = f"""다음 회의록의 '{section_name}' 섹션을 다시 작성해주세요.

## 원본 회의록
{original_minutes}

{f"## 추가 지시사항{chr(10)}{additional_context}" if additional_context else ""}

'{section_name}' 섹션만 수정하고, 나머지는 그대로 유지해주세요.
전체 회의록을 출력해주세요.
"""

        try:
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": get_system_prompt()},
                    {"role": "user", "content": user_prompt},
                ],
                temperature=0.3,
                max_completion_tokens=4096,
            )

            return response.choices[0].message.content or original_minutes

        except Exception as e:
            logger.exception("Failed to regenerate section")
            raise MinutesGenerationError(f"Failed to regenerate section: {e}")

    def validate_corrections(
        self,
        minutes_markdown: str,
        corrections: list[CorrectionItem],
    ) -> list[CorrectionItem]:
        """Validate and fix correction positions against the actual markdown.

        Searches for corrected text in the markdown paragraphs and updates
        position fields if they are missing or incorrect.

        Args:
            minutes_markdown: Generated minutes markdown
            corrections: List of corrections from GPT

        Returns:
            Corrections with validated/fixed positions
        """
        paragraphs = minutes_markdown.split("\n")
        validated = []

        for correction in corrections:
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
