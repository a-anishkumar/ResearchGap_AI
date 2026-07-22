from pydantic_settings import BaseSettings, SettingsConfigDict
from pathlib import Path


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(Path(__file__).resolve().parents[2] / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Gemini
    gemini_api_key: str = ""

    # Neo4j
    neo4j_uri: str = "neo4j+s://your-aura-instance.databases.neo4j.io"
    neo4j_user: str = "neo4j"
    neo4j_password: str = "password123"

    # Vector store
    vector_db_path: str = "./data/chroma"

    # App
    data_raw_path: str = "./data/raw"
    max_upload_mb: int = 50
    llm_model: str = "gemini-2.0-flash"
    embedding_model: str = "all-MiniLM-L6-v2"
    top_gaps: int = 20
    rag_top_k: int = 5

    # Ollama
    use_ollama: bool = False
    ollama_host: str = "http://localhost:11434"
    ollama_model: str = "llama3.2"


settings = Settings()
