"""Meeting minutes generation service using GPT."""

from dataclasses import dataclass

from openai import AsyncOpenAI
from tenacity import retry, stop_after_attempt, wait_exponential

from src.lib.config import settings
from src.lib.logging import get_logger

logger = get_logger(__name__)


class MinutesGenerationError(Exception):
    """Minutes generation error."""

    pass


@dataclass
class MinutesGenerationResult:
    """Result from minutes generation."""

    content_markdown: str
    ai_model: str
    prompt_version: str


# Current prompt version for tracking
PROMPT_VERSION = "1.0.0"

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

회의록 구조:
# [날짜] 주간회의 회의록

## 참석자
- 참석자 목록

## 팀원별 업무 보고

### [팀원명]
- [상태] 업무 내용
  - 세부 내용
  - ...

### [다음 팀원명]
...

## 주요 결정사항
- 결정 내용 (있는 경우에만)

## 액션아이템
- 담당자: 액션 내용 (있는 경우에만)

## 기타 논의사항
- 논의 내용 (있는 경우에만)
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
    ) -> MinutesGenerationResult:
        """Generate meeting minutes from transcript and weekly report.

        Args:
            transcript_text: Full transcript text with speaker labels
            weekly_report_summary: Parsed weekly report summary
            meeting_date: Meeting date in YYYY-MM-DD format
            team_name: Team name
            attendees: List of attendee names

        Returns:
            MinutesGenerationResult with generated markdown
        """
        logger.info(
            "Generating meeting minutes",
            model=self.model,
            date=meeting_date,
            team=team_name,
        )

        # Build user prompt with context
        user_prompt = f"""다음 정보를 기반으로 회의록을 작성해주세요.

## 회의 정보
- 날짜: {meeting_date}
- 팀: {team_name}
- 참석자: {", ".join(attendees)}

## 주간업무록 (각 팀원의 업무 현황)
{weekly_report_summary}

## 회의 녹취록
{transcript_text}

위 내용을 바탕으로 회의록을 마크다운 형식으로 작성해주세요.
각 팀원의 발표 내용과 주간업무록의 내용을 매칭하여 정리하고,
업무 상태([완료], [진행], [예정])를 명확히 표시해주세요.
"""

        try:
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": user_prompt},
                ],
                temperature=0.3,  # Lower temperature for more consistent output
                max_tokens=4096,
            )

            content = response.choices[0].message.content or ""

            if not content.strip():
                raise MinutesGenerationError("Empty response from GPT")

            logger.info(
                "Minutes generated successfully",
                model=self.model,
                tokens_used=response.usage.total_tokens if response.usage else 0,
            )

            return MinutesGenerationResult(
                content_markdown=content,
                ai_model=self.model,
                prompt_version=PROMPT_VERSION,
            )

        except Exception as e:
            logger.exception("GPT API error during minutes generation")
            raise MinutesGenerationError(f"Failed to generate minutes: {e}")

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

    async def enhance_with_highlights(
        self,
        minutes_markdown: str,
        _transcript_text: str,
    ) -> str:
        """Add AI-corrected highlights to the minutes.

        This is a P1-full feature that adds markers for AI-corrected content.
        For P1-lite, this returns the original minutes unchanged.

        Args:
            minutes_markdown: Original minutes
            transcript_text: Original transcript

        Returns:
            Minutes with highlight markers (P1-full) or original (P1-lite)
        """
        # P1-lite: Return as-is (no highlighting)
        # TODO: Implement full highlighting in P1-full
        return minutes_markdown
