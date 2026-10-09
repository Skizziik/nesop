from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=None, extra="ignore")

    database_url: str = "postgresql+asyncpg://farm:farm@postgres:5432/farm"
    redis_url: str = "redis://redis:6379/0"
    tts_url: str = "http://tts:8100"
    renderer_url: str = "http://renderer:3100"
    languagetool_url: str = "http://languagetool:8010"

    data_dir: Path = Path("/data")
    content_dir: Path = Path("/srv/content")
    schemas_dir: Path = Path("/srv/schemas")

    # LLM (этап 3)
    llm_provider: str = "anthropic"
    anthropic_api_key: str = ""
    anthropic_model: str = "claude-sonnet-5-5"
    openai_base_url: str = ""
    openai_api_key: str = ""
    openai_model: str = ""
    ollama_url: str = "http://host.docker.internal:11434"
    ollama_model: str = "qwen2.5:14b"

    # Канал (подставляется в промпты LLM, водяной знак, описания)
    channel_name: str = "Sip of Italian"
    channel_handle: str = "@SipOfItalian"
    channel_tagline: str = "Learn Italian, one sip at a time"

    # Пайплайн
    worker_max_jobs: int = 2
    render_timeout_s: int = 900
    default_tts_model: str = "piper"
    default_tts_voice: str = "it_IT-serena-medium"
    default_tts_speed: float = 0.92

    # Флаги поздних этапов
    youtube_upload_enabled: bool = False
    max_publish_per_day: int = 3

    @property
    def renders_dir(self) -> Path:
        return self.data_dir / "renders"


@lru_cache
def get_settings() -> Settings:
    return Settings()
