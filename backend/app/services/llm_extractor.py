"""
LLM-powered structured extraction of paper entities.
Uses Claude to extract: title, authors, year, methods, domains, datasets, results.
Validates output against PaperExtraction Pydantic schema.
Retries up to 3x on malformed JSON.
Normalizes all entity names before returning.
"""
from __future__ import annotations

import asyncio
import json
import re
import logging
from app.core.claude_client import complete
from app.models.schemas import PaperExtraction, ResultItem
from app.core.ollama_client import generate_ollama
from app.core.config import settings

logger = logging.getLogger(__name__)

# Global concurrency semaphore for LLM extraction requests (max 5 parallel LLM API calls)
_EXTRACTION_SEMAPHORE = asyncio.Semaphore(5)

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


# Acronym allowlist to preserve uppercase casing
_ACRONYMS: dict[str, str] = {
    "llm": "LLM",
    "llms": "LLMs",
    "nlp": "NLP",
    "rag": "RAG",
    "xai": "XAI",
    "cnn": "CNN",
    "cnns": "CNNs",
    "rnn": "RNN",
    "rnns": "RNNs",
    "gan": "GAN",
    "gans": "GANs",
    "bert": "BERT",
    "gpt": "GPT",
    "t5": "T5",
    "roberta": "RoBERTa",
    "xlnet": "XLNet",
    "lstm": "LSTM",
    "lstms": "LSTMs",
    "gru": "GRU",
    "api": "API",
    "apis": "APIs",
    "ner": "NER",
    "qa": "QA",
    "mt": "MT",
    "ai": "AI",
    "ml": "ML",
    "dl": "DL",
    "rl": "RL",
    "gpu": "GPU",
    "gpus": "GPUs",
}


def smart_title_case(text: str) -> str:
    """Title-case words while preserving exact acronym capitalization in allowlist."""
    tokens = re.split(r'(\s+|[\(\)\[\]\{\},:\.-])', text)
    result = []
    for token in tokens:
        clean_token = token.lower()
        if clean_token in _ACRONYMS:
            result.append(_ACRONYMS[clean_token])
        elif token and not token.isspace() and len(token) > 0:
            result.append(token.capitalize())
        else:
            result.append(token)
    return "".join(result)


def normalize_name(name: str) -> str:
    """Lowercase, strip, collapse whitespace, then apply synonym map and smart casing."""
    cleaned = re.sub(r"\s+", " ", name.strip().lower())
    if cleaned in _SYNONYMS:
        return _SYNONYMS[cleaned]
    return smart_title_case(cleaned)


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


def _build_user_prompt(extraction_text: str, filename: str, error_feedback: str | None = None) -> str:
    prompt = f"""Paper filename: {filename}

Paper text (abstract + methods + results sections):
---
{extraction_text[:4000]}
---
"""
    if error_feedback:
        prompt += f"\n\nCRITICAL FIX REQUIRED: Your previous attempt failed validation with error: {error_feedback}. Ensure strict compliance with the JSON schema."

    prompt += "\n\nExtract and return the JSON object."
    return prompt


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
    Extract structured entities from paper text with concurrency control and Pydantic validation retry.
    Cap concurrency at 5 parallel LLM API calls using _EXTRACTION_SEMAPHORE.
    """
    async with _EXTRACTION_SEMAPHORE:
        ollama_draft = None
        if settings.use_ollama:
            try:
                logger.info(f"Starting local Ollama pre-extraction for '{filename}' using {settings.ollama_model}...")
                ollama_prompt = (
                    f"Paper filename: {filename}\n\n"
                    f"Paper text (first 10,000 characters):\n"
                    f"---\n{extraction_text[:10000]}\n---\n\n"
                    "Please extract key facts (Title, Authors, Year, Methods, Domains, Datasets, Results) "
                    "and output them in a highly compact, structured bulleted list format."
                )
                ollama_system = (
                    "You are an expert academic literature parser. "
                    "Provide a highly condensed summary of the paper's key elements (Title, Authors, Year, Methods, Domains, Datasets, Results). "
                    "Output ONLY the bulleted list. Do not include introductory or concluding conversational text."
                )
                ollama_draft = await generate_ollama(prompt=ollama_prompt, system_instruction=ollama_system)
                logger.info(
                    f"Ollama pre-extraction complete. Condensed {len(extraction_text)} chars of raw text "
                    f"down to {len(ollama_draft)} chars of draft summary."
                )
            except Exception as e:
                logger.warning(
                    f"Local Ollama pre-extraction failed for '{filename}': {e}. "
                    "Falling back to direct Gemini extraction."
                )
                ollama_draft = None

        # Use LLM Client with Output Reliability Layer
        system_prompt = _SYSTEM_PROMPT
        user_prompt = _build_user_prompt(extraction_text, filename)

        try:
            from app.services import llm_client
            extraction = await llm_client.generate_structured(
                prompt=user_prompt,
                schema_cls=PaperExtraction,
                system_instruction=system_prompt,
                endpoint="entity_extraction"
            )

            # Normalize names
            extraction.methods = normalize_list(extraction.methods)
            extraction.domains = normalize_list(extraction.domains)
            extraction.datasets = normalize_list(extraction.datasets)

            logger.info(
                f"Extracted from '{filename}': "
                f"{len(extraction.methods)} methods, "
                f"{len(extraction.domains)} domains, "
                f"{len(extraction.datasets)} datasets"
            )
            return extraction
        except Exception as e:
            logger.error(f"Structured entity extraction failed for '{filename}': {e}")
            return PaperExtraction(title=filename.replace(".pdf", ""))


