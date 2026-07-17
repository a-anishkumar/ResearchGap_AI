"""
Google Gemini LLM client — drop-in replacement for the Anthropic client.
Exposes the same `complete(system, user, max_tokens)` interface so all
callers (llm_extractor, gaps router) require zero changes.
"""
from __future__ import annotations

import logging
from google import genai
from google.genai import types
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type
from app.core.config import settings

logger = logging.getLogger(__name__)

_client: genai.Client | None = None


def get_client() -> genai.Client:
    global _client
    if _client is None:
        if not settings.gemini_api_key:
            raise RuntimeError(
                "GEMINI_API_KEY is not set. Add it to backend/.env"
            )
        _client = genai.Client(api_key=settings.gemini_api_key)
    return _client


@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=2, max=10),
    reraise=True,
)
async def complete(system: str, user: str, max_tokens: int = 2048) -> str:
    """
    Generate a response from Gemini.
    Compatible with the old Anthropic `complete()` signature.
    """
    client = get_client()

    response = client.models.generate_content(
        model=settings.llm_model,
        contents=user,
        config=types.GenerateContentConfig(
            system_instruction=system,
            max_output_tokens=max_tokens,
            temperature=0.2,
        ),
    )

    text = response.text
    if not text:
        raise ValueError("Gemini returned an empty response")

    logger.debug(f"Gemini response ({len(text)} chars): {text[:80]}…")
    return text
