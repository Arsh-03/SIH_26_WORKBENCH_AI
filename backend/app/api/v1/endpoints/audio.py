import logging
from fastapi import APIRouter, File, UploadFile, HTTPException
from backend.app.services.transcription_service import transcription_service

logger = logging.getLogger("audio_router")

router = APIRouter()

@router.post("/transcribe")
async def transcribe_audio(
    file: UploadFile = File(...)
):
    """
    Accepts audio recordings (WebM, WAV, MP4, OGG) and transcribes speech to text
    using local high-performance whisper model.
    """
    try:
        content = await file.read()
        if not content:
            raise HTTPException(status_code=400, detail="Empty audio payload")

        filename = file.filename or "audio.webm"
        suffix = ".webm"
        if "." in filename:
            suffix = f".{filename.split('.')[-1]}"

        text = transcription_service.transcribe_audio_bytes(content, suffix=suffix)
        return {
            "status": "success",
            "text": text,
            "filename": filename,
            "bytes_received": len(content)
        }
    except Exception as e:
        logger.error(f"Error transcribing audio: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Audio transcription failed: {str(e)}")
