"""
Local Ollama API client.
Provides async access to locally hosted LLMs for initial PDF summarization and drafting.
"""
from __future__ import annotations

import json
from typing import AsyncGenerator
import httpx
import logging
from app.core.config import settings

logger = logging.getLogger(__name__)


async def generate_ollama(
    prompt: str,
    system_instruction: str | None = None,
    json_mode: bool = False
) -> str:
    """
    Generate text using local Ollama instance.
    Supports native JSON mode ('format': 'json') and optimized decoding options.
    """
    url = f"{settings.ollama_host.rstrip('/')}/api/generate"
    payload = {
        "model": settings.ollama_model,
        "prompt": prompt,
        "stream": False,
        "options": {
            "temperature": 0.1 if json_mode else 0.2,
            "num_ctx": 8192,
            "repeat_penalty": 1.1,
            "top_p": 0.9,
        }
    }
    if json_mode:
        payload["format"] = "json"

    if system_instruction:
        payload["system"] = system_instruction

    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(url, json=payload)
            if response.status_code == 404:
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


async def stream_ollama(
    prompt: str,
    system_instruction: str | None = None
) -> AsyncGenerator[str, None]:
    """
    Stream tokens in real-time from local Ollama instance using async chunked HTTP streaming.
    Yields text token strings.
    """
    url = f"{settings.ollama_host.rstrip('/')}/api/generate"
    payload = {
        "model": settings.ollama_model,
        "prompt": prompt,
        "stream": True,
        "options": {
            "temperature": 0.2,
            "num_ctx": 8192,
        }
    }
    if system_instruction:
        payload["system"] = system_instruction

    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            async with client.stream("POST", url, json=payload) as response:
                response.raise_for_status()
                async for line in response.aiter_lines():
                    if line:
                        try:
                            data = json.loads(line)
                            token = data.get("response", "")
                            if token:
                                yield token
                            if data.get("done", False):
                                break
                        except Exception:
                            continue
    except Exception as e:
        logger.error(f"Error streaming from Ollama: {e}")
        raise
