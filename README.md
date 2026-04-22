# GreenGuard: AI Plant Disease Detection Platform

GreenGuard is a full-stack AI project for plant leaf disease classification, designed to be strong enough for a B.Tech major project showcase.

The system combines:

- A TensorFlow-ready FastAPI inference service.
- A modern React frontend with drag/drop upload and rich result reporting.
- A training notebook workflow for model experimentation.

## Project Structure

- `backend/`: FastAPI backend and model inference service.
- `frontend/`: React + Vite UI application.
- `plant-diseases-classification.ipynb`: model training and experimentation notebook.
- `PlantVillage/`: dataset folders used for training.

## Core Features

- Leaf image upload with backend validation.
- Disease prediction with confidence score.
- Top-k class probabilities.
- Actionable recommendations for predicted disease classes.
- Backend health monitoring from frontend.
- Fallback deterministic inference mode if model file is unavailable.

## Technology Stack

- Backend: FastAPI, Pydantic, Pillow, NumPy.
- Model: TensorFlow/Keras (`.h5` model support).
- Frontend: React, Vite, CSS.
- Dataset: PlantVillage (potato classes).

## Run Backend

```bash
cd backend
source /home/tanav/miniconda3/etc/profile.d/conda.sh
conda activate base
pip install -r requirements.txt
# For real TensorFlow inference support
pip install tensorflow-cpu
cp .env.example .env
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Backend endpoints:

- `GET /` project metadata.
- `GET /health` service health.
- `POST /api/v1/predict` multipart image prediction endpoint.
- `GET /docs` interactive API docs.

## Run Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend local URL:

- `http://localhost:5173`

## Configure Real Model

The backend automatically attempts to load a Keras model from `MODEL_PATH`.

1. Export your trained model from notebook:

```python
model.save("plant_diseases.h5")
```

1. Place it in the project root as `plant_diseases.h5` (or set a custom path in `.env`).
1. Set labels in `.env` according to model output order:

```env
MODEL_PATH=../plant_diseases.h5
CLASS_LABELS=Potato___Early_blight,Potato___Late_blight,Potato___healthy
IMAGE_SIZE=224
MAX_UPLOAD_SIZE_MB=8
```

If model loading fails, the API returns deterministic fallback predictions so the app remains demoable.

## Suggested Major-Project Extensions

- Add experiment tracking (TensorBoard or Weights and Biases).
- Add model evaluation dashboard with confusion matrix as API output.
- Add report export (PDF) for each diagnosis.
- Add role-based authentication for agronomists/farmers.
- Deploy with Docker + CI/CD and benchmark latency/accuracy.
