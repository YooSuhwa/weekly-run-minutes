"""Meeting minutes generation service using GPT."""

import json
from dataclasses import dataclass, field

from openai import AsyncOpenAI
from tenacity import retry, stop_after_attempt, wait_exponential

from src.lib.config import settings
from src.lib.logging import get_logger

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

# System prompt for meeting minutes generation
SYSTEM_PROMPT = """당신은 주간회의 회의록을 작성하는 전문 비서입니다.
제공된 회의 녹취록과 주간업무록을 기반으로 회의록을 작성합니다.

회의록 작성 규칙:
1. 마크다운 형식으로 작성합니다.
2. 각 팀원의 발표 내용을 요약합니다.
3. 주간업무록의 업무 항목과 실제 발표 내용을 매칭합니다.
4. 업무 상태([완료], [진행], [예정])를 명확히 표시합니다.
5. 중요한 결정사항이나 액션아이템은 별도로 정리합니다.
6. 간결하고 명확하게 작성합니다.
7. 불필요한 인사말이나 잡담은 제외합니다.
8. 주간업무록에 있지만 회의에서 언급되지 않은 항목은 "※ 언급되지 않음"으로 표시합니다.
9. 녹취록의 비표준 용어를 주간업무록의 공식 용어로 교정합니다 (예: "에스디케이" → "SDK").

회의록 구조:
# [날짜] 주간회의 회의록

## 참석자
- 참석자 목록

## 팀원별 업무 보고

### [팀원명]
- [상태] 업무 내용
  - 세부 내용
  - ...
- ※ 언급되지 않음: [주간업무록에 있지만 발표하지 않은 항목]

### [다음 팀원명]
...

## 주요 결정사항
- 결정 내용 (있는 경우에만)

## 액션아이템
- 담당자: 액션 내용 (있는 경우에만)

## 기타 논의사항
- 논의 내용 (있는 경우에만)

응답 형식:
회의록 마크다운을 작성한 후, 마지막에 다음 JSON 블록을 추가합니다:

```json:corrections
[
  {"original": "교정 전 텍스트", "corrected": "교정 후 텍스트", "category": "terminology", "paragraph_index": 0, "start_offset": 10, "end_offset": 20},
  ...
]
```

각 필드 설명:
- "original": 녹취록에서 사용된 원본 표현
- "corrected": 교정 후 회의록에 사용된 표현
- "category": 교정 유형
  - "terminology": 용어 교정 (비표준 표현 → 공식 용어)
  - "formatting": 포맷팅 교정 (날짜, 숫자 형식 등)
  - "grammar": 문법 교정
- "paragraph_index": 교정된 텍스트가 위치한 단락 번호 (0부터, 빈 줄로 구분)
- "start_offset": 해당 단락 내에서 교정된 텍스트의 시작 위치 (문자 인덱스)
- "end_offset": 해당 단락 내에서 교정된 텍스트의 끝 위치 (문자 인덱스)

교정이 없으면 빈 배열 `[]`을 사용합니다.
"""


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
    ) -> MinutesGenerationResult:
        """Generate meeting minutes from transcript and weekly report.

        Args:
            transcript_text: Full transcript text with speaker labels
            weekly_report_summary: Parsed weekly report summary
            meeting_date: Meeting date in YYYY-MM-DD format
            team_name: Team name
            attendees: List of attendee names
            vocabulary_prompt: Formatted vocabulary terms for AI correction

        Returns:
            MinutesGenerationResult with generated markdown
        """
        logger.info(
            "Generating meeting minutes",
            model=self.model,
            date=meeting_date,
            team=team_name,
            has_vocabulary=vocabulary_prompt is not None,
        )

        # Build vocabulary section if provided
        vocabulary_section = ""
        if vocabulary_prompt:
            vocabulary_section = f"\n{vocabulary_prompt}\n"

        # Build user prompt with context
        user_prompt = f"""다음 정보를 기반으로 회의록을 작성해주세요.

## 회의 정보
- 날짜: {meeting_date}
- 팀: {team_name}
- 참석자: {", ".join(attendees)}
{vocabulary_section}
## 주간업무록 (각 팀원의 업무 현황)
{weekly_report_summary}

## 회의 녹취록
{transcript_text}

위 내용을 바탕으로 회의록을 마크다운 형식으로 작성해주세요.
1. 각 팀원의 발표 내용과 주간업무록의 내용을 매칭하여 정리
2. 업무 상태([완료], [진행], [예정])를 명확히 표시
3. 주간업무록에 있지만 회의에서 언급되지 않은 항목은 "※ 언급되지 않음"으로 표시
4. 녹취록의 비표준 용어를 용어 사전의 공식 용어로 교정 (용어 사전이 제공된 경우)
5. 마지막에 교정 목록을 JSON으로 첨부 (시스템 프롬프트의 형식 준수)
"""

        try:
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": user_prompt},
                ],
                temperature=0.3,
                max_tokens=4096,
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
                        if (
                            isinstance(item, dict)
                            and "original" in item
                            and "corrected" in item
                        ):
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
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": user_prompt},
                ],
                temperature=0.3,
                max_tokens=4096,
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
