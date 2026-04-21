from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes.predict import router as predict_router
from app.core.config import settings

app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description=(
        "Plant disease prediction API for GreenGuard. Upload a leaf image to "
        "receive disease classification and actionable recommendations."
    ),
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", tags=["health"])
def healthcheck() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/", tags=["meta"])
def root() -> dict[str, str]:
    return {
        "name": settings.app_name,
        "version": settings.app_version,
        "docs": "/docs",
    }


app.include_router(predict_router, prefix="/api/v1")
