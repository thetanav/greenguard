from fastapi import APIRouter, File, HTTPException, UploadFile

from app.core.config import settings
from app.schemas.prediction import PredictionResult
from app.services.model_service import model_service

router = APIRouter(prefix="/predict", tags=["prediction"])


@router.post("", response_model=PredictionResult)
async def predict_disease(file: UploadFile = File(...)) -> PredictionResult:
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Please upload a valid image file")

    file_bytes = await file.read()
    max_size_bytes = settings.max_upload_size_mb * 1024 * 1024
    if len(file_bytes) > max_size_bytes:
        raise HTTPException(
            status_code=413,
            detail=f"Image is too large. Max allowed size is {settings.max_upload_size_mb}MB.",
        )

    try:
        result = model_service.predict(file_bytes)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail="Prediction service failed. Please verify the model configuration.",
        ) from exc

    return PredictionResult(**result)
