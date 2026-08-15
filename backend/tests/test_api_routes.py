"""
Integration tests for FastAPI API endpoints.
"""
import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_root_endpoint():
    response = client.get("/")
    assert response.status_code == 200
    assert response.json()["status"] == "running"


def test_health_endpoint():
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert "status" in data
    assert "neo4j" in data
    assert "chromadb_docs" in data


def test_projects_endpoint():
    response = client.get("/api/projects")
    assert response.status_code == 200
    assert isinstance(response.json(), list)


def test_analytics_coverage_endpoint():
    response = client.get("/api/analytics/coverage")
    assert response.status_code == 200
    data = response.json()
    assert "domain_entropy" in data
    assert "corpus_health_score" in data


def test_analytics_cost_endpoint():
    response = client.get("/api/analytics/cost")
    assert response.status_code == 200
    data = response.json()
    assert "total_tokens" in data


def test_curate_candidates_endpoint():
    response = client.get("/api/curate/candidates")
    assert response.status_code == 200
    data = response.json()
    assert "candidates" in data


def test_curate_merge_validation_endpoint():
    response = client.post("/api/curate/merge", json={"target_name": "BERT", "source_name": "BERT", "entity_type": "Method"})
    assert response.status_code == 400
