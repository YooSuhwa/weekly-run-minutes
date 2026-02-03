"""Tests for minutes generator service."""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from src.services.minutes_generator import (
    PROMPT_VERSION,
    CorrectionItem,
    MinutesGenerationError,
    MinutesGenerationResult,
    MinutesGeneratorService,
)


@pytest.fixture
def mock_openai_response():
    """Create a mock OpenAI completion response."""
    mock_choice = MagicMock()
    mock_choice.message.content = """# 2024-01-15 주간회의 회의록

## 참석자
- 이상윤, 선설희

## 팀원별 업무 보고

### 이상윤
- [완료] 모델 배포
- [진행] 데이터 수집

## 주요 결정사항
- 일정 확정
"""

    mock_usage = MagicMock()
    mock_usage.total_tokens = 500

    mock_response = MagicMock()
    mock_response.choices = [mock_choice]
    mock_response.usage = mock_usage
    return mock_response


@pytest.fixture
def minutes_service():
    with patch("src.services.minutes_generator.settings") as mock_settings:
        mock_settings.OPENAI_API_KEY = "test-key"
        mock_settings.OPENAI_MODEL = "gpt-4o"
        with patch("src.services.minutes_generator.AsyncOpenAI"):
            yield MinutesGeneratorService()


class TestMinutesGeneratorInit:
    @patch("src.services.minutes_generator.settings")
    @patch("src.services.minutes_generator.AsyncOpenAI")
    def test_init(self, mock_openai, mock_settings):
        mock_settings.OPENAI_API_KEY = "test-key"
        mock_settings.OPENAI_MODEL = "gpt-4o"
        service = MinutesGeneratorService()
        assert service.model == "gpt-4o"
        mock_openai.assert_called_once_with(api_key="test-key")


class TestGenerateMinutes:
    @pytest.mark.asyncio
    async def test_success(self, minutes_service, mock_openai_response):
        minutes_service.client.chat.completions.create = AsyncMock(
            return_value=mock_openai_response
        )

        result = await minutes_service.generate_minutes(
            transcript_text="이상윤: 안녕하세요. 이번 주 업무 보고합니다.",
            weekly_report_summary="이상윤: AI 모델 배포 완료",
            meeting_date="2024-01-15",
            team_name="제품기술팀",
            attendees=["이상윤", "선설희"],
        )

        assert isinstance(result, MinutesGenerationResult)
        assert "회의록" in result.content_markdown
        assert result.ai_model == "gpt-4o"
        assert result.prompt_version == PROMPT_VERSION

    @pytest.mark.asyncio
    async def test_with_vocabulary_prompt(self, minutes_service, mock_openai_response):
        """Test that vocabulary prompt is included in the request."""
        minutes_service.client.chat.completions.create = AsyncMock(
            return_value=mock_openai_response
        )

        vocabulary_prompt = """## 용어 사전 (반드시 아래 용어로 교정)

### 기술 용어
- 에스디케이 → SDK
- 지피티 → GPT"""

        result = await minutes_service.generate_minutes(
            transcript_text="이상윤: 에스디케이 배포 완료",
            weekly_report_summary="이상윤: SDK 배포",
            meeting_date="2024-01-15",
            team_name="제품기술팀",
            attendees=["이상윤"],
            vocabulary_prompt=vocabulary_prompt,
        )

        assert isinstance(result, MinutesGenerationResult)
        # Verify the API was called
        minutes_service.client.chat.completions.create.assert_called_once()
        # Get the actual call args
        call_args = minutes_service.client.chat.completions.create.call_args
        messages = call_args.kwargs["messages"]
        user_message = messages[1]["content"]
        # Verify vocabulary section was included
        assert "용어 사전" in user_message
        assert "에스디케이 → SDK" in user_message

    @pytest.mark.asyncio
    async def test_without_vocabulary_prompt(self, minutes_service, mock_openai_response):
        """Test that vocabulary section is not included when not provided."""
        minutes_service.client.chat.completions.create = AsyncMock(
            return_value=mock_openai_response
        )

        result = await minutes_service.generate_minutes(
            transcript_text="이상윤: 안녕하세요.",
            weekly_report_summary="이상윤: 업무",
            meeting_date="2024-01-15",
            team_name="제품기술팀",
            attendees=["이상윤"],
            vocabulary_prompt=None,
        )

        assert isinstance(result, MinutesGenerationResult)
        # Get the actual call args
        call_args = minutes_service.client.chat.completions.create.call_args
        messages = call_args.kwargs["messages"]
        user_message = messages[1]["content"]
        # Verify vocabulary section (with header "## 용어 사전") was NOT included
        # Note: "용어 사전" may appear in instructions but the actual section starts with "## 용어 사전"
        assert "## 용어 사전" not in user_message

    @pytest.mark.asyncio
    async def test_empty_response_raises_error(self, minutes_service):
        mock_choice = MagicMock()
        mock_choice.message.content = ""
        mock_response = MagicMock()
        mock_response.choices = [mock_choice]

        minutes_service.client.chat.completions.create = AsyncMock(return_value=mock_response)

        with pytest.raises(MinutesGenerationError, match="Empty response"):
            await minutes_service.generate_minutes(
                transcript_text="test",
                weekly_report_summary="test",
                meeting_date="2024-01-15",
                team_name="팀",
                attendees=["A"],
            )

    @pytest.mark.asyncio
    async def test_none_response_raises_error(self, minutes_service):
        mock_choice = MagicMock()
        mock_choice.message.content = None
        mock_response = MagicMock()
        mock_response.choices = [mock_choice]

        minutes_service.client.chat.completions.create = AsyncMock(return_value=mock_response)

        with pytest.raises(MinutesGenerationError, match="Empty response"):
            await minutes_service.generate_minutes(
                transcript_text="test",
                weekly_report_summary="test",
                meeting_date="2024-01-15",
                team_name="팀",
                attendees=["A"],
            )

    @pytest.mark.asyncio
    async def test_api_error_raises_generation_error(self, minutes_service):
        minutes_service.client.chat.completions.create = AsyncMock(
            side_effect=Exception("API timeout")
        )

        with pytest.raises(MinutesGenerationError, match="Failed to generate"):
            await minutes_service.generate_minutes(
                transcript_text="test",
                weekly_report_summary="test",
                meeting_date="2024-01-15",
                team_name="팀",
                attendees=["A"],
            )


class TestRegenerateSection:
    @pytest.mark.asyncio
    async def test_regenerate_success(self, minutes_service):
        mock_choice = MagicMock()
        mock_choice.message.content = "# Updated minutes"
        mock_response = MagicMock()
        mock_response.choices = [mock_choice]

        minutes_service.client.chat.completions.create = AsyncMock(return_value=mock_response)

        result = await minutes_service.regenerate_section(
            original_minutes="# Original",
            section_name="참석자",
        )
        assert result == "# Updated minutes"

    @pytest.mark.asyncio
    async def test_regenerate_with_context(self, minutes_service):
        mock_choice = MagicMock()
        mock_choice.message.content = "# Updated"
        mock_response = MagicMock()
        mock_response.choices = [mock_choice]

        minutes_service.client.chat.completions.create = AsyncMock(return_value=mock_response)

        result = await minutes_service.regenerate_section(
            original_minutes="# Original",
            section_name="결정사항",
            additional_context="좀 더 상세하게",
        )
        assert result == "# Updated"

    @pytest.mark.asyncio
    async def test_regenerate_returns_original_on_none(self, minutes_service):
        mock_choice = MagicMock()
        mock_choice.message.content = None
        mock_response = MagicMock()
        mock_response.choices = [mock_choice]

        minutes_service.client.chat.completions.create = AsyncMock(return_value=mock_response)

        result = await minutes_service.regenerate_section(
            original_minutes="# Original",
            section_name="참석자",
        )
        assert result == "# Original"

    @pytest.mark.asyncio
    async def test_regenerate_error(self, minutes_service):
        minutes_service.client.chat.completions.create = AsyncMock(
            side_effect=Exception("error")
        )

        with pytest.raises(MinutesGenerationError, match="Failed to regenerate"):
            await minutes_service.regenerate_section("# Original", "참석자")


class TestParseCorrections:
    def test_parses_valid_corrections_block(self, minutes_service):
        raw = """# 회의록 내용

## 참석자
- 이상윤

```json:corrections
[
  {"original": "에스디케이", "corrected": "SDK", "category": "terminology"},
  {"original": "2024.1.15", "corrected": "2024-01-15", "category": "formatting"}
]
```"""
        content, corrections = minutes_service._parse_corrections(raw)
        assert "# 회의록 내용" in content
        assert "```json:corrections" not in content
        assert len(corrections) == 2
        assert corrections[0].original == "에스디케이"
        assert corrections[0].corrected == "SDK"
        assert corrections[0].category == "terminology"
        assert corrections[1].category == "formatting"

    def test_empty_corrections_list(self, minutes_service):
        raw = """# 회의록

```json:corrections
[]
```"""
        content, corrections = minutes_service._parse_corrections(raw)
        assert "# 회의록" in content
        assert len(corrections) == 0

    def test_no_corrections_block(self, minutes_service):
        raw = "# 회의록\n\n내용만 있음"
        content, corrections = minutes_service._parse_corrections(raw)
        assert content == raw
        assert len(corrections) == 0

    def test_invalid_json_returns_empty(self, minutes_service):
        raw = """# 회의록

```json:corrections
not valid json
```"""
        content, corrections = minutes_service._parse_corrections(raw)
        assert "# 회의록" in content
        assert len(corrections) == 0

    def test_missing_required_fields_skipped(self, minutes_service):
        raw = """# 회의록

```json:corrections
[
  {"original": "test", "corrected": "TEST", "category": "terminology"},
  {"only_original": "no corrected field"},
  {"original": "a", "corrected": "b"}
]
```"""
        content, corrections = minutes_service._parse_corrections(raw)
        assert len(corrections) == 2
        assert corrections[0].original == "test"
        # The third item has original+corrected but no category -> defaults to "terminology"
        assert corrections[1].original == "a"
        assert corrections[1].category == "terminology"

    def test_corrections_with_response_including_whitespace(self, minutes_service):
        raw = """# 회의록 내용


```json:corrections
[{"original": "GPT", "corrected": "GPT-4o", "category": "terminology"}]
```
"""
        content, corrections = minutes_service._parse_corrections(raw)
        assert len(corrections) == 1
        assert corrections[0].corrected == "GPT-4o"

    @pytest.mark.asyncio
    async def test_generate_minutes_includes_corrections(self, minutes_service):
        """Test that generate_minutes returns corrections from GPT response."""
        mock_content = """# 회의록

## 참석자
- 이상윤

```json:corrections
[{"original": "에스디케이", "corrected": "SDK", "category": "terminology"}]
```"""
        mock_choice = MagicMock()
        mock_choice.message.content = mock_content
        mock_usage = MagicMock()
        mock_usage.total_tokens = 300
        mock_response = MagicMock()
        mock_response.choices = [mock_choice]
        mock_response.usage = mock_usage

        minutes_service.client.chat.completions.create = AsyncMock(return_value=mock_response)

        result = await minutes_service.generate_minutes(
            transcript_text="이상윤: 에스디케이 배포 완료",
            weekly_report_summary="이상윤: SDK 배포",
            meeting_date="2024-01-15",
            team_name="제품기술팀",
            attendees=["이상윤"],
        )

        assert isinstance(result, MinutesGenerationResult)
        assert len(result.corrections) == 1
        assert result.corrections[0].original == "에스디케이"
        assert result.corrections[0].corrected == "SDK"
        assert "```json:corrections" not in result.content_markdown


class TestValidateCorrections:
    def test_validates_correct_position(self, minutes_service):
        """Should keep corrections with correct positions."""
        markdown = "# 제목\nSDK 관련 작업 진행"
        corrections = [
            CorrectionItem(
                original="에스디케이",
                corrected="SDK",
                category="terminology",
                paragraph_index=1,
                start_offset=0,
                end_offset=3,
            )
        ]
        result = minutes_service.validate_corrections(markdown, corrections)
        assert len(result) == 1
        assert result[0].paragraph_index == 1
        assert result[0].start_offset == 0
        assert result[0].end_offset == 3

    def test_fixes_incorrect_position(self, minutes_service):
        """Should fix corrections with wrong positions."""
        markdown = "# 제목\nSDK 관련 작업 진행"
        corrections = [
            CorrectionItem(
                original="에스디케이",
                corrected="SDK",
                category="terminology",
                paragraph_index=0,  # wrong paragraph
                start_offset=0,
                end_offset=3,
            )
        ]
        result = minutes_service.validate_corrections(markdown, corrections)
        assert len(result) == 1
        assert result[0].paragraph_index == 1  # fixed
        assert result[0].start_offset == 0
        assert result[0].end_offset == 3

    def test_finds_position_when_missing(self, minutes_service):
        """Should find positions when not provided."""
        markdown = "# 제목\nSDK 관련 작업 진행"
        corrections = [
            CorrectionItem(
                original="에스디케이",
                corrected="SDK",
                category="terminology",
            )
        ]
        result = minutes_service.validate_corrections(markdown, corrections)
        assert len(result) == 1
        assert result[0].paragraph_index == 1
        assert result[0].start_offset == 0
        assert result[0].end_offset == 3

    def test_keeps_correction_without_match(self, minutes_service):
        """Should keep corrections even if text not found in markdown."""
        markdown = "# 제목\n다른 내용"
        corrections = [
            CorrectionItem(
                original="에스디케이",
                corrected="SDK",
                category="terminology",
                paragraph_index=1,
                start_offset=0,
                end_offset=3,
            )
        ]
        result = minutes_service.validate_corrections(markdown, corrections)
        assert len(result) == 1
        assert result[0].paragraph_index is None
        assert result[0].start_offset is None
        assert result[0].end_offset is None

    def test_multiple_corrections(self, minutes_service):
        """Should validate multiple corrections independently."""
        markdown = "# 제목\nSDK 작업을 HWP 변환과 함께"
        corrections = [
            CorrectionItem(original="에스디케이", corrected="SDK", category="terminology"),
            CorrectionItem(original="한글파일", corrected="HWP", category="terminology"),
        ]
        result = minutes_service.validate_corrections(markdown, corrections)
        assert len(result) == 2
        assert result[0].corrected == "SDK"
        assert result[0].paragraph_index == 1
        assert result[1].corrected == "HWP"
        assert result[1].paragraph_index == 1
