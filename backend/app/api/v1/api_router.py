from fastapi import APIRouter
from backend.app.api.v1.endpoints import (
    auth,
    chats,
    workspaces,
    documents,
    agent_ws,
    vision,
    sandbox,
    telemetry,
    audit,
    artifacts,
    audio,
)

api_router = APIRouter()

# Authentication & Operators
api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])

# Chat Sessions & Persistent History
api_router.include_router(chats.router, prefix="/chats", tags=["Chat Persistence"])

# Workspaces & Documents
api_router.include_router(workspaces.router, prefix="/workspaces", tags=["Workspaces"])
api_router.include_router(documents.router, prefix="/workspaces", tags=["Documents"])

# Real-time WebSocket Agent
api_router.include_router(agent_ws.router, prefix="/agents", tags=["Agent Execution"])

# Vision Pipeline
api_router.include_router(vision.router, prefix="/vision", tags=["Vision Pipeline"])

# Code Sandbox
api_router.include_router(sandbox.router, prefix="/sandbox", tags=["Sandbox Execution"])

# System Telemetry & Air-Gap Compliance
api_router.include_router(telemetry.router, prefix="/system", tags=["System Telemetry"])
api_router.include_router(audit.router, prefix="/audit", tags=["Audit & Compliance"])

# Artifacts Download
api_router.include_router(artifacts.router, prefix="/artifacts", tags=["Artifacts"])

# Audio Transcription
api_router.include_router(audio.router, prefix="/audio", tags=["Audio Transcription"])

