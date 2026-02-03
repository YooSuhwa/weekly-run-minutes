"""Vocabulary schemas for API requests and responses."""

from uuid import UUID

from pydantic import Field

from src.models.vocabulary import VocabularyCategory
from src.schemas.common import BaseSchema, IDSchema, TimestampSchema


class VocabularyCreate(BaseSchema):
    """Schema for creating a vocabulary term."""

    term: str = Field(..., min_length=1, max_length=200)
    correction: str = Field(..., min_length=1, max_length=200)
    category: VocabularyCategory = Field(default=VocabularyCategory.TERMINOLOGY)


class VocabularyUpdate(BaseSchema):
    """Schema for updating a vocabulary term."""

    term: str | None = Field(None, min_length=1, max_length=200)
    correction: str | None = Field(None, min_length=1, max_length=200)
    category: VocabularyCategory | None = None


class VocabularyResponse(IDSchema, TimestampSchema):
    """Schema for vocabulary response."""

    team_id: UUID
    term: str
    correction: str
    category: VocabularyCategory


class VocabularyBulkImportItem(BaseSchema):
    """Schema for a single item in bulk import."""

    term: str = Field(..., min_length=1, max_length=200)
    correction: str = Field(..., min_length=1, max_length=200)
    category: VocabularyCategory = Field(default=VocabularyCategory.TERMINOLOGY)


class VocabularyBulkImport(BaseSchema):
    """Schema for bulk import request."""

    items: list[VocabularyBulkImportItem] = Field(..., min_length=1, max_length=500)
    skip_duplicates: bool = Field(default=True)


class VocabularyBulkImportResponse(BaseSchema):
    """Schema for bulk import response."""

    imported: int
    skipped: int
    items: list[VocabularyResponse]
