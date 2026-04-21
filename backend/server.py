import os
from datetime import datetime, timedelta
from io import BytesIO
from pathlib import Path

import numpy as np
import jwt
import passlib.hash
import sqlmodel
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from pydantic import BaseModel
from pydantic_settings import BaseSettings
from PIL import Image


class Settings(BaseSettings):
    app_name: str = "GreenGuard API"
    app_version: str = "0.1.0"
    frontend_origin: str = "http://localhost:5173"
    model_path: str = "./plant_diseases.h5"
    class_labels: str = "Potato___Early_blight,Potato___healthy,Potato___Late_blight"
    image_size: int = 224
    max_upload_size_mb: int = 8
    jwt_secret: str = "your-super-secret-key-change-in-production"
    jwt_algorithm: str = "HS256"
    jwt_expiry_hours: int = 24


settings = Settings()

treatment_map = {
    "Potato___Early_blight": [
        "Use certified disease-free seed tubers in the next cycle.",
        "Apply a protective fungicide program if infection spreads.",
        "Remove infected lower leaves and improve plant spacing.",
    ],
    "Potato___Late_blight": [
        "Remove and destroy infected plants immediately.",
        "Avoid overhead irrigation and keep foliage dry.",
        "Spray late-blight specific fungicide as per local guidelines.",
    ],
    "Potato___healthy": [
        "Continue balanced fertilization and irrigation schedule.",
        "Scout field weekly to detect symptoms early.",
        "Maintain crop rotation and field sanitation.",
    ],
}


sqlmodel.Field(default=None, primary_key=True)

engine = sqlmodel.create_engine("sqlite:///greenguard.db", echo=False)


class User(sqlmodel.SQLModel, table=True):
    __tablename__ = "users"
    id: int | None = sqlmodel.Field(default=None, primary_key=True)
    email: str = sqlmodel.Field(unique=True, index=True)
    password_hash: str
    name: str = ""
    created_at: datetime = sqlmodel.Field(default_factory=datetime.utcnow)


class Prediction(sqlmodel.SQLModel, table=True):
    __tablename__ = "predictions"
    id: int | None = sqlmodel.Field(default=None, primary_key=True)
    user_id: int = sqlmodel.Field(foreign_key="users.id")
    label: str
    confidence: float
    details: str
    recommendations: str
    image_name: str = ""
    created_at: datetime = sqlmodel.Field(default_factory=datetime.utcnow)


sqlmodel.SQLModel.metadata.create_all(engine)


def load_model():
    try:
        import tensorflow as tf

        model_path = settings.model_path
        if not Path(model_path).exists():
            backend_dir = Path(__file__).parent
            model_path = str(backend_dir / settings.model_path)
        if Path(model_path).exists():
            model = tf.keras.models.load_model(model_path)
            warmup = np.zeros((1, 224, 224, 3), dtype=np.float32)
            _ = model.predict(warmup, verbose=0)
            return model
    except Exception:
        pass
    return None


model = load_model()
labels = [l.strip() for l in settings.class_labels.split(",") if l.strip()]

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description="Plant disease prediction API with user authentication.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def create_token(user_id: int) -> str:
    exp = datetime.utcnow() + timedelta(hours=settings.jwt_expiry_hours)
    payload = {"sub": str(user_id), "exp": exp}
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def verify_token(token: str) -> int | None:
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        return int(payload.get("sub"))
    except jwt.PyJWTError:
        return None


def get_current_user(token: str) -> User | None:
    user_id = verify_token(token)
    if not user_id:
        return None
    with sqlmodel.Session(engine) as session:
        return session.get(User, user_id)


class AuthResponse(BaseModel):
    user_id: int
    email: str
    name: str
    token: str


class RegisterRequest(BaseModel):
    email: str
    password: str
    name: str = ""


class UserResponse(BaseModel):
    user_id: int
    email: str
    name: str


class PredictionResponse(BaseModel):
    id: int
    label: str
    confidence: float
    details: list
    recommendations: list
    image_name: str
    created_at: datetime


@app.get("/health")
def healthcheck():
    return {"status": "ok"}


@app.get("/")
def root():
    return {"name": settings.app_name, "version": settings.app_version, "docs": "/docs"}


@app.post("/api/auth/register", response_model=AuthResponse)
def register(req: RegisterRequest):
    with sqlmodel.Session(engine) as session:
        existing = session.query(User).where(User.email == req.email).first()
        if existing:
            raise HTTPException(status_code=400, detail="Email already registered")

        user = User(
            email=req.email,
            password_hash=passlib.hash.hash_sha256_crypt(req.password),
            name=req.name or req.email.split("@")[0],
        )
        session.add(user)
        session.commit()
        session.refresh(user)

        token = create_token(user.id)
        return AuthResponse(
            user_id=user.id,
            email=user.email,
            name=user.name,
            token=token,
        )


@app.post("/api/auth/login", response_model=AuthResponse)
def login(form: OAuth2PasswordRequestForm):
    with sqlmodel.Session(engine) as session:
        user = session.query(User).where(User.email == form.username).first()
        if not user or not passlib.hash.verify_sha256_crypt(form.password, user.password_hash):
            raise HTTPException(status_code=401, detail="Invalid credentials")

        token = create_token(user.id)
        return AuthResponse(
            user_id=user.id,
            email=user.email,
            name=user.name,
            token=token,
        )


@app.get("/api/auth/me", response_model=UserResponse)
def get_me(token: str = oauth2_scheme):
    user = get_current_user(token)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return UserResponse(user_id=user.id, email=user.email, name=user.name)


@app.post("/api/auth/logout")
def logout(token: str = oauth2_scheme):
    return {"message": "Logged out"}


@app.post("/predict")
async def predict(file: UploadFile = File(...), token: str | None = None):
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Please upload a valid image file")

    file_bytes = await file.read()
    max_size = settings.max_upload_size_mb * 1024 * 1024
    if len(file_bytes) > max_size:
        raise HTTPException(
            status_code=413,
            detail=f"Image is too large. Max allowed size is {settings.max_upload_size_mb}MB.",
        )

    if not file_bytes:
        raise HTTPException(status_code=400, detail="Uploaded image is empty.")

    try:
        image = Image.open(BytesIO(file_bytes)).convert("RGB")
        image = image.resize((224, 224))
        arr = np.array(image, dtype=np.float32) / 255.0
        arr = np.expand_dims(arr, axis=0)
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Unable to read image. Please upload a valid image file.") from exc

    user_id = None
    if token:
        user_id = verify_token(token)

    if model is None:
        idx = sum(file_bytes) % len(labels)
        result = {
            "label": labels[idx],
            "confidence": 0.75,
            "details": [{"label": labels[idx], "score": 0.75}],
            "recommendations": treatment_map.get(labels[idx], []),
            "model_ready": False,
        }
    else:
        preds = model.predict(arr, verbose=0)
        probs = np.asarray(preds[0], dtype=np.float32)
        top_idx = int(np.argmax(probs))
        top_label = labels[top_idx] if top_idx < len(labels) else f"Class_{top_idx}"

        result = {
            "label": top_label,
            "confidence": round(float(probs[top_idx]), 4),
            "details": [{"label": top_label, "score": round(float(probs[top_idx]), 4}],
            "recommendations": treatment_map.get(top_label, []),
            "model_ready": True,
        }

    if user_id:
        with sqlmodel.Session(engine) as session:
            pred = Prediction(
                user_id=user_id,
                label=result["label"],
                confidence=result["confidence"],
                details=str(result["details"]),
                recommendations=str(result["recommendations"]),
                image_name=file.filename or "unknown",
            )
            session.add(pred)
            session.commit()

    return result


@app.get("/api/history", response_model=list[PredictionResponse])
def get_history(token: str = oauth2_scheme):
    user = get_current_user(token)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    with sqlmodel.Session(engine) as session:
        preds = (
            session.query(Prediction)
            .where(Prediction.user_id == user.id)
            .order_by(Prediction.created_at.desc())
            .limit(50)
            .all()
        )

        return [
            PredictionResponse(
                id=p.id,
                label=p.label,
                confidence=p.confidence,
                details=eval(p.details),
                recommendations=eval(p.recommendations),
                image_name=p.image_name,
                created_at=p.created_at,
            )
            for p in preds
        ]


@app.delete("/api/history/{pred_id}")
def delete_history(pred_id: int, token: str = oauth2_scheme):
    user = get_current_user(token)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    with sqlmodel.Session(engine) as session:
        pred = session.get(Prediction, pred_id)
        if not pred or pred.user_id != user.id:
            raise HTTPException(status_code=404, detail="Prediction not found")
        session.delete(pred)
        session.commit()

    return {"message": "Deleted"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)