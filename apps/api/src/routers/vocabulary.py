"""Vocabulary API endpoints for team-specific terminology management."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from src.lib.dependencies import get_db
from src.models import Team, Vocabulary, VocabularyCategory
from src.schemas.vocabulary import (
    VocabularyBulkImport,
    VocabularyBulkImportResponse,
    VocabularyCreate,
    VocabularyResponse,
    VocabularyUpdate,
)

# Dependency type alias
DB = Annotated[AsyncSession, Depends(get_db)]

router = APIRouter()


async def _get_team_or_404(db: AsyncSession, team_id: UUID) -> Team:
    """Get team by ID or raise 404."""
    result = await db.execute(select(Team).where(Team.id == team_id))
    team = result.scalar_one_or_none()
    if not team:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Team not found",
        )
    return team


async def _get_vocabulary_or_404(
    db: AsyncSession, team_id: UUID, vocabulary_id: UUID
) -> Vocabulary:
    """Get vocabulary term by ID within team or raise 404."""
    result = await db.execute(
        select(Vocabulary).where(
            Vocabulary.id == vocabulary_id,
            Vocabulary.team_id == team_id,
        )
    )
    vocabulary = result.scalar_one_or_none()
    if not vocabulary:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vocabulary term not found",
        )
    return vocabulary


@router.get("", response_model=list[VocabularyResponse])
async def list_vocabulary(
    team_id: UUID,
    db: DB,
    category: VocabularyCategory | None = Query(None, description="Filter by category"),
    search: str | None = Query(None, description="Search in term or correction"),
) -> list[Vocabulary]:
    """List all vocabulary terms for a team.

    Optionally filter by category or search text.
    """
    await _get_team_or_404(db, team_id)

    query = select(Vocabulary).where(Vocabulary.team_id == team_id)

    if category:
        query = query.where(Vocabulary.category == category)

    if search:
        search_pattern = f"%{search}%"
        query = query.where(
            (Vocabulary.term.ilike(search_pattern))
            | (Vocabulary.correction.ilike(search_pattern))
        )

    query = query.order_by(Vocabulary.term)
    result = await db.execute(query)
    return list(result.scalars().all())


@router.post("", response_model=VocabularyResponse, status_code=status.HTTP_201_CREATED)
async def create_vocabulary(
    team_id: UUID,
    data: VocabularyCreate,
    db: DB,
) -> Vocabulary:
    """Add a new vocabulary term for a team."""
    await _get_team_or_404(db, team_id)

    vocabulary = Vocabulary(
        team_id=team_id,
        term=data.term,
        correction=data.correction,
        category=data.category,
    )

    try:
        db.add(vocabulary)
        await db.commit()
        await db.refresh(vocabulary)
        return vocabulary
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Term '{data.term}' already exists for this team",
        )


@router.get("/{vocabulary_id}", response_model=VocabularyResponse)
async def get_vocabulary(
    team_id: UUID,
    vocabulary_id: UUID,
    db: DB,
) -> Vocabulary:
    """Get a specific vocabulary term."""
    await _get_team_or_404(db, team_id)
    return await _get_vocabulary_or_404(db, team_id, vocabulary_id)


@router.put("/{vocabulary_id}", response_model=VocabularyResponse)
async def update_vocabulary(
    team_id: UUID,
    vocabulary_id: UUID,
    data: VocabularyUpdate,
    db: DB,
) -> Vocabulary:
    """Update a vocabulary term."""
    await _get_team_or_404(db, team_id)
    vocabulary = await _get_vocabulary_or_404(db, team_id, vocabulary_id)

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(vocabulary, field, value)

    try:
        await db.commit()
        await db.refresh(vocabulary)
        return vocabulary
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Term '{data.term}' already exists for this team",
        )


@router.delete("/{vocabulary_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_vocabulary(
    team_id: UUID,
    vocabulary_id: UUID,
    db: DB,
) -> None:
    """Delete a vocabulary term."""
    await _get_team_or_404(db, team_id)
    vocabulary = await _get_vocabulary_or_404(db, team_id, vocabulary_id)
    await db.delete(vocabulary)
    await db.commit()


@router.post("/import", response_model=VocabularyBulkImportResponse)
async def bulk_import_vocabulary(
    team_id: UUID,
    data: VocabularyBulkImport,
    db: DB,
) -> VocabularyBulkImportResponse:
    """Bulk import vocabulary terms.

    - If skip_duplicates is True (default), existing terms are skipped.
    - If skip_duplicates is False, duplicate terms cause a 409 error.
    """
    await _get_team_or_404(db, team_id)

    imported_items: list[Vocabulary] = []
    skipped_count = 0

    # Get existing terms for this team
    existing_result = await db.execute(
        select(Vocabulary.term).where(Vocabulary.team_id == team_id)
    )
    existing_terms = {row[0].lower() for row in existing_result.all()}

    for item in data.items:
        # Check if term already exists (case-insensitive)
        if item.term.lower() in existing_terms:
            if data.skip_duplicates:
                skipped_count += 1
                continue
            else:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Term '{item.term}' already exists for this team",
                )

        vocabulary = Vocabulary(
            team_id=team_id,
            term=item.term,
            correction=item.correction,
            category=item.category,
        )
        db.add(vocabulary)
        imported_items.append(vocabulary)
        existing_terms.add(item.term.lower())

    await db.commit()

    # Refresh all imported items to get their IDs
    for vocab in imported_items:
        await db.refresh(vocab)

    return VocabularyBulkImportResponse(
        imported=len(imported_items),
        skipped=skipped_count,
        items=imported_items,  # type: ignore[arg-type]  # FastAPI handles ORM -> schema conversion
    )
