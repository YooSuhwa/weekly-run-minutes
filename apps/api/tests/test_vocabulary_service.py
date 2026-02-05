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

        # term: 올바른 용어, correction: 발음 힌트
        vocab1 = Vocabulary(
            team_id=team.id,
            term="피디아",  # correct term
            correction="피디야",  # pronunciation hint
            category=VocabularyCategory.TERMINOLOGY,
        )
        vocab2 = Vocabulary(
            team_id=team.id,
            term="SDK",  # correct term, no hint
            correction="SDK",  # same as term
            category=VocabularyCategory.ABBREVIATION,
        )
        db_session.add_all([vocab1, vocab2])
        await db_session.commit()

        result = await vocabulary_service.get_team_vocabulary(db_session, team.id)
        assert len(result) == 2
        # Should be ordered by term
        assert result[0].term == "SDK"
        assert result[1].term == "피디아"

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
            term="피디아",
            correction="피디야",
            category=VocabularyCategory.TERMINOLOGY,
        )
        vocab2 = Vocabulary(
            team_id=team2.id,
            term="클로드",
            correction="클라우드",
            category=VocabularyCategory.TERMINOLOGY,
        )
        db_session.add_all([vocab1, vocab2])
        await db_session.commit()

        result = await vocabulary_service.get_team_vocabulary(db_session, team1.id)
        assert len(result) == 1
        assert result[0].term == "피디아"


class TestFormatVocabularyForPrompt:
    def test_empty_vocabulary(self, vocabulary_service):
        result = vocabulary_service.format_vocabulary_for_prompt([])
        assert result == ""

    def test_single_category_with_hints(self, vocabulary_service):
        # term: 올바른 용어, correction: 발음 힌트
        vocabulary = [
            VocabularyTerm("피디아", "피디야", VocabularyCategory.TERMINOLOGY),
            VocabularyTerm("클로드", "클라우드", VocabularyCategory.TERMINOLOGY),
        ]
        result = vocabulary_service.format_vocabulary_for_prompt(vocabulary)
        assert "## 용어 사전" in result
        assert "### 기술 용어" in result
        assert "**피디아** (발음 힌트: 피디야)" in result
        assert "**클로드** (발음 힌트: 클라우드)" in result

    def test_single_category_without_hints(self, vocabulary_service):
        # correction == term: no hint, just term listing
        vocabulary = [
            VocabularyTerm("SDK", "SDK", VocabularyCategory.TERMINOLOGY),
            VocabularyTerm("GPT", "GPT", VocabularyCategory.TERMINOLOGY),
        ]
        result = vocabulary_service.format_vocabulary_for_prompt(vocabulary)
        assert "## 용어 사전" in result
        assert "### 기술 용어" in result
        assert "**SDK**" in result
        assert "**GPT**" in result
        assert "발음 힌트" not in result  # No hints when correction == term

    def test_multiple_categories(self, vocabulary_service):
        vocabulary = [
            VocabularyTerm("피디아", "피디야", VocabularyCategory.TERMINOLOGY),
            VocabularyTerm("SDK", "SDK", VocabularyCategory.ABBREVIATION),
            VocabularyTerm("이상윤", "이상윤", VocabularyCategory.NAME),
            VocabularyTerm("위키", "위키", VocabularyCategory.OTHER),
        ]
        result = vocabulary_service.format_vocabulary_for_prompt(vocabulary)
        assert "### 기술 용어" in result
        assert "### 약어" in result
        assert "### 고유명사/이름" in result
        assert "### 기타" in result
        assert "**피디아** (발음 힌트: 피디야)" in result
        assert "**SDK**" in result  # No hint, correction == term

    def test_format_output_structure(self, vocabulary_service):
        vocabulary = [
            VocabularyTerm("피디아", "피디야", VocabularyCategory.TERMINOLOGY),
        ]
        result = vocabulary_service.format_vocabulary_for_prompt(vocabulary)
        lines = result.split("\n")
        # Check structure
        assert lines[0] == "## 용어 사전"
        assert "정확하게 인식해야 하는 중요한 단어" in lines[1]
        # Should have section header
        assert any("### 기술 용어" in line for line in lines)
        # Should have term with hint
        assert any("**피디아** (발음 힌트: 피디야)" in line for line in lines)


class TestApplyVocabularyCorrections:
    def test_no_matches(self, vocabulary_service):
        """No correction when pronunciation hint not found in text."""
        text = "이것은 테스트 텍스트입니다."
        vocabulary = [
            VocabularyTerm("피디아", "피디야", VocabularyCategory.TERMINOLOGY),
        ]
        corrected, corrections = vocabulary_service.apply_vocabulary_corrections(text, vocabulary)
        assert corrected == text
        assert corrections == []

    def test_single_match(self, vocabulary_service):
        """Replaces pronunciation hint with correct term."""
        text = "피디야를 사용합니다."  # pronunciation hint in text
        vocabulary = [
            VocabularyTerm("피디아", "피디야", VocabularyCategory.TERMINOLOGY),  # term=correct, correction=hint
        ]
        corrected, corrections = vocabulary_service.apply_vocabulary_corrections(text, vocabulary)
        assert corrected == "피디아를 사용합니다."  # hint replaced with correct term
        assert len(corrections) == 1
        assert corrections[0]["original"] == "피디야"  # hint
        assert corrections[0]["corrected"] == "피디아"  # correct term
        assert corrections[0]["count"] == "1"

    def test_multiple_matches_same_term(self, vocabulary_service):
        text = "피디야로 피디야를 개발합니다."
        vocabulary = [
            VocabularyTerm("피디아", "피디야", VocabularyCategory.TERMINOLOGY),
        ]
        corrected, corrections = vocabulary_service.apply_vocabulary_corrections(text, vocabulary)
        assert corrected == "피디아로 피디아를 개발합니다."
        assert len(corrections) == 1
        assert corrections[0]["count"] == "2"

    def test_multiple_different_terms(self, vocabulary_service):
        text = "피디야와 클라우드를 사용합니다."
        vocabulary = [
            VocabularyTerm("피디아", "피디야", VocabularyCategory.TERMINOLOGY),
            VocabularyTerm("클로드", "클라우드", VocabularyCategory.TERMINOLOGY),
        ]
        corrected, corrections = vocabulary_service.apply_vocabulary_corrections(text, vocabulary)
        assert corrected == "피디아와 클로드를 사용합니다."
        assert len(corrections) == 2

    def test_empty_vocabulary(self, vocabulary_service):
        text = "테스트 텍스트입니다."
        corrected, corrections = vocabulary_service.apply_vocabulary_corrections(text, [])
        assert corrected == text
        assert corrections == []

    def test_no_correction_when_hint_equals_term(self, vocabulary_service):
        """No correction when correction == term (no pronunciation hint)."""
        text = "SDK를 사용합니다."
        vocabulary = [
            VocabularyTerm("SDK", "SDK", VocabularyCategory.ABBREVIATION),  # no hint
        ]
        corrected, corrections = vocabulary_service.apply_vocabulary_corrections(text, vocabulary)
        assert corrected == text  # No change
        assert corrections == []

    def test_category_in_correction(self, vocabulary_service):
        text = "피디야 개발 중"
        vocabulary = [
            VocabularyTerm("피디아", "피디야", VocabularyCategory.ABBREVIATION),
        ]
        corrected, corrections = vocabulary_service.apply_vocabulary_corrections(text, vocabulary)
        assert corrections[0]["category"] == "abbreviation"

    def test_multiple_hints_comma_separated(self, vocabulary_service):
        """Supports multiple pronunciation hints separated by comma."""
        text = "피디야와 피디얌을 사용합니다. 피디아이도 있네요."
        vocabulary = [
            VocabularyTerm("피디아", "피디야,피디얌,피디아이", VocabularyCategory.TERMINOLOGY),
        ]
        corrected, corrections = vocabulary_service.apply_vocabulary_corrections(text, vocabulary)
        assert corrected == "피디아와 피디아을 사용합니다. 피디아도 있네요."
        assert len(corrections) == 3
        # Each hint should be recorded separately
        originals = [c["original"] for c in corrections]
        assert "피디야" in originals
        assert "피디얌" in originals
        assert "피디아이" in originals

    def test_comma_separated_with_spaces(self, vocabulary_service):
        """Handles spaces around commas in hints."""
        text = "클라우드와 클로드와 클라우디를 사용합니다."
        vocabulary = [
            VocabularyTerm("클로드", "클라우드, 클라우디", VocabularyCategory.TERMINOLOGY),
        ]
        corrected, corrections = vocabulary_service.apply_vocabulary_corrections(text, vocabulary)
        assert corrected == "클로드와 클로드와 클로드를 사용합니다."
        assert len(corrections) == 2


class TestVocabularyTermDataclass:
    def test_create_term(self):
        term = VocabularyTerm(
            term="피디아",
            correction="피디야",
            category=VocabularyCategory.TERMINOLOGY,
        )
        assert term.term == "피디아"
        assert term.correction == "피디야"
        assert term.category == VocabularyCategory.TERMINOLOGY

    def test_term_equality(self):
        term1 = VocabularyTerm("피디아", "피디야", VocabularyCategory.TERMINOLOGY)
        term2 = VocabularyTerm("피디아", "피디야", VocabularyCategory.TERMINOLOGY)
        assert term1 == term2

    def test_term_inequality(self):
        term1 = VocabularyTerm("피디아", "피디야", VocabularyCategory.TERMINOLOGY)
        term2 = VocabularyTerm("클로드", "클라우드", VocabularyCategory.TERMINOLOGY)
        assert term1 != term2
