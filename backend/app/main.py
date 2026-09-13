import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.app.config import settings
from backend.app.database import init_db
from backend.app.core.zero_egress import ZeroEgressInterceptorMiddleware
from backend.app.api.v1.api_router import api_router

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("sovereign_gateway")

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager for database initialization and cleanup."""
    logger.info("Initializing Sovereign Air-Gapped Workbench Backend...")
    settings.ensure_directories()
    await init_db()
    logger.info("Database schemas initialized successfully.")

    try:
        from backend.app.database import AsyncSessionLocal
        from backend.app.services.ingestion_service import ingestion_service
        async with AsyncSessionLocal() as session:
            ingested = await ingestion_service.initialize_company_documents(session)
            if ingested > 0:
                logger.info(f"Company Knowledge Base initialized with {ingested} chunks.")
    except Exception as e:
        logger.warning(f"Company document auto-ingestion warning: {e}")

    yield
    logger.info("Shutting down Sovereign Gateway.")

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Sovereign On-Premise Agentic AI Workbench - REST & WebSocket Gateway",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc"
)

# Zero-Egress Interceptor Middleware (Enforces local enclave isolation)
app.add_middleware(ZeroEgressInterceptorMiddleware)

# Cross-Origin Resource Sharing (Local Enclave Only)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount API Router
app.include_router(api_router, prefix=settings.API_V1_PREFIX)

@app.get("/")
async def root():
    return {
        "status": "online",
        "service": settings.PROJECT_NAME,
        "air_gap_enforced": settings.ENFORCE_ZERO_EGRESS,
        "api_v1_docs": "/docs"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "backend.app.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG
    )
