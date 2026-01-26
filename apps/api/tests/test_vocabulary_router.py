"""Tests for vocabulary API endpoints."""

import pytest
from httpx import AsyncClient


class TestListVocabulary:
    @pytest.mark.asyncio
    async def test_empty_list(self, client: AsyncClient):
        # Create team first
        team_resp = await client.post("/api/v1/teams", json={"name": "Test Team"})
        team_id = team_resp.json()["id"]

        response = await client.get(f"/api/v1/teams/{team_id}/vocabulary")
        assert response.status_code == 200
        assert response.json() == []

    @pytest.mark.asyncio
    async def test_list_with_vocabulary(self, client: AsyncClient):
        # Create team
        team_resp = await client.post("/api/v1/teams", json={"name": "Test Team"})
        team_id = team_resp.json()["id"]

        # Add vocabulary
        await client.post(
            f"/api/v1/teams/{team_id}/vocabulary",
            json={"term": "SDK", "correction": "소프트웨어 개발 키트", "category": "abbreviation"},
        )

        response = await client.get(f"/api/v1/teams/{team_id}/vocabulary")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["term"] == "SDK"

    @pytest.mark.asyncio
    async def test_list_filter_by_category(self, client: AsyncClient):
        # Create team and add multiple vocabulary terms
        team_resp = await client.post("/api/v1/teams", json={"name": "Test Team"})
        team_id = team_resp.json()["id"]

        await client.post(
            f"/api/v1/teams/{team_id}/vocabulary",
            json={"term": "SDK", "correction": "소프트웨어 개발 키트", "category": "abbreviation"},
        )
        await client.post(
            f"/api/v1/teams/{team_id}/vocabulary",
            json={"term": "에스디케이", "correction": "SDK", "category": "terminology"},
        )

        # Filter by category
        response = await client.get(
            f"/api/v1/teams/{team_id}/vocabulary?category=abbreviation"
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["term"] == "SDK"

    @pytest.mark.asyncio
    async def test_list_search(self, client: AsyncClient):
        # Create team and add vocabulary
        team_resp = await client.post("/api/v1/teams", json={"name": "Test Team"})
        team_id = team_resp.json()["id"]

        await client.post(
            f"/api/v1/teams/{team_id}/vocabulary",
            json={"term": "SDK", "correction": "소프트웨어 개발 키트", "category": "abbreviation"},
        )
        await client.post(
            f"/api/v1/teams/{team_id}/vocabulary",
            json={"term": "API", "correction": "응용 프로그래밍 인터페이스", "category": "abbreviation"},
        )

        # Search
        response = await client.get(f"/api/v1/teams/{team_id}/vocabulary?search=SDK")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["term"] == "SDK"

    @pytest.mark.asyncio
    async def test_list_nonexistent_team(self, client: AsyncClient):
        response = await client.get(
            "/api/v1/teams/00000000-0000-0000-0000-000000000000/vocabulary"
        )
        assert response.status_code == 404


class TestCreateVocabulary:
    @pytest.mark.asyncio
    async def test_create_success(self, client: AsyncClient):
        # Create team
        team_resp = await client.post("/api/v1/teams", json={"name": "Test Team"})
        team_id = team_resp.json()["id"]

        response = await client.post(
            f"/api/v1/teams/{team_id}/vocabulary",
            json={"term": "에스디케이", "correction": "SDK", "category": "terminology"},
        )
        assert response.status_code == 201
        data = response.json()
        assert data["term"] == "에스디케이"
        assert data["correction"] == "SDK"
        assert data["category"] == "terminology"
        assert data["team_id"] == team_id
        assert "id" in data
        assert "created_at" in data

    @pytest.mark.asyncio
    async def test_create_default_category(self, client: AsyncClient):
        # Create team
        team_resp = await client.post("/api/v1/teams", json={"name": "Test Team"})
        team_id = team_resp.json()["id"]

        # Create without category (should default to terminology)
        response = await client.post(
            f"/api/v1/teams/{team_id}/vocabulary",
            json={"term": "GPT", "correction": "Generative Pre-trained Transformer"},
        )
        assert response.status_code == 201
        assert response.json()["category"] == "terminology"

    @pytest.mark.asyncio
    async def test_create_duplicate_term_conflict(self, client: AsyncClient):
        # Create team
        team_resp = await client.post("/api/v1/teams", json={"name": "Test Team"})
        team_id = team_resp.json()["id"]

        # Create first term
        await client.post(
            f"/api/v1/teams/{team_id}/vocabulary",
            json={"term": "SDK", "correction": "소프트웨어 개발 키트"},
        )

        # Try to create duplicate
        response = await client.post(
            f"/api/v1/teams/{team_id}/vocabulary",
            json={"term": "SDK", "correction": "다른 설명"},
        )
        assert response.status_code == 409
        assert "already exists" in response.json()["detail"]

    @pytest.mark.asyncio
    async def test_create_empty_term_validation(self, client: AsyncClient):
        # Create team
        team_resp = await client.post("/api/v1/teams", json={"name": "Test Team"})
        team_id = team_resp.json()["id"]

        response = await client.post(
            f"/api/v1/teams/{team_id}/vocabulary",
            json={"term": "", "correction": "SDK"},
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_create_nonexistent_team(self, client: AsyncClient):
        response = await client.post(
            "/api/v1/teams/00000000-0000-0000-0000-000000000000/vocabulary",
            json={"term": "SDK", "correction": "소프트웨어 개발 키트"},
        )
        assert response.status_code == 404


class TestGetVocabulary:
    @pytest.mark.asyncio
    async def test_get_success(self, client: AsyncClient):
        # Create team and vocabulary
        team_resp = await client.post("/api/v1/teams", json={"name": "Test Team"})
        team_id = team_resp.json()["id"]

        create_resp = await client.post(
            f"/api/v1/teams/{team_id}/vocabulary",
            json={"term": "SDK", "correction": "소프트웨어 개발 키트"},
        )
        vocab_id = create_resp.json()["id"]

        response = await client.get(f"/api/v1/teams/{team_id}/vocabulary/{vocab_id}")
        assert response.status_code == 200
        data = response.json()
        assert data["term"] == "SDK"
        assert data["id"] == vocab_id

    @pytest.mark.asyncio
    async def test_get_nonexistent(self, client: AsyncClient):
        # Create team
        team_resp = await client.post("/api/v1/teams", json={"name": "Test Team"})
        team_id = team_resp.json()["id"]

        response = await client.get(
            f"/api/v1/teams/{team_id}/vocabulary/00000000-0000-0000-0000-000000000000"
        )
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_get_wrong_team(self, client: AsyncClient):
        # Create two teams
        team1_resp = await client.post("/api/v1/teams", json={"name": "Team 1"})
        team1_id = team1_resp.json()["id"]
        team2_resp = await client.post("/api/v1/teams", json={"name": "Team 2"})
        team2_id = team2_resp.json()["id"]

        # Create vocabulary for team1
        create_resp = await client.post(
            f"/api/v1/teams/{team1_id}/vocabulary",
            json={"term": "SDK", "correction": "소프트웨어 개발 키트"},
        )
        vocab_id = create_resp.json()["id"]

        # Try to get from team2
        response = await client.get(f"/api/v1/teams/{team2_id}/vocabulary/{vocab_id}")
        assert response.status_code == 404


class TestUpdateVocabulary:
    @pytest.mark.asyncio
    async def test_update_success(self, client: AsyncClient):
        # Create team and vocabulary
        team_resp = await client.post("/api/v1/teams", json={"name": "Test Team"})
        team_id = team_resp.json()["id"]

        create_resp = await client.post(
            f"/api/v1/teams/{team_id}/vocabulary",
            json={"term": "SDK", "correction": "소프트웨어 개발 키트"},
        )
        vocab_id = create_resp.json()["id"]

        response = await client.put(
            f"/api/v1/teams/{team_id}/vocabulary/{vocab_id}",
            json={"correction": "Software Development Kit"},
        )
        assert response.status_code == 200
        assert response.json()["correction"] == "Software Development Kit"
        assert response.json()["term"] == "SDK"  # unchanged

    @pytest.mark.asyncio
    async def test_update_all_fields(self, client: AsyncClient):
        # Create team and vocabulary
        team_resp = await client.post("/api/v1/teams", json={"name": "Test Team"})
        team_id = team_resp.json()["id"]

        create_resp = await client.post(
            f"/api/v1/teams/{team_id}/vocabulary",
            json={"term": "SDK", "correction": "소프트웨어 개발 키트", "category": "terminology"},
        )
        vocab_id = create_resp.json()["id"]

        response = await client.put(
            f"/api/v1/teams/{team_id}/vocabulary/{vocab_id}",
            json={
                "term": "SW Dev Kit",
                "correction": "Software Development Kit",
                "category": "abbreviation",
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["term"] == "SW Dev Kit"
        assert data["correction"] == "Software Development Kit"
        assert data["category"] == "abbreviation"

    @pytest.mark.asyncio
    async def test_update_duplicate_term_conflict(self, client: AsyncClient):
        # Create team and two vocabulary terms
        team_resp = await client.post("/api/v1/teams", json={"name": "Test Team"})
        team_id = team_resp.json()["id"]

        await client.post(
            f"/api/v1/teams/{team_id}/vocabulary",
            json={"term": "SDK", "correction": "소프트웨어 개발 키트"},
        )
        create_resp = await client.post(
            f"/api/v1/teams/{team_id}/vocabulary",
            json={"term": "API", "correction": "응용 프로그래밍 인터페이스"},
        )
        vocab_id = create_resp.json()["id"]

        # Try to update API to SDK
        response = await client.put(
            f"/api/v1/teams/{team_id}/vocabulary/{vocab_id}",
            json={"term": "SDK"},
        )
        assert response.status_code == 409

    @pytest.mark.asyncio
    async def test_update_nonexistent(self, client: AsyncClient):
        # Create team
        team_resp = await client.post("/api/v1/teams", json={"name": "Test Team"})
        team_id = team_resp.json()["id"]

        response = await client.put(
            f"/api/v1/teams/{team_id}/vocabulary/00000000-0000-0000-0000-000000000000",
            json={"correction": "test"},
        )
        assert response.status_code == 404


class TestDeleteVocabulary:
    @pytest.mark.asyncio
    async def test_delete_success(self, client: AsyncClient):
        # Create team and vocabulary
        team_resp = await client.post("/api/v1/teams", json={"name": "Test Team"})
        team_id = team_resp.json()["id"]

        create_resp = await client.post(
            f"/api/v1/teams/{team_id}/vocabulary",
            json={"term": "SDK", "correction": "소프트웨어 개발 키트"},
        )
        vocab_id = create_resp.json()["id"]

        response = await client.delete(f"/api/v1/teams/{team_id}/vocabulary/{vocab_id}")
        assert response.status_code == 204

        # Verify deleted
        get_resp = await client.get(f"/api/v1/teams/{team_id}/vocabulary/{vocab_id}")
        assert get_resp.status_code == 404

    @pytest.mark.asyncio
    async def test_delete_nonexistent(self, client: AsyncClient):
        # Create team
        team_resp = await client.post("/api/v1/teams", json={"name": "Test Team"})
        team_id = team_resp.json()["id"]

        response = await client.delete(
            f"/api/v1/teams/{team_id}/vocabulary/00000000-0000-0000-0000-000000000000"
        )
        assert response.status_code == 404


class TestBulkImportVocabulary:
    @pytest.mark.asyncio
    async def test_bulk_import_success(self, client: AsyncClient):
        # Create team
        team_resp = await client.post("/api/v1/teams", json={"name": "Test Team"})
        team_id = team_resp.json()["id"]

        response = await client.post(
            f"/api/v1/teams/{team_id}/vocabulary/import",
            json={
                "items": [
                    {"term": "SDK", "correction": "소프트웨어 개발 키트", "category": "abbreviation"},
                    {"term": "API", "correction": "응용 프로그래밍 인터페이스", "category": "abbreviation"},
                    {"term": "에스디케이", "correction": "SDK", "category": "terminology"},
                ]
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["imported"] == 3
        assert data["skipped"] == 0
        assert len(data["items"]) == 3

    @pytest.mark.asyncio
    async def test_bulk_import_skip_duplicates(self, client: AsyncClient):
        # Create team and existing vocabulary
        team_resp = await client.post("/api/v1/teams", json={"name": "Test Team"})
        team_id = team_resp.json()["id"]

        await client.post(
            f"/api/v1/teams/{team_id}/vocabulary",
            json={"term": "SDK", "correction": "기존 설명"},
        )

        response = await client.post(
            f"/api/v1/teams/{team_id}/vocabulary/import",
            json={
                "items": [
                    {"term": "SDK", "correction": "새 설명"},  # duplicate
                    {"term": "API", "correction": "응용 프로그래밍 인터페이스"},  # new
                ],
                "skip_duplicates": True,
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["imported"] == 1
        assert data["skipped"] == 1
        assert len(data["items"]) == 1
        assert data["items"][0]["term"] == "API"

    @pytest.mark.asyncio
    async def test_bulk_import_fail_on_duplicate(self, client: AsyncClient):
        # Create team and existing vocabulary
        team_resp = await client.post("/api/v1/teams", json={"name": "Test Team"})
        team_id = team_resp.json()["id"]

        await client.post(
            f"/api/v1/teams/{team_id}/vocabulary",
            json={"term": "SDK", "correction": "기존 설명"},
        )

        response = await client.post(
            f"/api/v1/teams/{team_id}/vocabulary/import",
            json={
                "items": [
                    {"term": "SDK", "correction": "새 설명"},  # duplicate
                    {"term": "API", "correction": "응용 프로그래밍 인터페이스"},
                ],
                "skip_duplicates": False,
            },
        )
        assert response.status_code == 409
        assert "already exists" in response.json()["detail"]

    @pytest.mark.asyncio
    async def test_bulk_import_case_insensitive_duplicate(self, client: AsyncClient):
        # Create team and existing vocabulary
        team_resp = await client.post("/api/v1/teams", json={"name": "Test Team"})
        team_id = team_resp.json()["id"]

        await client.post(
            f"/api/v1/teams/{team_id}/vocabulary",
            json={"term": "sdk", "correction": "소프트웨어 개발 키트"},
        )

        response = await client.post(
            f"/api/v1/teams/{team_id}/vocabulary/import",
            json={
                "items": [
                    {"term": "SDK", "correction": "새 설명"},  # case-insensitive duplicate
                ],
                "skip_duplicates": True,
            },
        )
        assert response.status_code == 200
        assert response.json()["skipped"] == 1

    @pytest.mark.asyncio
    async def test_bulk_import_empty_list_validation(self, client: AsyncClient):
        # Create team
        team_resp = await client.post("/api/v1/teams", json={"name": "Test Team"})
        team_id = team_resp.json()["id"]

        response = await client.post(
            f"/api/v1/teams/{team_id}/vocabulary/import",
            json={"items": []},
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_bulk_import_nonexistent_team(self, client: AsyncClient):
        response = await client.post(
            "/api/v1/teams/00000000-0000-0000-0000-000000000000/vocabulary/import",
            json={
                "items": [
                    {"term": "SDK", "correction": "소프트웨어 개발 키트"},
                ]
            },
        )
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_bulk_import_internal_duplicate_skip(self, client: AsyncClient):
        """Test that duplicates within the same import request are handled."""
        # Create team
        team_resp = await client.post("/api/v1/teams", json={"name": "Test Team"})
        team_id = team_resp.json()["id"]

        response = await client.post(
            f"/api/v1/teams/{team_id}/vocabulary/import",
            json={
                "items": [
                    {"term": "SDK", "correction": "설명1"},
                    {"term": "sdk", "correction": "설명2"},  # case-insensitive duplicate
                ],
                "skip_duplicates": True,
            },
        )
        assert response.status_code == 200
        data = response.json()
        # First one is imported, second skipped
        assert data["imported"] == 1
        assert data["skipped"] == 1


class TestVocabularyCategories:
    @pytest.mark.asyncio
    async def test_all_categories(self, client: AsyncClient):
        # Create team
        team_resp = await client.post("/api/v1/teams", json={"name": "Test Team"})
        team_id = team_resp.json()["id"]

        categories = ["terminology", "abbreviation", "name", "other"]
        for cat in categories:
            response = await client.post(
                f"/api/v1/teams/{team_id}/vocabulary",
                json={"term": f"term_{cat}", "correction": f"correction_{cat}", "category": cat},
            )
            assert response.status_code == 201
            assert response.json()["category"] == cat

    @pytest.mark.asyncio
    async def test_invalid_category(self, client: AsyncClient):
        # Create team
        team_resp = await client.post("/api/v1/teams", json={"name": "Test Team"})
        team_id = team_resp.json()["id"]

        response = await client.post(
            f"/api/v1/teams/{team_id}/vocabulary",
            json={"term": "test", "correction": "TEST", "category": "invalid"},
        )
        assert response.status_code == 422
