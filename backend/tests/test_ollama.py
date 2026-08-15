"""
Unit tests for Ollama management router and status endpoints.
"""
import sys
from pathlib import Path
from fastapi.testclient import TestClient

backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

from app.main import app

client = TestClient(app)


def test_ollama_status_endpoint():
    res = client.get("/api/ollama/status")
    assert res.status_code == 200
    data = res.json()
    assert "enabled" in data
    assert "active_model" in data
    assert "health" in data


def test_ollama_models_endpoint():
    res = client.get("/api/ollama/models")
    assert res.status_code == 200
    data = res.json()
    assert "active_model" in data
    assert "models" in data


def test_ollama_config_update():
    res = client.post("/api/ollama/config", json={
        "use_ollama": True,
        "ollama_model": "llama3.2"
    })
    assert res.status_code == 200
    data = res.json()
    assert data["use_ollama"] is True
    assert data["ollama_model"] == "llama3.2"
