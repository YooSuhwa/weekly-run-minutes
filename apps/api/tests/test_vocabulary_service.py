"""Tests for vocabulary service."""

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from src.models import Team, Vocabulary, VocabularyCategory
from src.services.vocabulary import VocabularyService, VocabularyTerm


@pytest.fixture
def vocabulary_service():
    return VocabularyService()


class TestGetTeamVocabulary:
    @pytest.mark.asyncio
    async def test_empty_vocabulary(self, db_session: AsyncSession, vocabulary_service):
        # Create team without vocabulary
        team = Team(name="Test Team")
        db_session.add(team)
        await db_session.commit()
        await db_session.refresh(team)

        result = await vocabulary_service.get_team_vocabulary(db_session, team.id)
        assert result == []

    @pytest.mark.asyncio
    async def test_with_vocabulary(self, db_session: AsyncSession, vocabulary_service):
        # Create team with vocabulary
        team = Team(name="Test Team")
        db_session.add(team)
        await db_session.commit()
        await db_session.refresh(team)

        vocab1 = Vocabulary(
            team_id=team.id,
            term="SDK",
            correction="소프트웨어 개발 키트",
            category=VocabularyCategory.ABBREVIATION,
        )
        vocab2 = Vocabulary(
            team_id=team.id,
            term="에스디케이",
            correction="SDK",
            category=VocabularyCategory.TERMINOLOGY,
        )
        db_session.add_all([vocab1, vocab2])
        await db_session.commit()

        result = await vocabulary_service.get_team_vocabulary(db_session, team.id)
        assert len(result) == 2
        # Should be ordered by term
        assert result[0].term == "SDK"
        assert result[1].term == "에스디케이"

    @pytest.mark.asyncio
    async def test_only_returns_team_vocabulary(self, db_session: AsyncSession, vocabulary_service):
        # Create two teams with vocabulary
        team1 = Team(name="Team 1")
        team2 = Team(name="Team 2")
        db_session.add_all([team1, team2])
        await db_session.commit()
        await db_session.refresh(team1)
        await db_session.refresh(team2)

        vocab1 = Vocabulary(
            team_id=team1.id,
            term="SDK",
            correction="소프트웨어 개발 키트",
            category=VocabularyCategory.ABBREVIATION,
        )
        vocab2 = Vocabulary(
            team_id=team2.id,
            term="API",
            correction="응용 프로그래밍 인터페이스",
            category=VocabularyCategory.ABBREVIATION,
        )
        db_session.add_all([vocab1, vocab2])
        await db_session.commit()

        result = await vocabulary_service.get_team_vocabulary(db_session, team1.id)
        assert len(result) == 1
        assert result[0].term == "SDK"


class TestFormatVocabularyForPrompt:
    def test_empty_vocabulary(self, vocabulary_service):
        result = vocabulary_service.format_vocabulary_for_prompt([])
        assert result == ""

    def test_single_category(self, vocabulary_service):
        vocabulary = [
            VocabularyTerm("에스디케이", "SDK", VocabularyCategory.TERMINOLOGY),
            VocabularyTerm("지피티", "GPT", VocabularyCategory.TERMINOLOGY),
        ]
        result = vocabulary_service.format_vocabulary_for_prompt(vocabulary)
        assert "## 용어 사전" in result
        assert "### 기술 용어" in result
        assert "에스디케이 → SDK" in result
        assert "지피티 → GPT" in result

    def test_multiple_categories(self, vocabulary_service):
        vocabulary = [
            VocabularyTerm("에스디케이", "SDK", VocabularyCategory.TERMINOLOGY),
            VocabularyTerm("SDK", "Software Development Kit", VocabularyCategory.ABBREVIATION),
            VocabularyTerm("이상윤", "Lee Sang-yun", VocabularyCategory.NAME),
            VocabularyTerm("기타", "other", VocabularyCategory.OTHER),
        ]
        result = vocabulary_service.format_vocabulary_for_prompt(vocabulary)
        assert "### 기술 용어" in result
        assert "### 약어" in result
        assert "### 고유명사/이름" in result
        assert "### 기타" in result
        assert "에스디케이 → SDK" in result
        assert "SDK → Software Development Kit" in result
        assert "이상윤 → Lee Sang-yun" in result

    def test_format_output_structure(self, vocabulary_service):
        vocabulary = [
            VocabularyTerm("AI", "인공지능", VocabularyCategory.ABBREVIATION),
        ]
        result = vocabulary_service.format_vocabulary_for_prompt(vocabulary)
        lines = result.split("\n")
        # Check structure
        assert lines[0] == "## 용어 사전 (반드시 아래 용어로 교정)"
        # Should have section header
        assert any("### 약어" in line for line in lines)
        # Should have term
        assert any("AI → 인공지능" in line for line in lines)


class TestApplyVocabularyCorrections:
    def test_no_matches(self, vocabulary_service):
        text = "이것은 테스트 텍스트입니다."
        vocabulary = [
            VocabularyTerm("SDK", "소프트웨어 개발 키트", VocabularyCategory.TERMINOLOGY),
        ]
        corrected, corrections = vocabulary_service.apply_vocabulary_corrections(text, vocabulary)
        assert corrected == text
        assert corrections == []

    def test_single_match(self, vocabulary_service):
        text = "SDK를 사용합니다."
        vocabulary = [
            VocabularyTerm("SDK", "소프트웨어 개발 키트", VocabularyCategory.TERMINOLOGY),
        ]
        corrected, corrections = vocabulary_service.apply_vocabulary_corrections(text, vocabulary)
        assert corrected == "소프트웨어 개발 키트를 사용합니다."
        assert len(corrections) == 1
        assert corrections[0]["original"] == "SDK"
        assert corrections[0]["corrected"] == "소프트웨어 개발 키트"
        assert corrections[0]["count"] == 1

    def test_multiple_matches_same_term(self, vocabulary_service):
        text = "SDK로 SDK를 개발합니다."
        vocabulary = [
            VocabularyTerm("SDK", "소프트웨어 개발 키트", VocabularyCategory.TERMINOLOGY),
        ]
        corrected, corrections = vocabulary_service.apply_vocabulary_corrections(text, vocabulary)
        assert corrected == "소프트웨어 개발 키트로 소프트웨어 개발 키트를 개발합니다."
        assert len(corrections) == 1
        assert corrections[0]["count"] == 2

    def test_multiple_different_terms(self, vocabulary_service):
        text = "SDK와 API를 사용합니다."
        vocabulary = [
            VocabularyTerm("SDK", "소프트웨어 개발 키트", VocabularyCategory.TERMINOLOGY),
            VocabularyTerm("API", "응용 프로그래밍 인터페이스", VocabularyCategory.TERMINOLOGY),
        ]
        corrected, corrections = vocabulary_service.apply_vocabulary_corrections(text, vocabulary)
        assert corrected == "소프트웨어 개발 키트와 응용 프로그래밍 인터페이스를 사용합니다."
        assert len(corrections) == 2

    def test_empty_vocabulary(self, vocabulary_service):
        text = "테스트 텍스트입니다."
        corrected, corrections = vocabulary_service.apply_vocabulary_corrections(text, [])
        assert corrected == text
        assert corrections == []

    def test_category_in_correction(self, vocabulary_service):
        text = "SDK 개발 중"
        vocabulary = [
            VocabularyTerm("SDK", "Software Development Kit", VocabularyCategory.ABBREVIATION),
        ]
        corrected, corrections = vocabulary_service.apply_vocabulary_corrections(text, vocabulary)
        assert corrections[0]["category"] == "abbreviation"


class TestVocabularyTermDataclass:
    def test_create_term(self):
        term = VocabularyTerm(
            term="SDK",
            correction="소프트웨어 개발 키트",
            category=VocabularyCategory.ABBREVIATION,
        )
        assert term.term == "SDK"
        assert term.correction == "소프트웨어 개발 키트"
        assert term.category == VocabularyCategory.ABBREVIATION

    def test_term_equality(self):
        term1 = VocabularyTerm("SDK", "소프트웨어 개발 키트", VocabularyCategory.ABBREVIATION)
        term2 = VocabularyTerm("SDK", "소프트웨어 개발 키트", VocabularyCategory.ABBREVIATION)
        assert term1 == term2

    def test_term_inequality(self):
        term1 = VocabularyTerm("SDK", "소프트웨어 개발 키트", VocabularyCategory.ABBREVIATION)
        term2 = VocabularyTerm("API", "응용 프로그래밍 인터페이스", VocabularyCategory.ABBREVIATION)
        assert term1 != term2
