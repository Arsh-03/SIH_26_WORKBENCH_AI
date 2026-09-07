from fastapi import APIRouter, HTTPException, status
from backend.app.models.schemas import SandboxExecuteRequest, SandboxExecuteResponse
from backend.app.services.sandbox_service import sandbox_service

router = APIRouter()

@router.post("/execute", response_model=SandboxExecuteResponse)
async def execute_in_sandbox(payload: SandboxExecuteRequest):
    """
    Isolated sandbox execution for calculations, data transformations, and graph generation.
    Enforces air-gap, memory quota, and timeout constraints.
    """
    try:
        res = await sandbox_service.execute_code(
            code=payload.code,
            language=payload.language or "python",
            stdin_input=payload.stdin,
            timeout_seconds=payload.timeout_seconds,
            memory_limit_mb=payload.memory_limit_mb
        )
        return res
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Sandbox execution error: {str(e)}"
        )
