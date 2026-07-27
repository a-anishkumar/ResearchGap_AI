"""
Output Reliability Layer and Unified Hybrid LLM Client.
Provides cross-provider routing (Claude -> Gemini -> Ollama), schema validation with repair retries,
call logging, RAG grounding checks, and streaming capabilities.
"""
from __future__ import annotations

import json
import logging
import re
import sqlite3
import datetime
import asyncio
from typing import TypeVar, Type, Any, AsyncGenerator, Optional
from pydantic import BaseModel, ValidationError

from app.core.config import settings
from app.core import claude_client, ollama_client
from app.core.project import get_sqlite_db_path
from app.models.schemas import CitationFlag

logger = logging.getLogger(__name__)

T = TypeVar("T", bound=BaseModel)


# ── In-memory extraction stats ────────────────────────────────────────────────

_extraction_stats: dict[str, int] = {
    "total": 0,
    "pass_first_attempt": 0,
    "repaired": 0,
    "failed": 0,
}


def get_extraction_stats() -> dict:
    """Return a copy of the in-memory extraction stats."""
    return dict(_extraction_stats)


# ── Database Logging ─────────────────────────────────────────────────────────

def _init_log_db(conn: sqlite3.Connection):
    """Ensure llm_call_log table exists."""
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS llm_call_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            provider TEXT,
            endpoint TEXT,
            retry_count INTEGER,
            success INTEGER,
            error_message TEXT,
            timestamp TEXT
        )
    """)
    conn.commit()


def log_llm_call(provider: str, endpoint: str, retry_count: int, success: bool, error_message: str = ""):
    """Log LLM call attempt, provider, retry status, and success/failure."""
    try:
        db_path = get_sqlite_db_path()
        db_path.parent.mkdir(parents=True, exist_ok=True)
        conn = sqlite3.connect(db_path, timeout=10.0)
        _init_log_db(conn)
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO llm_call_log (provider, endpoint, retry_count, success, error_message, timestamp)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (
            provider,
            endpoint,
            retry_count,
            1 if success else 0,
            error_message,
            datetime.datetime.utcnow().isoformat()
        ))
        conn.commit()
        conn.close()
    except Exception as e:
        logger.warning(f"Failed logging LLM call to DB: {e}")


# ── Normalization Helper ─────────────────────────────────────────────────────

def _normalize_json_text(text: str) -> str:
    """
    Strip markdown code fences, normalize whitespace, and sanitize near-miss JSON formatting.
    """
    if not text:
        return "{}"

    text = text.strip()

    # Remove markdown code blocks (e.g. ```json ... ``` or ``` ...)
    pattern = r"```(?:json)?\s*([\s\S]*?)\s*```"
    match = re.search(pattern, text, re.IGNORECASE)
    if match:
        text = match.group(1).strip()

    # If still starts with ```
    if text.startswith("```"):
        text = re.sub(r"^```[a-zA-Z]*\n?", "", text)
    if text.endswith("```"):
        text = text[:-3].strip()

    # Extract JSON object or array if surrounded by conversational filler
    first_brace = text.find("{")
    first_bracket = text.find("[")

    if first_brace != -1 and (first_bracket == -1 or first_brace < first_bracket):
        last_brace = text.rfind("}")
        if last_brace > first_brace:
            text = text[first_brace:last_brace + 1]
    elif first_bracket != -1:
        last_bracket = text.rfind("]")
        if last_bracket > first_bracket:
            text = text[first_bracket:last_bracket + 1]

    # Fix trailing commas before closing braces/brackets
    text = re.sub(r",\s*([}\]])", r"\1", text)

    return text.strip()


# ── RAG Grounding / Hallucination Check ──────────────────────────────────────

def run_grounding_check(generated_text: str, rag_chunks: list[str]) -> list[CitationFlag]:
    """
    Extract factual sentences from generated text and check against RAG context chunks.
    Flags claims that cannot be traced to any context chunk.
    """
    if not generated_text or not rag_chunks:
        return []

    combined_context = " ".join(rag_chunks).lower()
    flags = []

    # Split text into sentences
    sentences = [s.strip() for s in re.split(r'(?<=[.!?])\s+', generated_text) if len(s.strip()) > 20]

    for stmt in sentences[:15]:
        # Focus on empirical/factual assertions
        if any(char.isdigit() for char in stmt) or any(w in stmt.lower() for w in ["achieves", "outperforms", "dataset", "accuracy", "bleu", "f1", "proposed", "proposes"]):
            words = [w.lower() for w in re.findall(r'\b\w{4,}\b', stmt)]
            if not words:
                continue

            matches = sum(1 for w in words if w in combined_context)
            match_ratio = matches / len(words)

            if match_ratio < 0.25:
                flags.append(CitationFlag(
                    sentence=stmt[:120] + ("..." if len(stmt) > 120 else ""),
                    reason="Claim contains empirical metrics or assertions not found in uploaded context chunks.",
                    suggested_citation_or_softening=f"Consider framing as a hypothesis or adding explicit paper citation: '{stmt[:60]}...'"
                ))

    return flags[:5]


# ── Core Provider Invocation ────────────────────────────────────────────────

async def _call_provider(
    provider: str,
    prompt: str,
    system_instruction: str | None = None,
    json_mode: bool = False
) -> str:
    """Execute raw prompt on specified provider."""
    if provider == "gemini":
        return await claude_client.complete(system=system_instruction or "You are a helpful AI research assistant.", user=prompt)
    elif provider == "ollama":
        return await ollama_client.generate_ollama(
            prompt=prompt,
            system_instruction=system_instruction,
            json_mode=json_mode
        )
    else:
        raise ValueError(f"Unknown provider: {provider}")


def _get_provider_chain() -> list[str]:
    """
    Return ordered list of available providers.
    If USE_OLLAMA=true is set in config/.env, Ollama is prioritized first.
    """
    chain = []
    if settings.use_ollama:
        chain.append("ollama")
        if settings.gemini_api_key:
            chain.append("gemini")
    else:
        if settings.gemini_api_key:
            chain.append("gemini")
        chain.append("ollama")
    return chain


def _clean_schema_for_gemini(schema: Any) -> Any:
    """Recursively strip unsupported keys like additionalProperties and $schema for Gemini Developer API."""
    if isinstance(schema, dict):
        cleaned = {}
        for k, v in schema.items():
            if k in ("additionalProperties", "$schema"):
                continue
            cleaned[k] = _clean_schema_for_gemini(v)
        return cleaned
    elif isinstance(schema, list):
        return [_clean_schema_for_gemini(item) for item in schema]
    return schema


# ── Universal Structured Generator with Validation & Repair ─────────────

async def generate_structured(
    prompt: str,
    schema_cls: Type[T],
    system_instruction: str | None = None,
    endpoint: str = "general",
    rag_chunks: list[str] | None = None
) -> T:
    """
    Generate structured output validated against a Pydantic schema class.
    Executes 1-pass targeted repair on validation failure, then fails over to next provider if needed.
    """
    providers = _get_provider_chain()
    last_error = None

    # Build a JSON schema dict from the Pydantic model for Gemini native mode
    try:
        raw_schema = schema_cls.model_json_schema()
        schema_dict = _clean_schema_for_gemini(raw_schema)
    except Exception:
        schema_dict = None

    _extraction_stats["total"] += 1

    for provider in providers:
        retry_count = 0
        raw_text = ""
        try:
            # ── Gemini: use native JSON schema mode ──────────────────────────
            if provider == "gemini" and schema_dict is not None:
                try:
                    raw_text = await claude_client.complete_structured(
                        system=system_instruction or "You are a helpful AI research assistant.",
                        user=prompt,
                        response_schema=schema_dict,
                    )
                    cleaned_text = _normalize_json_text(raw_text)
                    parsed_obj = schema_cls.model_validate_json(cleaned_text)
                    log_llm_call(provider, endpoint, retry_count=0, success=True)
                    _extraction_stats["pass_first_attempt"] += 1

                    if rag_chunks and hasattr(parsed_obj, "citation_flags"):
                        grounding_flags = run_grounding_check(raw_text, rag_chunks)
                        if grounding_flags:
                            current_flags = getattr(parsed_obj, "citation_flags", []) or []
                            setattr(parsed_obj, "citation_flags", current_flags + grounding_flags)

                    return parsed_obj
                except Exception as schema_err:
                    logger.warning(
                        f"Gemini schema mode failed for {schema_cls.__name__}: {schema_err}. "
                        "Falling back to text-parse path."
                    )
                    # Fall through to the generic text-parse path below
                    raw_text = await _call_provider(provider, prompt, system_instruction, json_mode=True)
            else:
                # ── Ollama / other: plain text parse path ────────────────────
                raw_text = await _call_provider(provider, prompt, system_instruction, json_mode=True)

            cleaned_text = _normalize_json_text(raw_text)

            try:
                parsed_obj = schema_cls.model_validate_json(cleaned_text)
                log_llm_call(provider, endpoint, retry_count=0, success=True)
                _extraction_stats["pass_first_attempt"] += 1

                if rag_chunks and hasattr(parsed_obj, "citation_flags"):
                    grounding_flags = run_grounding_check(raw_text, rag_chunks)
                    if grounding_flags:
                        current_flags = getattr(parsed_obj, "citation_flags", []) or []
                        setattr(parsed_obj, "citation_flags", current_flags + grounding_flags)

                return parsed_obj
            except (ValidationError, json.JSONDecodeError) as val_err:
                logger.warning(f"Provider '{provider}' output failed validation for {schema_cls.__name__}: {val_err}. Triggering 1-pass repair...")
                retry_count = 1

                # 2. Targeted Repair Attempt
                repair_prompt = (
                    f"Your previous response failed JSON validation for schema {schema_cls.__name__}.\n"
                    f"Validation Error: {val_err}\n\n"
                    f"Original invalid response:\n{raw_text}\n\n"
                    f"Instructions: Fix ONLY the invalid or missing JSON fields. Return ONLY valid JSON matching the schema."
                )

                repair_text = await _call_provider(provider, repair_prompt, system_instruction, json_mode=True)
                cleaned_repair = _normalize_json_text(repair_text)
                parsed_obj = schema_cls.model_validate_json(cleaned_repair)

                log_llm_call(provider, endpoint, retry_count=1, success=True)
                _extraction_stats["repaired"] += 1
                logger.info(f"Provider '{provider}' repair pass SUCCEEDED for {schema_cls.__name__}.")

                if rag_chunks and hasattr(parsed_obj, "citation_flags"):
                    grounding_flags = run_grounding_check(repair_text, rag_chunks)
                    if grounding_flags:
                        current_flags = getattr(parsed_obj, "citation_flags", []) or []
                        setattr(parsed_obj, "citation_flags", current_flags + grounding_flags)

                return parsed_obj

        except Exception as e:
            err_msg = str(e)
            logger.error(f"Provider '{provider}' failed structured generation for endpoint '{endpoint}': {err_msg}")
            log_llm_call(provider, endpoint, retry_count=retry_count, success=False, error_message=err_msg)
            last_error = e

    _extraction_stats["failed"] += 1
    raise RuntimeError(f"All LLM providers ({providers}) failed structured generation for {schema_cls.__name__}. Last error: {last_error}")


# ── Real-Time Token / SSE Streaming Generator ──────────────────────────────

async def stream_generate(prompt: str, system_instruction: str | None = None) -> AsyncGenerator[str, None]:
    """
    Stream tokens from available LLM provider for FastAPI StreamingResponse.
    Yields JSON SSE events: data: {"token": "..."}\n\n
    """
    providers = _get_provider_chain()
    primary = providers[0] if providers else "gemini"

    try:
        if primary == "ollama":
            async for token in ollama_client.stream_ollama(prompt, system_instruction):
                yield f"data: {json.dumps({'token': token})}\n\n"
            yield "data: [DONE]\n\n"
        else:
            # Fallback stream wrapper for Gemini
            full_response = await _call_provider(primary, prompt, system_instruction)
            words = full_response.split(" ")
            for i in range(0, len(words), 3):
                chunk = " ".join(words[i:i+3]) + " "
                yield f"data: {json.dumps({'token': chunk})}\n\n"
                await asyncio.sleep(0.03)
            yield "data: [DONE]\n\n"
    except Exception as e:
        logger.error(f"Stream generation error on {primary}: {e}")
        yield f"data: {json.dumps({'error': str(e)})}\n\n"
        yield "data: [DONE]\n\n"
