"""
Verification test for Output Reliability Layer in llm_client.py
Tests:
1. Normalization helper (_normalize_json_text)
2. Grounding check (run_grounding_check)
3. Call logging to SQLite (llm_call_log)
4. Structured generation with repair pass / fallback
"""
import sys
from pathlib import Path

# Add backend dir to sys.path
backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

import asyncio
import sqlite3
from app.services.llm_client import (
    _normalize_json_text,
    run_grounding_check,
    log_llm_call,
    generate_structured,
)
from app.models.schemas import CitationFlag, PaperExtraction, PaperChatResponse
from app.core.project import get_sqlite_db_path


def test_normalization():
    print("--- 1. Testing Normalization Helper ---")
    raw_markdown = "```json\n{\n  \"title\": \"Sample Paper\",\n  \"authors\": [\"Author A\"],\n}\n```"
    cleaned = _normalize_json_text(raw_markdown)
    import json
    data = json.loads(cleaned)
    assert data == {"title": "Sample Paper", "authors": ["Author A"]}, f"Unexpected output: {cleaned}"
    print("[OK] Normalization successfully cleaned markdown fences and trailing commas.")


def test_grounding_check():
    print("\n--- 2. Testing RAG Grounding Check ---")
    context = [
        "In this work, we propose Graph-RAG for biomedical question answering using PubMed datasets.",
        "Our baseline model achieves 84.5% accuracy on domain benchmarks."
    ]
    
    grounded_text = "The proposed Graph-RAG method achieves 84.5% accuracy on domain benchmarks."
    flags_1 = run_grounding_check(grounded_text, context)
    assert len(flags_1) == 0, f"Expected 0 flags for grounded text, got {len(flags_1)}"

    ungrounded_text = "The HyperSwin-V2 architecture scores 99.9% BLEU on WMT-14 translation tasks."
    flags_2 = run_grounding_check(ungrounded_text, context)
    assert len(flags_2) > 0, "Expected grounding flags for ungrounded claims!"
    print(f"[OK] Grounding check flagged ungrounded claim: '{flags_2[0].sentence}'")


def test_database_logging():
    print("\n--- 3. Testing Database Call Logging ---")
    log_llm_call("test_provider", "test_endpoint", retry_count=1, success=True, error_message="")
    
    db_path = get_sqlite_db_path()
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    cursor.execute("SELECT provider, endpoint, retry_count, success FROM llm_call_log WHERE provider='test_provider'")
    row = cursor.fetchone()
    conn.close()
    
    assert row is not None, "Failed finding logged call in SQLite!"
    assert row[0] == "test_provider" and row[1] == "test_endpoint" and row[2] == 1 and row[3] == 1
    print("[OK] Database logging verified in llm_call_log table.")


import pytest


@pytest.mark.asyncio
async def test_structured_generation():
    print("\n--- 4. Testing End-to-End Structured Generation ---")
    prompt = "Generate metadata for a paper titled 'Deep Learning for Genomics' by Alice Smith written in 2023."
    result = await generate_structured(
        prompt=prompt,
        schema_cls=PaperExtraction,
        system_instruction="Generate JSON matching PaperExtraction.",
        endpoint="test_structured"
    )
    print(f"[OK] Successfully generated structured PaperExtraction: title='{result.title}', authors={result.authors}")


async def main():
    print("==================================================")
    print(" Running Output Reliability Layer Verification ")
    print("==================================================")
    test_normalization()
    test_grounding_check()
    test_database_logging()
    await test_structured_generation()
    print("\nALL RELIABILITY TESTS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    asyncio.run(main())
