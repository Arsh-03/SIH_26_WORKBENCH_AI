from fastapi import APIRouter, HTTPException, status
from backend.app.models.schemas import VisionAnalysisRequest, VisionAnalysisResponse
from backend.app.services.vision_service import vision_service

router = APIRouter()

@router.post("/analyze", response_model=VisionAnalysisResponse)
async def analyze_schematic_drawing(payload: VisionAnalysisRequest):
    """
    Direct inspection of CAD renders, P&ID schematics, or wiring drawings using Qwen 2-VL.
    Returns detected components with 2D spatial bounding boxes.
    """
    try:
        response = await vision_service.analyze_schematic(
            workspace_id=payload.workspace_id,
            image_path=payload.image_path,
            prompt=payload.prompt,
            confidence_threshold=payload.confidence_threshold
        )
        return response
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Vision analysis failed: {str(e)}"
        )
