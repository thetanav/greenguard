# GreenGuard Full-Stack Starter

This workspace now includes:

- `backend/`: FastAPI app with prediction endpoint
- `frontend/`: React + Vite client for image upload and results
- `plant-diseases-classification.ipynb`: your existing notebook

## 1) Run Backend (FastAPI)

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Backend URLs:

- Health: `http://localhost:8000/health`
- API docs: `http://localhost:8000/docs`
- Predict: `POST http://localhost:8000/api/v1/predict` with form-data field `file`

## 2) Run Frontend (React)

Open a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Frontend URL:

- `http://localhost:5173`

## 3) How to connect your trained model

Current backend uses a deterministic placeholder in `backend/app/services/model_service.py`.

Replace `ModelService.predict()` with your real inference logic:

1. Load your trained model (e.g., Torch/TensorFlow/sklearn)
2. Preprocess uploaded image bytes
3. Return output matching:

```python
{
  "label": "Tomato___Late_blight",
  "confidence": 0.93,
  "details": [
    {"label": "Tomato___Late_blight", "score": 0.93},
    {"label": "Tomato___Leaf_Mold", "score": 0.05}
  ]
}
```

## 4) Suggested next improvements

- Add model loading on startup (`lifespan` in FastAPI)
- Add request logging and error handling middleware
- Add tests with `pytest` for backend route and service
- Add drag-and-drop uploader and history in frontend
