"""Tests for minutes generator service."""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from src.services.minutes_generator import (
    PROMPT_VERSION,
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


class TestEnhanceWithHighlights:
    @pytest.mark.asyncio
    async def test_p1_lite_returns_unchanged(self, minutes_service):
        """P1-lite: should return original minutes unchanged."""
        original = "# 회의록\n\n내용"
        result = await minutes_service.enhance_with_highlights(original, "transcript text")
        assert result == original
