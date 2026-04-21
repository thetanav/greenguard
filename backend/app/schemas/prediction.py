from pydantic import BaseModel, Field


class PredictionDetail(BaseModel):
    label: str = Field(..., description="Class label")
    score: float = Field(..., ge=0.0, le=1.0, description="Probability score")


class PredictionResult(BaseModel):
    label: str = Field(..., description="Predicted plant disease label")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Model confidence score")
    details: list[PredictionDetail] = Field(default_factory=list)
    recommendations: list[str] = Field(default_factory=list)
    model_ready: bool = Field(
        ..., description="Whether the TensorFlow model was loaded successfully"
    )
