from pydantic import BaseModel, Field


class PredictionResult(BaseModel):
    label: str = Field(..., description="Predicted plant disease label")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Model confidence score")
    details: list[dict[str, float]] = Field(default_factory=list)
