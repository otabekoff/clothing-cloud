"""
Application configuration.

All settings are read from environment variables so the same image can run
unchanged across local, staging and production (a 12-factor principle that
matters for cloud portability — see docs/architecture.md, criterion B.M2).
"""

import secrets
from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "Cloud ERP/CRM/WMS Platform"
    environment: str = "development"

    # Database lives in the PRIVATE subnet and is never exposed to the internet.
    database_url: str = "postgresql+psycopg2://erp:erp@db:5432/erp"

    # Identifies which backend replica answered a request. Injected by Docker
    # so the load-balancer demo can show traffic spreading across containers.
    instance_id: str = "local"

    cors_origins: str = "*"

    # JWT auth. Set JWT_SECRET via the environment in any real deployment
    # (docker-compose.prod.yml requires it). When unset locally we generate a
    # random ephemeral secret at startup — no secret is committed to source.
    # Note: an ephemeral secret invalidates tokens on restart, which is fine
    # for local dev but is why production must provide a stable one.
    jwt_secret: str = Field(default_factory=lambda: secrets.token_urlsafe(48))
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 480  # 8h working session


@lru_cache
def get_settings() -> Settings:
    return Settings()
