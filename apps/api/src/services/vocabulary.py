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
            select(Vocabulary)
            .where(Vocabulary.team_id == team_id)
            .order_by(Vocabulary.term)
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

        lines = ["## 용어 사전 (반드시 아래 용어로 교정)"]

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
                    lines.append(f"- {term.term} → {term.correction}")

        return "\n".join(lines)

    def apply_vocabulary_corrections(
        self,
        text: str,
        vocabulary: list[VocabularyTerm],
    ) -> tuple[str, list[dict[str, str | int]]]:
        """Apply vocabulary corrections to text.

        This is a simple string replacement that can be used for
        pre-processing or validation.

        Args:
            text: Text to correct
            vocabulary: List of vocabulary terms

        Returns:
            Tuple of (corrected_text, list of corrections made)
        """
        corrections_made = []

        for term in vocabulary:
            if term.term in text:
                count = text.count(term.term)
                text = text.replace(term.term, term.correction)
                corrections_made.append({
                    "original": term.term,
                    "corrected": term.correction,
                    "category": str(term.category.value),
                    "count": count,
                })
                logger.debug(
                    "Applied vocabulary correction",
                    term=term.term,
                    correction=term.correction,
                    count=count,
                )

        return text, corrections_made
