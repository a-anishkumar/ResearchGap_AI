"""
Local Ollama API client.
Provides async access to locally hosted LLMs for PDF summarization, extraction, gap analysis, and interactive proposal generation.
Includes persistent HTTP connection pooling, model management, streaming, and health monitoring.
"""
from __future__ import annotations

import json
import logging
from typing import AsyncGenerator, Any, Dict, List, Optional
import httpx
from app.core.config import settings

logger = logging.getLogger(__name__)

# Managed httpx AsyncClient singleton with connection pooling
_client_instance: Optional[httpx.AsyncClient] = None


def get_httpx_client() -> httpx.AsyncClient:
    """Return singleton httpx.AsyncClient instance with connection pooling and timeouts."""
    global _client_instance
    if _client_instance is None or _client_instance.is_closed:
        _client_instance = httpx.AsyncClient(
            timeout=httpx.Timeout(120.0, connect=10.0),
            limits=httpx.Limits(max_keepalive_connections=20, max_connections=50),
        )
    return _client_instance


async def close_httpx_client():
    """Close singleton httpx client on shutdown."""
    global _client_instance
    if _client_instance is not None and not _client_instance.is_closed:
        await _client_instance.aclose()
        _client_instance = None


async def check_ollama_health() -> Dict[str, Any]:
    """
    Check connection status to local Ollama server and fetch server version/info.
    Returns dict: {"status": "ok"|"unavailable", "host": ..., "version": ..., "models_count": ...}
    """
    client = get_httpx_client()
    base_url = settings.ollama_host.rstrip('/')
    try:
        res = await client.get(f"{base_url}/api/version")
        version_data = res.json() if res.status_code == 200 else {}
        version = version_data.get("version", "unknown")

        models = await list_local_models()
        return {
            "status": "ok",
            "host": settings.ollama_host,
            "version": version,
            "active_model": settings.ollama_model,
            "models_count": len(models),
            "models": [m.get("name") for m in models],
        }
    except Exception as e:
        logger.debug(f"Ollama health check failed: {e}")
        return {
            "status": "unavailable",
            "host": settings.ollama_host,
            "error": str(e),
            "active_model": settings.ollama_model,
            "models_count": 0,
            "models": [],
        }


async def list_local_models() -> List[Dict[str, Any]]:
    """Fetch list of models available in local Ollama instance (`/api/tags`)."""
    client = get_httpx_client()
    url = f"{settings.ollama_host.rstrip('/')}/api/tags"
    try:
        res = await client.get(url)
        res.raise_for_status()
        data = res.json()
        return data.get("models", [])
    except Exception as e:
        logger.warning(f"Could not list Ollama models: {e}")
        return []


async def pull_local_model(model_name: str) -> AsyncGenerator[Dict[str, Any], None]:
    """
    Trigger download/pull of a model from Ollama library.
    Yields progress dicts: {"status": ..., "completed": ..., "total": ...}
    """
    client = get_httpx_client()
    url = f"{settings.ollama_host.rstrip('/')}/api/pull"
    payload = {"name": model_name, "stream": True}

    try:
        async with client.stream("POST", url, json=payload, timeout=600.0) as response:
            response.raise_for_status()
            async for line in response.aiter_lines():
                if line:
                    try:
                        yield json.loads(line)
                    except Exception:
                        continue
    except Exception as e:
        logger.error(f"Error pulling model '{model_name}': {e}")
        yield {"status": "error", "error": str(e)}


async def generate_ollama(
    prompt: str,
    system_instruction: str | None = None,
    json_mode: bool = False,
    model_name: str | None = None,
    temperature: float | None = None,
) -> str:
    """
    Generate text using local Ollama instance.
    Supports dynamic model selection, native JSON mode ('format': 'json'), and custom temperature.
    """
    client = get_httpx_client()
    target_model = model_name or settings.ollama_model
    url = f"{settings.ollama_host.rstrip('/')}/api/generate"

    temp = temperature if temperature is not None else (0.1 if json_mode else 0.2)
    payload = {
        "model": target_model,
        "prompt": prompt,
        "stream": False,
        "options": {
            "temperature": temp,
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
        response = await client.post(url, json=payload)
        if response.status_code == 404:
            try:
                err_msg = response.json().get("error", "")
            except Exception:
                err_msg = response.text
            raise RuntimeError(
                f"Ollama model '{target_model}' not found. "
                f"Please run 'ollama pull {target_model}' or use the Ollama Control Center in ResearchGap AI. Error: {err_msg}"
            )

        response.raise_for_status()
        res_data = response.json()
        output = res_data.get("response", "").strip()
        if not output:
            raise ValueError(f"Ollama ({target_model}) returned an empty response")
        return output

    except httpx.ConnectError as ce:
        logger.error(f"Cannot connect to local Ollama service at {url}: {ce}")
        raise RuntimeError(
            f"Ollama service is not running at {settings.ollama_host}. "
            "Please ensure Ollama is running locally."
        ) from ce
    except Exception as e:
        logger.error(f"Error communicating with local Ollama model '{target_model}': {e}")
        raise


async def stream_ollama(
    prompt: str,
    system_instruction: str | None = None,
    model_name: str | None = None,
) -> AsyncGenerator[str, None]:
    """
    Stream tokens in real-time from local Ollama instance using chunked HTTP streaming.
    Yields token strings.
    """
    client = get_httpx_client()
    target_model = model_name or settings.ollama_model
    url = f"{settings.ollama_host.rstrip('/')}/api/generate"
    payload = {
        "model": target_model,
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
        logger.error(f"Error streaming from Ollama ({target_model}): {e}")
        raise

