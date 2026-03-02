from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Server
    port: int = 8000
    debug: bool = False

    # Database
    database_host: str = "postgres"
    database_port: int = 5432
    database_user: str = "postgres"
    database_password: str = "postgres"
    database_name: str = "onai_ocr"

    # Google AI (Gemini)
    google_ai_api_key: str
    gemini_model: str = "gemini-2.5-flash"

    # Google Drive OAuth
    google_client_id: str = ""
    google_client_secret: str = ""
    google_redirect_uri: str = "http://localhost:4000/api/google/callback"
    google_drive_root_folder_id: str = ""

    # Rate Limiting
    gemini_rpm_limit: int = 10  # requests per minute (free tier)
    gemini_delay_between_calls: float = 6.5  # seconds between calls (safe for 10 RPM)
    max_retries: int = 3
    retry_base_delay: float = 35.0  # base delay for 429 retry (Gemini suggests ~35s)

    # Processing Limits
    max_batch_documents: int = 10
    max_parallel_classifications: int = 3  # parallel LLM calls during classification
    max_parallel_extractions: int = 2  # parallel LLM calls during extraction
    max_file_size_mb: int = 10

    # Classification
    classification_confidence_threshold: float = 0.7

    # Folders
    others_folder_name: str = "Otros Documentos"
    others_folder_description: str = (
        "Documentos sin clasificacion automatica. "
        "La IA identifica automaticamente el tipo y los campos clave de cada documento."
    )

    @property
    def database_url(self) -> str:
        return (
            f"postgresql+asyncpg://{self.database_user}:{self.database_password}"
            f"@{self.database_host}:{self.database_port}/{self.database_name}"
        )

    @property
    def database_url_sync(self) -> str:
        return (
            f"postgresql+psycopg2://{self.database_user}:{self.database_password}"
            f"@{self.database_host}:{self.database_port}/{self.database_name}"
        )

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
