import sqlite3
from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import declarative_base
from backend.app.config import settings

from sqlalchemy.pool import NullPool

DATABASE_URL = f"sqlite+aiosqlite:///{settings.SQLITE_DB_PATH}"

engine = create_async_engine(
    DATABASE_URL,
    echo=False,
    poolclass=NullPool,
    connect_args={"check_same_thread": False}
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False
)

Base = declarative_base()

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()

def init_db_sync() -> None:
    """Synchronous SQLite table initialization using the master DDL."""
    settings.ensure_directories()
    conn = sqlite3.connect(settings.SQLITE_DB_PATH)
    cursor = conn.cursor()
    cursor.executescript("""
    CREATE TABLE IF NOT EXISTS workspaces (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS documents (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        filename TEXT NOT NULL,
        filepath TEXT NOT NULL,
        file_type TEXT NOT NULL,
        classification TEXT NOT NULL,
        chunk_count INTEGER DEFAULT 0,
        status TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS document_chunks (
        id TEXT PRIMARY KEY,
        document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
        chunk_index INTEGER NOT NULL,
        page_number INTEGER,
        raw_content TEXT NOT NULL,
        vector_id TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS agent_sessions (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        title TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
        id TEXT PRIMARY KEY,
        session_id TEXT REFERENCES agent_sessions(id),
        prompt_hash TEXT NOT NULL,
        tools_called TEXT NOT NULL,
        citations TEXT NOT NULL,
        egress_bytes INTEGER DEFAULT 0,
        execution_duration_ms INTEGER NOT NULL,
        compliance_status TEXT DEFAULT 'AIR_GAP_PASSED',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)
    conn.commit()
    conn.close()

async def init_db() -> None:
    """Initialize database tables according to the master schema."""
    init_db_sync()
