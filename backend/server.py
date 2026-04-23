import ast
import json
from datetime import datetime, timedelta
from io import BytesIO
from pathlib import Path

import numpy as np
import jwt
import passlib.hash
import sqlmodel
from fastapi import Depends, FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel
from pydantic_settings import BaseSettings
from PIL import Image


class Settings(BaseSettings):
    app_name: str = "GreenGuard API"
    app_version: str = "0.1.0"
    frontend_origin: str = "http://localhost:5173"

    class_labels: str = (
        "Pepper__bell___Bacterial_spot,"
        "Pepper__bell___healthy,"
        "Potato___Early_blight,"
        "Potato___Late_blight,"
        "Potato___healthy,"
        "Tomato_Bacterial_spot,"
        "Tomato_Early_blight,"
        "Tomato_Late_blight,"
        "Tomato_Leaf_Mold,"
        "Tomato_Septoria_leaf_spot,"
        "Tomato_Spider_mites_Two_spotted_spider_mite,"
        "Tomato__Target_Spot,"
        "Tomato__Tomato_YellowLeaf__Curl_Virus,"
        "Tomato__Tomato_mosaic_virus,"
        "Tomato_healthy"
    )
    image_size: int = 256
    max_upload_size_mb: int = 8
    jwt_secret: str = "your-super-secret-key-change-in-production"
    jwt_algorithm: str = "HS256"
    jwt_expiry_hours: int = 24
    model_path: str = "../lstm_all_class.h5"


settings = Settings()


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
            warmup = np.zeros(
                (1, settings.image_size, settings.image_size, 3), dtype=np.float32
            )
            _ = model.predict(warmup, verbose=0)
            return model
    except Exception:
        pass
    return None


model = None
model_load_attempted = False
labels = [label.strip() for label in settings.class_labels.split(",") if label.strip()]


def split_label_parts(label: str) -> tuple[str, str]:
    normalized = label.replace("___", "|").replace("__", "|").replace("_", " ")
    parts = [part.strip() for part in normalized.split("|") if part.strip()]
    if len(parts) == 1:
        return parts[0], parts[0]
    return parts[0], " - ".join(parts[1:])


def build_recommendations(label: str) -> list[str]:
    plant, disease = split_label_parts(label)
    disease_lower = disease.lower()

    if "healthy" in disease_lower:
        return [
            f"{plant}: crop looks healthy. Continue regular monitoring.",
            "Keep irrigation balanced and avoid long periods of wet foliage.",
            "Maintain field sanitation and rotate crops between seasons.",
        ]

    recs = [
        f"Isolate affected {plant.lower()} leaves or plants to reduce spread.",
        "Clean tools and avoid handling healthy plants after infected ones.",
    ]

    if "virus" in disease_lower:
        recs.append(
            "Control insect vectors such as whiteflies and remove infected plants early."
        )
    elif "bacterial" in disease_lower:
        recs.append(
            "Reduce leaf wetness, improve airflow, and use copper-based sprays where appropriate."
        )
    elif "mite" in disease_lower:
        recs.append(
            "Inspect leaf undersides and use an appropriate miticide or biological control."
        )
    else:
        recs.append(
            "Use a crop-appropriate fungicide program and avoid overhead irrigation."
        )

    return recs


def parse_stored_json_list(raw: str):
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return ast.literal_eval(raw)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description="Plant disease prediction API with user authentication.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
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
        payload = jwt.decode(
            token, settings.jwt_secret, algorithms=[settings.jwt_algorithm]
        )
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
            password_hash=passlib.hash.sha256_crypt.hash(req.password),
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
def login(body: RegisterRequest):
    with sqlmodel.Session(engine) as session:
        user = session.query(User).where(User.email == body.email).first()
        if not user or not passlib.hash.sha256_crypt.verify(
            body.password, user.password_hash
        ):
            raise HTTPException(status_code=401, detail="Invalid credentials")

        token = create_token(user.id)
        return AuthResponse(
            user_id=user.id,
            email=user.email,
            name=user.name,
            token=token,
        )


@app.get("/api/auth/me", response_model=UserResponse)
def get_me(token: str = Depends(oauth2_scheme)):
    user = get_current_user(token)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return UserResponse(user_id=user.id, email=user.email, name=user.name)


@app.post("/api/auth/logout")
def logout(token: str = Depends(oauth2_scheme)):
    return {"message": "Logged out"}


def process_image(file_bytes: bytes) -> np.ndarray:
    if not file_bytes:
        raise HTTPException(status_code=400, detail="Uploaded image is empty.")

    max_size = settings.max_upload_size_mb * 1024 * 1024
    if len(file_bytes) > max_size:
        raise HTTPException(
            status_code=413,
            detail=f"Image is too large. Max allowed size is {settings.max_upload_size_mb}MB.",
        )

    try:
        image = Image.open(BytesIO(file_bytes)).convert("RGB")
        image = image.resize((settings.image_size, settings.image_size))
        # The LSTM model was trained on images normalized to [0, 1].
        arr = np.array(image, dtype=np.float32) / 255.0
        arr = np.expand_dims(arr, axis=0)
    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail="Unable to read image. Please upload a valid image file.",
        ) from exc
    return arr


def get_prediction(arr: np.ndarray) -> dict:
    global model, model_load_attempted

    if model is None and not model_load_attempted:
        model = load_model()
        model_load_attempted = True

    if model is None:
        raise HTTPException(status_code=503, detail="Model is not available.")

    preds = model.predict(arr, verbose=0)
    probs = np.asarray(preds[0], dtype=np.float32)
    top_idx = int(np.argmax(probs))
    top_label = labels[top_idx] if top_idx < len(labels) else f"Class_{top_idx}"
    ranked_indices = np.argsort(probs)[::-1]
    details = [
        {
            "label": labels[idx] if idx < len(labels) else f"Class_{int(idx)}",
            "score": round(float(probs[idx]), 4),
        }
        for idx in ranked_indices
    ]

    return {
        "label": top_label,
        "confidence": round(float(probs[top_idx]), 4),
        "details": details,
        "recommendations": build_recommendations(top_label),
        "model_ready": True,
        "image_index": 0,
    }


@app.post("/predict")
async def predict(files: list[UploadFile] = File(...), token: str | None = None):
    if not files:
        raise HTTPException(status_code=400, detail="Please upload at least one image")

    for file in files:
        if not file.content_type or not file.content_type.startswith("image/"):
            raise HTTPException(
                status_code=400, detail=f"Invalid file type for {file.filename}"
            )

    results = []
    user_id = verify_token(token) if token else None

    for idx, file in enumerate(files):
        file_bytes = await file.read()
        arr = process_image(file_bytes)
        result = get_prediction(arr)
        result["image_index"] = idx
        results.append(result)

    if user_id:
        with sqlmodel.Session(engine) as session:
            for result in results:
                pred = Prediction(
                    user_id=user_id,
                    label=result["label"],
                    confidence=result["confidence"],
                    details=json.dumps(result["details"]),
                    recommendations=json.dumps(result["recommendations"]),
                    image_name=files[result["image_index"]].filename or "unknown",
                )
                session.add(pred)
            session.commit()

    return results


@app.get("/api/history", response_model=list[PredictionResponse])
def get_history(token: str = Depends(oauth2_scheme)):
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
                details=parse_stored_json_list(p.details),
                recommendations=parse_stored_json_list(p.recommendations),
                image_name=p.image_name,
                created_at=p.created_at,
            )
            for p in preds
        ]


@app.delete("/api/history/{pred_id}")
def delete_history(pred_id: int, token: str = Depends(oauth2_scheme)):
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
