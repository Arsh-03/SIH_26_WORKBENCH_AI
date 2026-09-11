import datetime
import shutil
import psutil
from fastapi import APIRouter
from backend.app.config import settings
from backend.app.models.schemas import (
    SystemHealthResponse,
    NetworkIsolationTelemetry,
    GpuTelemetry,
    LoadedModelInfo
)
from backend.app.core.zero_egress import verify_network_isolation
from backend.app.services.ollama_client import ollama_client
from backend.app.services.telemetry import telemetry_service

router = APIRouter()

@router.get("/telemetry")
async def get_hardware_telemetry():
    """
    Returns live hardware metrics (CPU, RAM, GPU VRAM, GPU temperature, token rate, air-gap status).
    """
    return telemetry_service.get_system_telemetry()


@router.get("/health", response_model=SystemHealthResponse)
async def get_system_health():
    """
    Monitors local hardware utilization, model allocation, and operational air-gap verification.
    """
    now = datetime.datetime.utcnow().isoformat() + "Z"

    # Network isolation verification
    isolation_data = verify_network_isolation()
    network_isolation = NetworkIsolationTelemetry(
        air_gap_active=isolation_data["air_gap_active"],
        external_interfaces_active=isolation_data["external_interfaces_active"],
        bytes_sent_external=isolation_data["bytes_sent_external"]
    )

    # GPU / Memory telemetry
    gpu_telemetry = GpuTelemetry(
        device_name="Workstation On-Premise Host",
        total_vram_mb=0,
        allocated_vram_mb=0,
        free_vram_mb=0
    )

    # Check for nvidia-smi if available
    try:
        if shutil.which("nvidia-smi"):
            import subprocess
            out = subprocess.check_output(
                ["nvidia-smi", "--query-gpu=name,memory.total,memory.used,memory.free", "--format=csv,noheader,nounits"],
                text=True,
                timeout=1.0
            ).strip()
            if out:
                parts = [p.strip() for p in out.split(",")]
                if len(parts) >= 4:
                    gpu_telemetry = GpuTelemetry(
                        device_name=parts[0],
                        total_vram_mb=int(parts[1]),
                        allocated_vram_mb=int(parts[2]),
                        free_vram_mb=int(parts[3])
                    )
        else:
            # Fallback to system RAM telemetry
            mem = psutil.virtual_memory()
            gpu_telemetry = GpuTelemetry(
                device_name="Host CPU / RAM Memory Enclave",
                total_vram_mb=int(mem.total / (1024 * 1024)),
                allocated_vram_mb=int(mem.used / (1024 * 1024)),
                free_vram_mb=int(mem.available / (1024 * 1024))
            )
    except Exception:
        pass

    # Check Ollama models status
    ollama_health = await ollama_client.check_health()
    loaded_models = [
        LoadedModelInfo(
            name=settings.REASONING_MODEL,
            role="core_reasoning",
            engine="ollama",
            status="ready" if ollama_health["running"] else "configured"
        ),
        LoadedModelInfo(
            name=settings.VISION_MODEL,
            role="multimodal_vision",
            engine="ollama",
            status="ready" if ollama_health["running"] else "configured"
        ),
        LoadedModelInfo(
            name=settings.EMBEDDING_MODEL,
            role="vector_embeddings",
            engine="ollama",
            status="ready" if ollama_health["running"] else "configured"
        )
    ]

    return SystemHealthResponse(
        gateway_status="healthy",
        timestamp=now,
        network_isolation=network_isolation,
        gpu_telemetry=gpu_telemetry,
        loaded_models=loaded_models,
        ollama_endpoint=settings.OLLAMA_BASE_URL,
        ollama_running=bool(ollama_health.get("running", False)),
        available_models=ollama_health.get("available_models", [])
    )
