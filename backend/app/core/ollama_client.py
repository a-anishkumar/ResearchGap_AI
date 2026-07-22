"""
Local Ollama API client.
Provides async access to locally hosted LLMs for initial PDF summarization and drafting.
"""
from __future__ import annotations

import httpx
import logging
from app.core.config import settings

logger = logging.getLogger(__name__)


async def generate_ollama(prompt: str, system_instruction: str | None = None) -> str:
    """
    Generate text using local Ollama instance.
    Sends an async POST request to the local Ollama /api/generate endpoint.
    """
    url = f"{settings.ollama_host.rstrip('/')}/api/generate"
    payload = {
        "model": settings.ollama_model,
        "prompt": prompt,
        "stream": False,
        "options": {
            "temperature": 0.2
        }
    }
    if system_instruction:
        payload["system"] = system_instruction

    try:
        async with httpx.AsyncClient(timeout=90.0) as client:
            response = await client.post(url, json=payload)
            if response.status_code == 404:
                # Often means the model is not pulled/loaded
                try:
                    err_msg = response.json().get("error", "")
                except Exception:
                    err_msg = response.text
                raise RuntimeError(
                    f"Ollama model '{settings.ollama_model}' not found or endpoint not found. "
                    f"Please run 'ollama pull {settings.ollama_model}' in your terminal. Error: {err_msg}"
                )
            
            response.raise_for_status()
            res_data = response.json()
            output = res_data.get("response", "").strip()
            if not output:
                raise ValueError("Ollama returned an empty response")
            return output
            
    except httpx.ConnectError as ce:
        logger.error(f"Cannot connect to local Ollama service at {url}: {ce}")
        raise RuntimeError(
            f"Ollama service is not running at {settings.ollama_host}. "
            "Please ensure Ollama is installed and running."
        ) from ce
    except Exception as e:
        logger.error(f"Error communicating with local Ollama: {e}")
        raise
