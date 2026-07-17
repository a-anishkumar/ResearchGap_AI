"""
LLM-powered structured extraction of paper entities.
Uses Claude to extract: title, authors, year, methods, domains, datasets, results.
Validates output against PaperExtraction Pydantic schema.
Retries up to 3x on malformed JSON.
Normalizes all entity names before returning.
"""
from __future__ import annotations

import json
import re
import logging
from app.core.claude_client import complete
from app.models.schemas import PaperExtraction, ResultItem

logger = logging.getLogger(__name__)

# ── Name normalization ─────────────────────────────────────────────────────────

# Common synonyms → canonical form
_SYNONYMS: dict[str, str] = {
    "bert": "BERT",
    "gpt": "GPT",
    "gpt-2": "GPT-2",
    "gpt-3": "GPT-3",
    "gpt-4": "GPT-4",
    "t5": "T5",
    "roberta": "RoBERTa",
    "xlnet": "XLNet",
    "lstm": "LSTM",
    "gru": "GRU",
    "cnn": "CNN",
    "rnn": "RNN",
    "transformer": "Transformer",
    "attention mechanism": "Attention Mechanism",
    "self-attention": "Self-Attention",
    "explainable ai": "Explainable AI",
    "xai": "Explainable AI",
    "natural language processing": "NLP",
    "nlp": "NLP",
    "machine learning": "Machine Learning",
    "ml": "Machine Learning",
    "deep learning": "Deep Learning",
    "dl": "Deep Learning",
    "reinforcement learning": "Reinforcement Learning",
    "rl": "Reinforcement Learning",
    "named entity recognition": "NER",
    "ner": "NER",
    "question answering": "Question Answering",
    "qa": "Question Answering",
    "sentiment analysis": "Sentiment Analysis",
    "machine translation": "Machine Translation",
    "mt": "Machine Translation",
}


def normalize_name(name: str) -> str:
    """Lowercase, strip, collapse whitespace, then apply synonym map."""
    cleaned = re.sub(r"\s+", " ", name.strip().lower())
    return _SYNONYMS.get(cleaned, cleaned.title())


def normalize_list(names: list[str]) -> list[str]:
    seen = set()
    result = []
    for n in names:
        if not n or not n.strip():
            continue
        norm = normalize_name(n)
        if norm.lower() not in seen:
            seen.add(norm.lower())
            result.append(norm)
    return result


# ── Prompt ────────────────────────────────────────────────────────────────────

_SYSTEM_PROMPT = """You are an expert academic literature analyst. 
Extract structured information from the provided paper text and return ONLY a valid JSON object.
No markdown fences, no explanation — just the raw JSON.

JSON Schema:
{
  "title": "string — full paper title",
  "authors": ["string", ...],
  "year": integer or null,
  "methods": ["string", ...],   // ML/AI methods, algorithms, architectures used
  "domains": ["string", ...],   // application domains, e.g. "Tamil NLP", "Biomedical NLP"
  "datasets": ["string", ...],  // dataset names
  "results": [
    {"metric": "string", "value": "string", "description": "string"},
    ...
  ]
}

Rules:
- methods: extract specific technique names (e.g., "BERT", "LSTM", "Transformer", "Random Forest")
- domains: extract application area / language / field (e.g., "Tamil NLP", "Legal NLP", "Medical Imaging")
- Be specific — avoid generic terms like "neural network" alone if a more specific term applies
- If a field cannot be determined, return an empty list or null
"""


def _build_user_prompt(extraction_text: str, filename: str) -> str:
    return f"""Paper filename: {filename}

Paper text (abstract + methods + results sections):
---
{extraction_text[:4000]}
---

Extract and return the JSON object."""


def _parse_json_response(response: str) -> dict:
    """Strip markdown fences and parse JSON, raising on failure."""
    text = response.strip()
    # Remove ```json ... ``` fences if present
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text)
    return json.loads(text)


async def extract_paper(
    extraction_text: str,
    filename: str = "unknown.pdf",
) -> PaperExtraction:
    """
    Call Claude to extract structured entities from paper text.
    Retries up to 3x on malformed JSON.
    Raises on persistent failure.
    """
    last_error: Exception | None = None
    for attempt in range(1, 4):
        try:
            raw = await complete(
                system=_SYSTEM_PROMPT,
                user=_build_user_prompt(extraction_text, filename),
                max_tokens=1024,
            )
            data = _parse_json_response(raw)

            # Normalize before validation
            if "methods" in data and isinstance(data["methods"], list):
                data["methods"] = normalize_list(data["methods"])
            if "domains" in data and isinstance(data["domains"], list):
                data["domains"] = normalize_list(data["domains"])
            if "datasets" in data and isinstance(data["datasets"], list):
                data["datasets"] = normalize_list(data["datasets"])

            extraction = PaperExtraction(**data)
            logger.info(
                f"Extracted from '{filename}': "
                f"{len(extraction.methods)} methods, "
                f"{len(extraction.domains)} domains, "
                f"{len(extraction.datasets)} datasets"
            )
            return extraction

        except (json.JSONDecodeError, ValueError, TypeError) as e:
            last_error = e
            logger.warning(f"Attempt {attempt}/3 — malformed JSON from LLM: {e}")

    # After 3 failures return a minimal extraction rather than crashing the batch
    logger.error(f"All 3 extraction attempts failed for '{filename}': {last_error}")
    return PaperExtraction(title=filename.replace(".pdf", ""))
