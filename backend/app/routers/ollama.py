"""
Ollama router — Status monitoring, local model management, model pull, and LLM provider configuration.
"""
from __future__ import annotations

import logging
from typing import Optional
from fastapi import APIRouter, HTTPException, Query, BackgroundTasks
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.core.config import settings
from app.core import ollama_client

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/ollama", tags=["ollama"])


class OllamaConfigUpdate(BaseModel):
    use_ollama: Optional[bool] = None
    ollama_host: Optional[str] = None
    ollama_model: Optional[str] = None


class ModelPullRequest(BaseModel):
    name: str


@router.get("/status")
async def get_ollama_status():
    """Check local Ollama server connectivity, version, active model, and model count."""
    health = await ollama_client.check_ollama_health()
    return {
        "enabled": settings.use_ollama,
        "active_model": settings.ollama_model,
        "ollama_host": settings.ollama_host,
        "health": health,
    }


@router.get("/models")
async def get_ollama_models():
    """List all models installed locally in the Ollama instance."""
    models = await ollama_client.list_local_models()
    return {
        "active_model": settings.ollama_model,
        "count": len(models),
        "models": models,
    }


@router.post("/config")
async def update_ollama_config(config: OllamaConfigUpdate):
    """
    Update active LLM provider strategy or default Ollama model dynamically at runtime.
    """
    if config.use_ollama is not None:
        settings.use_ollama = config.use_ollama
    if config.ollama_host is not None:
        settings.ollama_host = config.ollama_host
    if config.ollama_model is not None:
        settings.ollama_model = config.ollama_model

    logger.info(f"Updated Ollama settings: use_ollama={settings.use_ollama}, model={settings.ollama_model}, host={settings.ollama_host}")
    return {
        "status": "ok",
        "use_ollama": settings.use_ollama,
        "ollama_host": settings.ollama_host,
        "ollama_model": settings.ollama_model,
    }


@router.post("/pull")
async def pull_model_endpoint(req: ModelPullRequest):
    """
    Stream model pull progress logs as SSE stream.
    """
    if not req.name:
        raise HTTPException(status_code=400, detail="Model name is required")

    async def event_generator():
        async for progress in ollama_client.pull_local_model(req.name):
            import json
            yield f"data: {json.dumps(progress)}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")
