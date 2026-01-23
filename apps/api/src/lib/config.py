from functools import lru_cache
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

    # Project
    PROJECT_NAME: str = "WeeklyRun API"
    PROJECT_ENV: Literal["local", "staging", "prod"] = "local"

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/weeklyrun"

    # Redis (optional)
    REDIS_URL: str | None = "redis://localhost:6379/0"

    # CORS
    CORS_ORIGINS: list[str] = ["http://localhost:3000"]

    # File Upload
    UPLOAD_DIR: str = "./data/uploads"
    MAX_FILE_SIZE: int = 104857600  # 100MB

    # Confluence API v2
    CONFLUENCE_BASE_URL: str = ""
    CONFLUENCE_USERNAME: str = ""
    CONFLUENCE_TOKEN: str = ""
    CONFLUENCE_SPACE_ID: str = ""
    CONFLUENCE_REPORT_PARENT_PAGE_ID: str = ""
    CONFLUENCE_MINUTES_PARENT_PAGE_ID: str = ""

    # ElevenLabs STT
    ELEVENLABS_API_KEY: str = ""

    # OpenAI (GPT for minutes generation)
    OPENAI_API_KEY: str = ""
    OPENAI_MODEL: str = "gpt-4o"


@lru_cache
def get_settings() -> Settings:
    """Cached settings instance."""
    return Settings()


settings = get_settings()
