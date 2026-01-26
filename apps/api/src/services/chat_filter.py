"""Chat/Casual Talk Filtering Service using GPT."""

import json
from dataclasses import dataclass, field

from openai import AsyncOpenAI
from tenacity import retry, stop_after_attempt, wait_exponential

from src.lib.config import settings
from src.lib.logging import get_logger
from src.models.filtered_content import FilterReason

logger = get_logger(__name__)


class ChatFilterError(Exception):
    """Chat filter service error."""

    pass


@dataclass
class TranscriptSegment:
    """Input segment for filtering."""

    id: str  # Original transcript ID
    text: str
    speaker_label: str | None = None
    speaker_name: str | None = None
    start_time: float | None = None
    end_time: float | None = None


@dataclass
class FilterResult:
    """Result for a single segment classification."""

    segment_id: str
    is_work_related: bool
    filter_reason: str | None  # Only set if filtered
    confidence: float
    explanation: str | None = None


@dataclass
class BatchFilterResult:
    """Result from batch filtering."""

    work_related: list[FilterResult] = field(default_factory=list)
    filtered: list[FilterResult] = field(default_factory=list)


# System prompt for chat filtering
FILTER_SYSTEM_PROMPT = """당신은 회의 내용을 분류하는 전문가입니다.
주어진 발언들이 업무 관련인지 잡담인지 분류합니다.

분류 기준:
1. **업무 관련 (work_related: true):**
   - 프로젝트, 업무, 일정 관련 논의
   - 기술적 논의, 문제 해결
   - 팀 업무, 협업 관련
   - 의사결정, 액션아이템 논의
   - 업무 현황 보고

2. **비업무/잡담 (work_related: false):**
   - 인사말, 안부 (예: "안녕하세요", "주말 잘 보내셨어요?")
   - 날씨, 음식, 개인적인 이야기
   - 농담, 유머
   - 회의 시작/종료 시 소소한 대화
   - 주제와 무관한 이야기

filter_reason 값:
- "casual_talk": 일반 잡담
- "greeting": 인사말
- "off_topic": 주제와 무관
- "personal": 개인적인 이야기
- "small_talk": 소소한 대화

응답 형식 (JSON):
```json
{
  "classifications": [
    {
      "id": "segment_id",
      "is_work_related": true,
      "filter_reason": null,
      "confidence": 0.95,
      "explanation": "업무 현황 보고 내용"
    },
    {
      "id": "segment_id2",
      "is_work_related": false,
      "filter_reason": "greeting",
      "confidence": 0.9,
      "explanation": "인사말"
    }
  ]
}
```

중요:
- confidence는 0.0~1.0 사이 값
- 애매한 경우 업무 관련으로 분류 (보수적 필터링)
- 업무 맥락이 조금이라도 있으면 업무 관련으로 분류
"""


class ChatFilterService:
    """Service for filtering casual talk from meeting transcripts using GPT."""

    def __init__(self) -> None:
        self.client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
        self.model = settings.OPENAI_MODEL

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=30),
        reraise=True,
    )
    async def filter_segments(
        self,
        segments: list[TranscriptSegment],
        meeting_context: str | None = None,
    ) -> BatchFilterResult:
        """Classify transcript segments as work-related or casual talk.

        Args:
            segments: List of transcript segments to classify
            meeting_context: Optional context about the meeting (e.g., agenda, team info)

        Returns:
            BatchFilterResult with classified segments
        """
        if not segments:
            return BatchFilterResult()

        logger.info(
            "Filtering transcript segments",
            model=self.model,
            segment_count=len(segments),
        )

        # Build user prompt with segments
        segments_text = "\n".join(
            f"- ID: {s.id}\n  Speaker: {s.speaker_name or s.speaker_label or 'Unknown'}\n  Text: {s.text}"
            for s in segments
        )

        user_prompt = f"""다음 발언들을 분류해주세요.

{f"## 회의 맥락{chr(10)}{meeting_context}{chr(10)}{chr(10)}" if meeting_context else ""}## 발언 목록
{segments_text}

각 발언이 업무 관련인지 잡담인지 JSON 형식으로 분류해주세요.
"""

        try:
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": FILTER_SYSTEM_PROMPT},
                    {"role": "user", "content": user_prompt},
                ],
                temperature=0.1,  # Low temperature for consistent classification
                max_tokens=2048,
                response_format={"type": "json_object"},
            )

            raw_content = response.choices[0].message.content or "{}"
            classifications = self._parse_response(raw_content, segments)

            # Separate into work-related and filtered
            result = BatchFilterResult()
            for classification in classifications:
                if classification.is_work_related:
                    result.work_related.append(classification)
                else:
                    result.filtered.append(classification)

            logger.info(
                "Filtering complete",
                work_related=len(result.work_related),
                filtered=len(result.filtered),
                tokens_used=response.usage.total_tokens if response.usage else 0,
            )

            return result

        except Exception as e:
            logger.exception("GPT API error during chat filtering")
            raise ChatFilterError(f"Failed to filter segments: {e}")

    def _parse_response(
        self,
        raw_content: str,
        original_segments: list[TranscriptSegment],
    ) -> list[FilterResult]:
        """Parse GPT response into FilterResult list.

        Falls back to classifying all as work-related if parsing fails.
        """
        results: list[FilterResult] = []
        segment_ids = {s.id for s in original_segments}

        try:
            data = json.loads(raw_content)
            classifications = data.get("classifications", [])

            for item in classifications:
                if not isinstance(item, dict):
                    continue

                segment_id = item.get("id")
                if segment_id not in segment_ids:
                    continue

                is_work_related = item.get("is_work_related", True)
                filter_reason = item.get("filter_reason")
                confidence = item.get("confidence", 0.5)

                # Validate filter_reason
                if filter_reason and filter_reason not in [r.value for r in FilterReason]:
                    filter_reason = FilterReason.CASUAL_TALK.value

                results.append(
                    FilterResult(
                        segment_id=segment_id,
                        is_work_related=is_work_related,
                        filter_reason=filter_reason if not is_work_related else None,
                        confidence=min(1.0, max(0.0, float(confidence))),
                        explanation=item.get("explanation"),
                    )
                )

        except (json.JSONDecodeError, TypeError, ValueError) as e:
            logger.warning(
                "Failed to parse filter response, treating all as work-related",
                error=str(e),
            )
            # Fallback: treat all as work-related
            for segment in original_segments:
                results.append(
                    FilterResult(
                        segment_id=segment.id,
                        is_work_related=True,
                        filter_reason=None,
                        confidence=0.5,
                    )
                )

        # Ensure all segments have a result
        result_ids = {r.segment_id for r in results}
        for segment in original_segments:
            if segment.id not in result_ids:
                results.append(
                    FilterResult(
                        segment_id=segment.id,
                        is_work_related=True,
                        filter_reason=None,
                        confidence=0.5,
                    )
                )

        return results

    async def filter_single(
        self,
        text: str,
        speaker: str | None = None,
        meeting_context: str | None = None,
    ) -> FilterResult:
        """Convenience method to filter a single text segment.

        Args:
            text: Text content to classify
            speaker: Optional speaker name
            meeting_context: Optional context about the meeting

        Returns:
            FilterResult for the single segment
        """
        segment = TranscriptSegment(
            id="single",
            text=text,
            speaker_name=speaker,
        )
        result = await self.filter_segments([segment], meeting_context)

        if result.filtered:
            return result.filtered[0]
        return result.work_related[0] if result.work_related else FilterResult(
            segment_id="single",
            is_work_related=True,
            filter_reason=None,
            confidence=0.5,
        )

    def should_filter(self, result: FilterResult, threshold: float = 0.7) -> bool:
        """Determine if a segment should be filtered based on confidence threshold.

        Args:
            result: Classification result
            threshold: Minimum confidence to actually filter (default 0.7)

        Returns:
            True if segment should be filtered
        """
        return not result.is_work_related and result.confidence >= threshold
