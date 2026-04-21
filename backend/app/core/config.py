from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "GreenGuard API"
    app_version: str = "0.1.0"
    frontend_origin: str = "http://localhost:5173"
    model_path: str = "./plant_diseases.h5"
    class_labels: str = "Potato___Early_blight,Potato___healthy,Potato___Late_blight"
    image_size: int = 224
    max_upload_size_mb: int = 8

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")


settings = Settings()
