"""Vocabulary service for team-specific terminology management."""

from dataclasses import dataclass
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.lib.logging import get_logger
from src.models import Vocabulary, VocabularyCategory

logger = get_logger(__name__)


@dataclass
class VocabularyTerm:
    """A vocabulary term with its correction."""

    term: str
    correction: str
    category: VocabularyCategory


class VocabularyService:
    """Service for vocabulary operations."""

    async def get_team_vocabulary(
        self,
        db: AsyncSession,
        team_id: UUID,
    ) -> list[VocabularyTerm]:
        """Load all vocabulary terms for a team.

        Args:
            db: Database session
            team_id: Team ID

        Returns:
            List of vocabulary terms
        """
        result = await db.execute(
            select(Vocabulary).where(Vocabulary.team_id == team_id).order_by(Vocabulary.term)
        )
        vocabularies = result.scalars().all()

        return [
            VocabularyTerm(
                term=v.term,
                correction=v.correction,
                category=v.category,
            )
            for v in vocabularies
        ]

    def format_vocabulary_for_prompt(
        self,
        vocabulary: list[VocabularyTerm],
    ) -> str:
        """Format vocabulary terms for inclusion in AI prompt.

        Groups terms by category for better context.
        Presents terms as "important words to recognize correctly".

        Args:
            vocabulary: List of vocabulary terms

        Returns:
            Formatted string for prompt inclusion
        """
        if not vocabulary:
            return ""

        # Group by category
        by_category: dict[VocabularyCategory, list[VocabularyTerm]] = {}
        for term in vocabulary:
            if term.category not in by_category:
                by_category[term.category] = []
            by_category[term.category].append(term)

        lines = [
            "## 용어 사전",
            "아래 용어들은 정확하게 인식해야 하는 중요한 단어입니다.",
            "비슷하게 들리는 발음이 있더라도 반드시 아래 표기로 사용하세요.",
        ]

        category_names = {
            VocabularyCategory.TERMINOLOGY: "기술 용어",
            VocabularyCategory.ABBREVIATION: "약어",
            VocabularyCategory.NAME: "고유명사/이름",
            VocabularyCategory.OTHER: "기타",
        }

        for category in VocabularyCategory:
            terms = by_category.get(category, [])
            if terms:
                lines.append(f"\n### {category_names.get(category, category)}")
                for term in terms:
                    # If correction differs from term, show hint
                    if term.correction != term.term:
                        lines.append(f"- **{term.term}** (발음 힌트: {term.correction})")
                    else:
                        lines.append(f"- **{term.term}**")

        return "\n".join(lines)

    def apply_vocabulary_corrections(
        self,
        text: str,
        vocabulary: list[VocabularyTerm],
    ) -> tuple[str, list[dict[str, str]]]:
        """Apply vocabulary corrections to text.

        Replaces pronunciation hints (correction) with correct terms (term).
        Supports multiple hints separated by comma (e.g., "피디야,피디얌,피디아이").

        Args:
            text: Text to correct
            vocabulary: List of vocabulary terms

        Returns:
            Tuple of (corrected_text, list of corrections made)
        """
        corrections_made = []

        for vocab in vocabulary:
            # Skip if correction equals term (no hint)
            if vocab.correction == vocab.term:
                continue

            # Split by comma to support multiple hints
            hints = [h.strip() for h in vocab.correction.split(",") if h.strip()]

            for hint in hints:
                # Skip if hint equals term
                if hint == vocab.term:
                    continue

                if hint in text:
                    count = text.count(hint)
                    text = text.replace(hint, vocab.term)
                    corrections_made.append(
                        {
                            "original": hint,
                            "corrected": vocab.term,
                            "category": str(vocab.category.value),
                            "count": str(count),
                        }
                    )
                    logger.debug(
                        "Applied vocabulary correction",
                        original=hint,
                        corrected=vocab.term,
                        count=count,
                    )

        return text, corrections_made
