import os
from pathlib import Path
from fastapi import APIRouter, HTTPException, status
from fastapi.responses import FileResponse
from backend.app.config import settings
from backend.app.core.security import sanitize_filename

router = APIRouter()

@router.get("/download/{filename}")
async def download_artifact(filename: str):
    """
    Download generated sandbox artifacts (e.g. degradation plots, CSV tables).
    """
    clean_name = sanitize_filename(filename)
    filepath = Path(settings.ARTIFACTS_DIR) / clean_name

    if not filepath.exists() or not filepath.is_file():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Artifact '{clean_name}' not found."
        )

    # Determine media type
    media_type = "application/octet-stream"
    if clean_name.endswith(".png"):
        media_type = "image/png"
    elif clean_name.endswith(".jpg") or clean_name.endswith(".jpeg"):
        media_type = "image/jpeg"
    elif clean_name.endswith(".csv"):
        media_type = "text/csv"
    elif clean_name.endswith(".pdf"):
        media_type = "application/pdf"

    return FileResponse(
        path=str(filepath),
        media_type=media_type,
        filename=clean_name
    )
