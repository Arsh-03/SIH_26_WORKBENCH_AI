import os
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parent.parent
ROOT_DIR = BACKEND_DIR.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=[str(ROOT_DIR / ".env"), str(BACKEND_DIR / ".env")],
        env_file_encoding="utf-8",
        extra="ignore"
    )


    # Server
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    DEBUG: bool = True
    API_V1_PREFIX: str = "/api/v1"
    PROJECT_NAME: str = "SIH PS26117 Sovereign Agentic Workbench Gateway"

    # Storage Paths (resolved relative to backend directory)
    STORAGE_DIR: str = str(BACKEND_DIR / "storage")
    UPLOADS_DIR: str = str(BACKEND_DIR / "storage" / "uploads")
    ARTIFACTS_DIR: str = str(BACKEND_DIR / "storage" / "artifacts")
    CHROMA_PERSIST_DIR: str = str(BACKEND_DIR / "storage" / "chroma_db")
    SQLITE_DB_PATH: str = str(BACKEND_DIR / "storage" / "workbench.db")

    # Local LLM / VLM / Embedding Models
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    REASONING_MODEL: str = "qwen2.5:7b-instruct-q4_K_M"
    VISION_MODEL: str = "qwen2-vl:7b-instruct-q4_K_M"
    EMBEDDING_MODEL: str = "nomic-embed-text:latest"
    EMBEDDING_DIMENSIONS: int = 768

    # Air-gap & Zero Egress
    ENFORCE_ZERO_EGRESS: bool = True
    ALLOWED_HOSTS: list[str] = ["127.0.0.1", "localhost", "0.0.0.0", "::1"]

    # Sandbox Execution
    SANDBOX_TIMEOUT_SECONDS: int = 10
    SANDBOX_MEMORY_LIMIT_MB: int = 512

    def ensure_directories(self) -> None:
        """Create necessary storage directories if they do not exist."""
        for path in [
            self.STORAGE_DIR,
            self.UPLOADS_DIR,
            self.ARTIFACTS_DIR,
            self.CHROMA_PERSIST_DIR,
        ]:
            os.makedirs(path, exist_ok=True)


settings = Settings()
settings.ensure_directories()
