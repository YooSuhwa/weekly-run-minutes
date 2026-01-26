"""Tests for GeneralMeetingService."""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from src.services.general_meeting import (
    GENERAL_PROMPT_VERSION,
    AgendaItemData,
    GeneralMeetingService,
    GeneralMinutesResult,
)
from src.services.minutes_generator import MinutesGenerationError


class TestGeneralMeetingService:
    """Tests for GeneralMeetingService."""

    @pytest.fixture
    def service(self) -> GeneralMeetingService:
        """Create service instance with mocked OpenAI client."""
        with patch("src.services.general_meeting.settings") as mock_settings:
            mock_settings.OPENAI_API_KEY = "test-key"
            mock_settings.OPENAI_MODEL = "gpt-4o"
            return GeneralMeetingService()

    @pytest.fixture
    def sample_transcript(self) -> str:
        """Sample transcript text."""
        return """[김철수] 안녕하세요, 오늘 회의를 시작하겠습니다.
[이영희] 네, 안녕하세요.
[김철수] 첫 번째 안건은 신규 프로젝트 진행 상황입니다.
[이영희] 에이피아이 개발이 80% 완료되었습니다.
[김철수] 좋습니다. 다음 주까지 완료 가능한가요?
[이영희] 네, 금요일까지 완료하겠습니다.
[김철수] 알겠습니다. 다음 안건으로 넘어가겠습니다."""

    @pytest.fixture
    def sample_agenda_items(self) -> list[AgendaItemData]:
        """Sample agenda items."""
        return [
            AgendaItemData(
                title="신규 프로젝트 진행 상황",
                description="API 개발 현황 공유",
                presenter="이영희",
                duration_minutes=15,
            ),
            AgendaItemData(
                title="다음 주 계획",
                description="향후 일정 논의",
                presenter=None,
                duration_minutes=10,
            ),
        ]

    @pytest.mark.asyncio
    async def test_generate_minutes_basic(self, service: GeneralMeetingService, sample_transcript: str):
        """Should generate minutes from transcript without agenda."""
        mock_response_content = """# 2024-01-15 프로젝트 회의 회의록

## 참석자
- 김철수
- 이영희

## 논의 주제

### 신규 프로젝트 진행 상황
- API 개발 80% 완료
- 금요일까지 완료 예정

## 주요 결정사항
- API 개발 금요일까지 완료

## 액션아이템
- [ ] 이영희: API 개발 완료 (기한: 2024-01-19)

```json:metadata
{
  "corrections": [
    {"original": "에이피아이", "corrected": "API", "category": "terminology", "paragraph_index": 7, "start_offset": 2, "end_offset": 5}
  ],
  "action_items": [
    {"assignee": "이영희", "task": "API 개발 완료", "due_date": "2024-01-19"}
  ],
  "decisions": [
    "API 개발 금요일까지 완료"
  ],
  "topics_summary": [
    {"topic": "신규 프로젝트", "summary": "API 개발 80% 완료, 금요일 마감", "speakers": ["김철수", "이영희"]}
  ]
}
```"""

        mock_choice = MagicMock()
        mock_choice.message.content = mock_response_content
        mock_response = MagicMock()
        mock_response.choices = [mock_choice]
        mock_response.usage = MagicMock()
        mock_response.usage.total_tokens = 500

        with patch.object(
            service.client.chat.completions,
            "create",
            new_callable=AsyncMock,
            return_value=mock_response,
        ):
            result = await service.generate_minutes(
                transcript_text=sample_transcript,
                meeting_date="2024-01-15",
                meeting_title="프로젝트 회의",
                team_name="개발팀",
                attendees=["김철수", "이영희"],
            )

        assert isinstance(result, GeneralMinutesResult)
        assert "회의록" in result.content_markdown
        assert result.ai_model == "gpt-4o"
        assert result.prompt_version == GENERAL_PROMPT_VERSION
        assert len(result.corrections) == 1
        assert result.corrections[0].original == "에이피아이"
        assert result.corrections[0].corrected == "API"
        assert len(result.action_items) == 1
        assert result.action_items[0]["assignee"] == "이영희"
        assert len(result.decisions) == 1
        assert len(result.topics_summary) == 1

    @pytest.mark.asyncio
    async def test_generate_minutes_with_agenda(
        self,
        service: GeneralMeetingService,
        sample_transcript: str,
        sample_agenda_items: list[AgendaItemData],
    ):
        """Should generate minutes with agenda items included."""
        mock_response_content = """# 2024-01-15 프로젝트 회의 회의록

## 참석자
- 김철수
- 이영희

## 아젠다

### 1. 신규 프로젝트 진행 상황
- API 개발 80% 완료

### 2. 다음 주 계획
- 금요일까지 완료 예정

## 주요 결정사항
- 없음

## 액션아이템
- [ ] 이영희: API 개발 완료 (기한: 2024-01-19)

```json:metadata
{
  "corrections": [],
  "action_items": [
    {"assignee": "이영희", "task": "API 개발 완료", "due_date": "2024-01-19"}
  ],
  "decisions": [],
  "topics_summary": []
}
```"""

        mock_choice = MagicMock()
        mock_choice.message.content = mock_response_content
        mock_response = MagicMock()
        mock_response.choices = [mock_choice]
        mock_response.usage = MagicMock()
        mock_response.usage.total_tokens = 400

        with patch.object(
            service.client.chat.completions,
            "create",
            new_callable=AsyncMock,
            return_value=mock_response,
        ) as mock_create:
            result = await service.generate_minutes(
                transcript_text=sample_transcript,
                meeting_date="2024-01-15",
                meeting_title="프로젝트 회의",
                team_name="개발팀",
                attendees=["김철수", "이영희"],
                agenda_items=sample_agenda_items,
            )

        # Verify agenda items were included in the prompt
        call_args = mock_create.call_args
        user_message = call_args.kwargs["messages"][1]["content"]
        assert "신규 프로젝트 진행 상황" in user_message
        assert "다음 주 계획" in user_message
        assert "발표자: 이영희" in user_message

        assert isinstance(result, GeneralMinutesResult)
        assert "아젠다" in result.content_markdown

    @pytest.mark.asyncio
    async def test_generate_minutes_empty_response(self, service: GeneralMeetingService, sample_transcript: str):
        """Should raise error on empty response."""
        mock_choice = MagicMock()
        mock_choice.message.content = ""
        mock_response = MagicMock()
        mock_response.choices = [mock_choice]

        with (
            patch.object(
                service.client.chat.completions,
                "create",
                new_callable=AsyncMock,
                return_value=mock_response,
            ),
            pytest.raises(MinutesGenerationError) as exc_info,
        ):
            await service.generate_minutes(
                transcript_text=sample_transcript,
                meeting_date="2024-01-15",
                meeting_title="회의",
                team_name="팀",
                attendees=["참석자"],
            )

        assert "Empty response from GPT" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_generate_minutes_api_error(self, service: GeneralMeetingService, sample_transcript: str):
        """Should raise error on API failure."""
        with (
            patch.object(
                service.client.chat.completions,
                "create",
                new_callable=AsyncMock,
                side_effect=Exception("API Error"),
            ),
            pytest.raises(MinutesGenerationError) as exc_info,
        ):
            await service.generate_minutes(
                transcript_text=sample_transcript,
                meeting_date="2024-01-15",
                meeting_title="회의",
                team_name="팀",
                attendees=["참석자"],
            )

        assert "Failed to generate minutes" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_generate_minutes_no_metadata_block(self, service: GeneralMeetingService, sample_transcript: str):
        """Should handle response without metadata block."""
        mock_response_content = """# 2024-01-15 회의록

## 참석자
- 김철수

## 논의 내용
- 회의 진행"""

        mock_choice = MagicMock()
        mock_choice.message.content = mock_response_content
        mock_response = MagicMock()
        mock_response.choices = [mock_choice]
        mock_response.usage = MagicMock()
        mock_response.usage.total_tokens = 100

        with patch.object(
            service.client.chat.completions,
            "create",
            new_callable=AsyncMock,
            return_value=mock_response,
        ):
            result = await service.generate_minutes(
                transcript_text=sample_transcript,
                meeting_date="2024-01-15",
                meeting_title="회의",
                team_name="팀",
                attendees=["김철수"],
            )

        assert isinstance(result, GeneralMinutesResult)
        assert result.corrections == []
        assert result.action_items == []
        assert result.decisions == []
        assert result.topics_summary == []


class TestParseMetadata:
    """Tests for _parse_metadata method."""

    @pytest.fixture
    def service(self) -> GeneralMeetingService:
        with patch("src.services.general_meeting.settings") as mock_settings:
            mock_settings.OPENAI_API_KEY = "test-key"
            mock_settings.OPENAI_MODEL = "gpt-4o"
            return GeneralMeetingService()

    def test_parse_metadata_valid(self, service: GeneralMeetingService):
        """Should parse valid metadata block."""
        raw_content = """# 회의록

## 내용
- 테스트

```json:metadata
{
  "corrections": [{"original": "테스트", "corrected": "Test", "category": "terminology"}],
  "action_items": [{"assignee": "홍길동", "task": "작업", "due_date": null}],
  "decisions": ["결정1"],
  "topics_summary": [{"topic": "주제", "summary": "요약", "speakers": ["화자"]}]
}
```"""

        content, metadata = service._parse_metadata(raw_content)

        assert "회의록" in content
        assert "```json:metadata" not in content
        assert len(metadata["corrections"]) == 1
        assert len(metadata["action_items"]) == 1
        assert len(metadata["decisions"]) == 1
        assert len(metadata["topics_summary"]) == 1

    def test_parse_metadata_invalid_json(self, service: GeneralMeetingService):
        """Should handle invalid JSON gracefully."""
        raw_content = """# 회의록

```json:metadata
{invalid json}
```"""

        content, metadata = service._parse_metadata(raw_content)

        assert "회의록" in content
        assert metadata["corrections"] == []
        assert metadata["action_items"] == []

    def test_parse_metadata_missing_block(self, service: GeneralMeetingService):
        """Should handle missing metadata block."""
        raw_content = """# 회의록

## 내용
- 테스트"""

        content, metadata = service._parse_metadata(raw_content)

        assert content == raw_content
        assert metadata["corrections"] == []
        assert metadata["action_items"] == []


class TestValidateCorrections:
    """Tests for validate_corrections method."""

    @pytest.fixture
    def service(self) -> GeneralMeetingService:
        with patch("src.services.general_meeting.settings") as mock_settings:
            mock_settings.OPENAI_API_KEY = "test-key"
            mock_settings.OPENAI_MODEL = "gpt-4o"
            return GeneralMeetingService()

    def test_validate_corrections_correct_position(self, service: GeneralMeetingService):
        """Should keep correction with correct position."""
        markdown = "# 제목\n\nAPI 개발 완료"
        corrections_data = [
            {
                "original": "에이피아이",
                "corrected": "API",
                "category": "terminology",
                "paragraph_index": 2,
                "start_offset": 0,
                "end_offset": 3,
            }
        ]

        result = service.validate_corrections(markdown, corrections_data)

        assert len(result) == 1
        assert result[0].paragraph_index == 2
        assert result[0].start_offset == 0
        assert result[0].end_offset == 3

    def test_validate_corrections_fix_wrong_position(self, service: GeneralMeetingService):
        """Should fix correction with wrong position."""
        markdown = "# 제목\n\nAPI 개발 완료"
        corrections_data = [
            {
                "original": "에이피아이",
                "corrected": "API",
                "category": "terminology",
                "paragraph_index": 0,  # Wrong
                "start_offset": 0,
                "end_offset": 3,
            }
        ]

        result = service.validate_corrections(markdown, corrections_data)

        assert len(result) == 1
        assert result[0].paragraph_index == 2  # Fixed
        assert result[0].start_offset == 0
        assert result[0].end_offset == 3

    def test_validate_corrections_missing_position(self, service: GeneralMeetingService):
        """Should find position for correction without position data."""
        markdown = "# 제목\n\nAPI 개발 완료"
        corrections_data = [
            {
                "original": "에이피아이",
                "corrected": "API",
                "category": "terminology",
            }
        ]

        result = service.validate_corrections(markdown, corrections_data)

        assert len(result) == 1
        assert result[0].paragraph_index == 2
        assert result[0].start_offset == 0
        assert result[0].end_offset == 3

    def test_validate_corrections_not_found(self, service: GeneralMeetingService):
        """Should keep correction even if text not found."""
        markdown = "# 제목\n\n개발 완료"  # API not present
        corrections_data = [
            {
                "original": "에이피아이",
                "corrected": "API",
                "category": "terminology",
            }
        ]

        result = service.validate_corrections(markdown, corrections_data)

        assert len(result) == 1
        assert result[0].paragraph_index is None
        assert result[0].start_offset is None
        assert result[0].end_offset is None

    def test_validate_corrections_invalid_data(self, service: GeneralMeetingService):
        """Should skip invalid correction data."""
        markdown = "# 제목\n\nAPI 개발 완료"
        corrections_data = [
            {"invalid": "data"},
            "not a dict",
            {"original": "only original"},
        ]

        result = service.validate_corrections(markdown, corrections_data)

        assert len(result) == 0


class TestFormatAgendaSummary:
    """Tests for format_agenda_summary method."""

    @pytest.fixture
    def service(self) -> GeneralMeetingService:
        with patch("src.services.general_meeting.settings") as mock_settings:
            mock_settings.OPENAI_API_KEY = "test-key"
            mock_settings.OPENAI_MODEL = "gpt-4o"
            return GeneralMeetingService()

    def test_format_agenda_with_items(self, service: GeneralMeetingService):
        """Should format agenda items correctly."""
        agenda_items = [
            AgendaItemData(
                title="첫 번째 안건",
                description="설명",
                presenter="발표자",
            ),
            AgendaItemData(
                title="두 번째 안건",
                description=None,
                presenter=None,
            ),
        ]

        result = service.format_agenda_summary(agenda_items)

        assert "## 회의 아젠다" in result
        assert "### 1. 첫 번째 안건" in result
        assert "- 설명" in result
        assert "- 발표자: 발표자" in result
        assert "### 2. 두 번째 안건" in result

    def test_format_agenda_empty(self, service: GeneralMeetingService):
        """Should return empty string for no agenda items."""
        result = service.format_agenda_summary([])
        assert result == ""

    def test_format_agenda_none(self, service: GeneralMeetingService):
        """Should handle None input."""
        result = service.format_agenda_summary(None)  # type: ignore
        assert result == ""
