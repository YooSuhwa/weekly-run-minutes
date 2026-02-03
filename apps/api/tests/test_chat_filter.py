"""Tests for chat filter service."""

import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from src.models.filtered_content import FilterReason
from src.services.chat_filter import (
    BatchFilterResult,
    ChatFilterError,
    ChatFilterService,
    FilterResult,
    TranscriptSegment,
)


@pytest.fixture
def mock_openai_response():
    """Create a mock OpenAI completion response with valid classifications."""
    mock_choice = MagicMock()
    mock_choice.message.content = json.dumps({
        "classifications": [
            {
                "id": "seg-1",
                "is_work_related": True,
                "filter_reason": None,
                "confidence": 0.95,
                "explanation": "업무 현황 보고"
            },
            {
                "id": "seg-2",
                "is_work_related": False,
                "filter_reason": "greeting",
                "confidence": 0.9,
                "explanation": "인사말"
            },
            {
                "id": "seg-3",
                "is_work_related": False,
                "filter_reason": "casual_talk",
                "confidence": 0.85,
                "explanation": "잡담"
            },
        ]
    })

    mock_usage = MagicMock()
    mock_usage.total_tokens = 500

    mock_response = MagicMock()
    mock_response.choices = [mock_choice]
    mock_response.usage = mock_usage
    return mock_response


@pytest.fixture
def chat_filter_service():
    """Create a chat filter service with mocked OpenAI client."""
    with patch("src.services.chat_filter.settings") as mock_settings:
        mock_settings.OPENAI_API_KEY = "test-key"
        mock_settings.OPENAI_MODEL = "gpt-4o"
        with patch("src.services.chat_filter.AsyncOpenAI"):
            yield ChatFilterService()


@pytest.fixture
def sample_segments():
    """Create sample transcript segments for testing."""
    return [
        TranscriptSegment(
            id="seg-1",
            text="이번 주 AI 모델 배포 작업 완료했습니다.",
            speaker_name="이상윤",
            start_time=0.0,
            end_time=5.0,
        ),
        TranscriptSegment(
            id="seg-2",
            text="안녕하세요, 좋은 아침이에요.",
            speaker_name="선설희",
            start_time=5.0,
            end_time=8.0,
        ),
        TranscriptSegment(
            id="seg-3",
            text="오늘 날씨 좋네요.",
            speaker_name="최보연",
            start_time=8.0,
            end_time=10.0,
        ),
    ]


class TestChatFilterServiceInit:
    """Tests for ChatFilterService initialization."""

    @patch("src.services.chat_filter.settings")
    @patch("src.services.chat_filter.AsyncOpenAI")
    def test_init(self, mock_openai, mock_settings):
        """Should initialize with correct API key and model."""
        mock_settings.OPENAI_API_KEY = "test-key"
        mock_settings.OPENAI_MODEL = "gpt-4o"

        service = ChatFilterService()

        assert service.model == "gpt-4o"
        mock_openai.assert_called_once_with(api_key="test-key")


class TestFilterSegments:
    """Tests for filter_segments method."""

    @pytest.mark.asyncio
    async def test_filter_segments_success(
        self,
        chat_filter_service,
        mock_openai_response,
        sample_segments,
    ):
        """Should classify segments correctly."""
        chat_filter_service.client.chat.completions.create = AsyncMock(
            return_value=mock_openai_response
        )

        result = await chat_filter_service.filter_segments(sample_segments)

        assert isinstance(result, BatchFilterResult)
        assert len(result.work_related) == 1
        assert len(result.filtered) == 2

        # Check work-related item
        work_item = result.work_related[0]
        assert work_item.segment_id == "seg-1"
        assert work_item.is_work_related is True
        assert work_item.confidence == 0.95

        # Check filtered items
        filtered_ids = {f.segment_id for f in result.filtered}
        assert "seg-2" in filtered_ids
        assert "seg-3" in filtered_ids

    @pytest.mark.asyncio
    async def test_filter_segments_empty_list(self, chat_filter_service):
        """Should return empty result for empty input."""
        result = await chat_filter_service.filter_segments([])

        assert len(result.work_related) == 0
        assert len(result.filtered) == 0

    @pytest.mark.asyncio
    async def test_filter_segments_with_context(
        self,
        chat_filter_service,
        mock_openai_response,
        sample_segments,
    ):
        """Should include meeting context in prompt."""
        chat_filter_service.client.chat.completions.create = AsyncMock(
            return_value=mock_openai_response
        )

        await chat_filter_service.filter_segments(
            sample_segments,
            meeting_context="주간회의, 팀: 제품기술팀",
        )

        # Verify API was called with context in message
        call_args = chat_filter_service.client.chat.completions.create.call_args
        messages = call_args.kwargs["messages"]
        user_message = messages[1]["content"]
        assert "주간회의" in user_message or "제품기술팀" in user_message

    @pytest.mark.asyncio
    async def test_filter_segments_api_error(
        self,
        chat_filter_service,
        sample_segments,
    ):
        """Should raise ChatFilterError on API failure."""
        chat_filter_service.client.chat.completions.create = AsyncMock(
            side_effect=Exception("API timeout")
        )

        with pytest.raises(ChatFilterError, match="Failed to filter"):
            await chat_filter_service.filter_segments(sample_segments)


class TestParseResponse:
    """Tests for _parse_response method."""

    def test_parse_valid_response(self, chat_filter_service, sample_segments):
        """Should parse valid JSON response correctly."""
        raw_content = json.dumps({
            "classifications": [
                {
                    "id": "seg-1",
                    "is_work_related": True,
                    "filter_reason": None,
                    "confidence": 0.95,
                },
                {
                    "id": "seg-2",
                    "is_work_related": False,
                    "filter_reason": "greeting",
                    "confidence": 0.8,
                },
            ]
        })

        results = chat_filter_service._parse_response(raw_content, sample_segments)

        assert len(results) == 3  # All segments should have results
        seg1_result = next(r for r in results if r.segment_id == "seg-1")
        assert seg1_result.is_work_related is True
        assert seg1_result.confidence == 0.95

    def test_parse_invalid_json_returns_all_work_related(
        self,
        chat_filter_service,
        sample_segments,
    ):
        """Should treat all as work-related when JSON is invalid."""
        results = chat_filter_service._parse_response("invalid json", sample_segments)

        assert len(results) == 3
        for result in results:
            assert result.is_work_related is True
            assert result.confidence == 0.5

    def test_parse_missing_segment_fills_with_work_related(
        self,
        chat_filter_service,
        sample_segments,
    ):
        """Should fill missing segments as work-related."""
        raw_content = json.dumps({
            "classifications": [
                {
                    "id": "seg-1",
                    "is_work_related": True,
                    "filter_reason": None,
                    "confidence": 0.9,
                },
            ]
        })

        results = chat_filter_service._parse_response(raw_content, sample_segments)

        assert len(results) == 3
        # seg-2 and seg-3 should default to work-related
        seg2_result = next(r for r in results if r.segment_id == "seg-2")
        assert seg2_result.is_work_related is True

    def test_parse_invalid_filter_reason_defaults_to_casual_talk(
        self,
        chat_filter_service,
        sample_segments,
    ):
        """Should default to casual_talk for invalid filter_reason."""
        raw_content = json.dumps({
            "classifications": [
                {
                    "id": "seg-1",
                    "is_work_related": False,
                    "filter_reason": "invalid_reason",
                    "confidence": 0.8,
                },
            ]
        })

        results = chat_filter_service._parse_response(raw_content, sample_segments)

        seg1_result = next(r for r in results if r.segment_id == "seg-1")
        assert seg1_result.filter_reason == FilterReason.CASUAL_TALK.value

    def test_parse_clamps_confidence_to_valid_range(
        self,
        chat_filter_service,
        sample_segments,
    ):
        """Should clamp confidence to 0.0-1.0 range."""
        raw_content = json.dumps({
            "classifications": [
                {"id": "seg-1", "is_work_related": True, "confidence": 1.5},
                {"id": "seg-2", "is_work_related": False, "confidence": -0.5, "filter_reason": "greeting"},
            ]
        })

        results = chat_filter_service._parse_response(raw_content, sample_segments)

        seg1_result = next(r for r in results if r.segment_id == "seg-1")
        seg2_result = next(r for r in results if r.segment_id == "seg-2")
        assert seg1_result.confidence == 1.0
        assert seg2_result.confidence == 0.0

    def test_parse_ignores_unknown_segment_ids(
        self,
        chat_filter_service,
        sample_segments,
    ):
        """Should ignore classifications for unknown segment IDs."""
        raw_content = json.dumps({
            "classifications": [
                {"id": "unknown-id", "is_work_related": False, "confidence": 0.9, "filter_reason": "greeting"},
                {"id": "seg-1", "is_work_related": True, "confidence": 0.8},
            ]
        })

        results = chat_filter_service._parse_response(raw_content, sample_segments)

        result_ids = {r.segment_id for r in results}
        assert "unknown-id" not in result_ids
        assert "seg-1" in result_ids


class TestFilterSingle:
    """Tests for filter_single convenience method."""

    @pytest.mark.asyncio
    async def test_filter_single_work_related(self, chat_filter_service):
        """Should return work-related result for work content."""
        mock_choice = MagicMock()
        mock_choice.message.content = json.dumps({
            "classifications": [
                {"id": "single", "is_work_related": True, "confidence": 0.9}
            ]
        })
        mock_response = MagicMock()
        mock_response.choices = [mock_choice]
        mock_response.usage = MagicMock(total_tokens=100)

        chat_filter_service.client.chat.completions.create = AsyncMock(
            return_value=mock_response
        )

        result = await chat_filter_service.filter_single(
            text="프로젝트 진행 상황 보고드립니다.",
            speaker="이상윤",
        )

        assert result.is_work_related is True
        assert result.confidence == 0.9

    @pytest.mark.asyncio
    async def test_filter_single_casual_talk(self, chat_filter_service):
        """Should return filtered result for casual talk."""
        mock_choice = MagicMock()
        mock_choice.message.content = json.dumps({
            "classifications": [
                {
                    "id": "single",
                    "is_work_related": False,
                    "filter_reason": "greeting",
                    "confidence": 0.95,
                }
            ]
        })
        mock_response = MagicMock()
        mock_response.choices = [mock_choice]
        mock_response.usage = MagicMock(total_tokens=100)

        chat_filter_service.client.chat.completions.create = AsyncMock(
            return_value=mock_response
        )

        result = await chat_filter_service.filter_single(
            text="안녕하세요, 좋은 아침이에요.",
        )

        assert result.is_work_related is False
        assert result.filter_reason == "greeting"


class TestShouldFilter:
    """Tests for should_filter method."""

    def test_should_filter_high_confidence_casual(self, chat_filter_service):
        """Should return True for high-confidence casual talk."""
        result = FilterResult(
            segment_id="test",
            is_work_related=False,
            filter_reason="casual_talk",
            confidence=0.9,
        )

        assert chat_filter_service.should_filter(result) is True

    def test_should_not_filter_low_confidence(self, chat_filter_service):
        """Should return False for low-confidence casual talk."""
        result = FilterResult(
            segment_id="test",
            is_work_related=False,
            filter_reason="casual_talk",
            confidence=0.5,
        )

        assert chat_filter_service.should_filter(result) is False

    def test_should_not_filter_work_related(self, chat_filter_service):
        """Should return False for work-related content."""
        result = FilterResult(
            segment_id="test",
            is_work_related=True,
            filter_reason=None,
            confidence=0.9,
        )

        assert chat_filter_service.should_filter(result) is False

    def test_should_filter_custom_threshold(self, chat_filter_service):
        """Should respect custom threshold."""
        result = FilterResult(
            segment_id="test",
            is_work_related=False,
            filter_reason="casual_talk",
            confidence=0.6,
        )

        assert chat_filter_service.should_filter(result, threshold=0.5) is True
        assert chat_filter_service.should_filter(result, threshold=0.7) is False


class TestFilterReasonEnum:
    """Tests for FilterReason enum values."""

    def test_all_filter_reasons_exist(self):
        """Should have all expected filter reasons."""
        expected = {"casual_talk", "greeting", "off_topic", "personal", "small_talk"}
        actual = {r.value for r in FilterReason}
        assert actual == expected


class TestTranscriptSegment:
    """Tests for TranscriptSegment dataclass."""

    def test_create_minimal_segment(self):
        """Should create segment with minimal required fields."""
        segment = TranscriptSegment(id="test", text="Hello")

        assert segment.id == "test"
        assert segment.text == "Hello"
        assert segment.speaker_label is None
        assert segment.speaker_name is None
        assert segment.start_time is None
        assert segment.end_time is None

    def test_create_full_segment(self):
        """Should create segment with all fields."""
        segment = TranscriptSegment(
            id="test",
            text="Hello",
            speaker_label="SPEAKER_01",
            speaker_name="이상윤",
            start_time=0.0,
            end_time=5.0,
        )

        assert segment.speaker_label == "SPEAKER_01"
        assert segment.speaker_name == "이상윤"
        assert segment.start_time == 0.0
        assert segment.end_time == 5.0


class TestBatchFilterResult:
    """Tests for BatchFilterResult dataclass."""

    def test_empty_result(self):
        """Should create empty result."""
        result = BatchFilterResult()

        assert len(result.work_related) == 0
        assert len(result.filtered) == 0

    def test_with_results(self):
        """Should store classification results."""
        work = FilterResult("1", True, None, 0.9)
        filtered = FilterResult("2", False, "greeting", 0.8)

        result = BatchFilterResult(
            work_related=[work],
            filtered=[filtered],
        )

        assert len(result.work_related) == 1
        assert len(result.filtered) == 1
        assert result.work_related[0].segment_id == "1"
        assert result.filtered[0].segment_id == "2"


class TestIntegrationWithMeeting:
    """Integration tests for filter service with meeting context."""

    @pytest.mark.asyncio
    async def test_filter_with_meeting_context(self, chat_filter_service):
        """Should use meeting context for better classification."""
        segments = [
            TranscriptSegment(
                id="1",
                text="SDK 배포 관련해서 논의하겠습니다.",
                speaker_name="이상윤",
            ),
            TranscriptSegment(
                id="2",
                text="커피 마실래요?",
                speaker_name="선설희",
            ),
        ]

        mock_choice = MagicMock()
        mock_choice.message.content = json.dumps({
            "classifications": [
                {"id": "1", "is_work_related": True, "confidence": 0.95},
                {"id": "2", "is_work_related": False, "filter_reason": "small_talk", "confidence": 0.9},
            ]
        })
        mock_response = MagicMock()
        mock_response.choices = [mock_choice]
        mock_response.usage = MagicMock(total_tokens=200)

        chat_filter_service.client.chat.completions.create = AsyncMock(
            return_value=mock_response
        )

        result = await chat_filter_service.filter_segments(
            segments,
            meeting_context="주간회의: 제품기술팀, 안건: SDK 배포, HWP 변환",
        )

        assert len(result.work_related) == 1
        assert len(result.filtered) == 1
        assert result.work_related[0].segment_id == "1"
        assert result.filtered[0].segment_id == "2"
        assert result.filtered[0].filter_reason == "small_talk"
