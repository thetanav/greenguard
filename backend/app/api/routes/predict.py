from fastapi import APIRouter, File, HTTPException, UploadFile

from app.schemas.prediction import PredictionResult
from app.services.model_service import model_service

router = APIRouter(prefix="/predict", tags=["prediction"])


@router.post("", response_model=PredictionResult)
async def predict_disease(file: UploadFile = File(...)) -> PredictionResult:
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Please upload a valid image file")

    file_bytes = await file.read()
    result = model_service.predict(file_bytes)
    return PredictionResult(**result)
