"""App settings, loaded from environment / .env (pydantic-settings)."""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    # Supabase project
    supabase_url: str
    supabase_anon_key: str           # public; used with the user's JWT (RLS applies)
    supabase_service_role_key: str   # secret; bypasses RLS — server-side only

    # CORS — the frontend origins allowed to call this API
    allowed_origins: list[str] = ["http://localhost:5173"]


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]
