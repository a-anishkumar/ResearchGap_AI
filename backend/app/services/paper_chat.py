"""
Paper Chat and Selection Explanation Service.
Provides RAG-grounded conversational Q&A and text simplification per paper.
"""
from __future__ import annotations

import json
import logging
import sqlite3
import uuid
import datetime
from fastapi import HTTPException
from app.core.claude_client import complete
from app.core.project import get_sqlite_db_path
from app.services import rag

logger = logging.getLogger(__name__)


def _clean_json_string(text: str) -> str:
    """Clean markdown code fences from LLM text responses."""
    text = text.strip()
    if text.startswith("```json"):
        text = text[7:]
    elif text.startswith("```"):
        text = text[3:]
    if text.endswith("```"):
        text = text[:-3]
    return text.strip()


def _init_db(conn: sqlite3.Connection):
    """Ensure paper_chat_history table exists."""
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS paper_chat_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            paper_id TEXT,
            conversation_id TEXT,
            role TEXT,
            content TEXT,
            citations_json TEXT,
            created_at TEXT
        )
    """)
    conn.commit()


async def get_chat_history(paper_id: str, conversation_id: str | None = None) -> list[dict]:
    """Retrieve chat history for a paper and optional conversation ID."""
    db_path = get_sqlite_db_path()
    db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(db_path)
    _init_db(conn)
    cursor = conn.cursor()

    if conversation_id:
        cursor.execute(
            """
            SELECT role, content, citations_json, conversation_id, created_at
            FROM paper_chat_history
            WHERE paper_id = ? AND conversation_id = ?
            ORDER BY id ASC
            """,
            (paper_id, conversation_id),
        )
    else:
        # Get latest conversation for this paper
        cursor.execute(
            """
            SELECT conversation_id FROM paper_chat_history
            WHERE paper_id = ?
            ORDER BY id DESC LIMIT 1
            """,
            (paper_id,),
        )
        row = cursor.fetchone()
        if not row:
            conn.close()
            return []
        latest_conv_id = row[0]
        cursor.execute(
            """
            SELECT role, content, citations_json, conversation_id, created_at
            FROM paper_chat_history
            WHERE paper_id = ? AND conversation_id = ?
            ORDER BY id ASC
            """,
            (paper_id, latest_conv_id),
        )

    rows = cursor.fetchall()
    conn.close()

    history = []
    for role, content, citations_json, conv_id, created_at in rows:
        citations = []
        citation_flags = []
        if citations_json:
            try:
                parsed_cits = json.loads(citations_json)
                if isinstance(parsed_cits, dict):
                    citations = parsed_cits.get("citations", [])
                    citation_flags = parsed_cits.get("citation_flags", [])
                elif isinstance(parsed_cits, list):
                    citations = parsed_cits
            except Exception:
                pass
        history.append({
            "role": role,
            "content": content,
            "citations": citations,
            "citation_flags": citation_flags,
            "conversation_id": conv_id,
            "created_at": created_at,
        })
    return history


async def chat_with_paper(paper_id: str, message: str, conversation_id: str | None = None) -> dict:
    """
    RAG-grounded chat turn over a specific paper's chunks.
    """
    if not message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    conv_id = conversation_id or str(uuid.uuid4())

    db_path = get_sqlite_db_path()
    db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(db_path)
    _init_db(conn)

    # Fetch past conversation history
    history = await get_chat_history(paper_id, conv_id)
    history_str = ""
    if history:
        turns = [f"{h['role'].capitalize()}: {h['content']}" for h in history[-6:]]
        history_str = "\n".join(turns)

    # Fetch relevant chunks for paper from ChromaDB
    chunks = []
    try:
        col = rag._get_collection()
        # Query ChromaDB with filter by paper_id
        ef = rag._get_embedding_fn()
        emb = ef([message])[0]
        results = col.query(
            query_embeddings=[emb],
            n_results=5,
            where={"paper_id": paper_id},
            include=["documents", "metadatas", "distances"],
        )
        if results and results.get("documents") and results["documents"][0]:
            docs = results["documents"][0]
            ids = results["ids"][0] if results.get("ids") else [f"{paper_id}_{i}" for i in range(len(docs))]
            metas = results["metadatas"][0] if results.get("metadatas") else [{}] * len(docs)
            for cid, doc, meta in zip(ids, docs, metas):
                chunks.append({
                    "chunk_id": cid,
                    "section": meta.get("section", "Main Text"),
                    "text_snippet": doc[:300],
                    "full_doc": doc,
                })
    except Exception as e:
        logger.warning(f"Error fetching chunks for paper chat {paper_id}: {e}")

    if not chunks:
        # Fallback if no specific vector results returned
        try:
            col = rag._get_collection()
            existing = col.get(where={"paper_id": paper_id}, include=["documents"])
            docs = existing.get("documents", []) if existing else []
            for i, doc in enumerate(docs[:5]):
                chunks.append({
                    "chunk_id": f"{paper_id}_{i}",
                    "section": "Main Text",
                    "text_snippet": doc[:300],
                    "full_doc": doc,
                })
        except Exception:
            pass

    chunk_context_blocks = []
    for c in chunks:
        chunk_context_blocks.append(
            f"--- CHUNK ID: {c['chunk_id']} (Section: {c['section']}) ---\n{c['full_doc']}"
        )
    chunk_context = "\n\n".join(chunk_context_blocks) if chunk_context_blocks else "No text chunks available."

    system_prompt = (
        "You are an intelligent AI paper assistant inside ResearchGap AI. "
        "Answer the user's question accurately based ONLY on the provided paper chunks and conversation history. "
        "Every claim in your answer must cite the relevant section inline where appropriate. "
        "Provide a structured JSON response with keys 'answer' and 'citations'."
    )

    user_prompt = f"""
Conversation History:
{history_str or "No previous turns."}

Paper Context Chunks:
{chunk_context}

User Question: {message}

Generate a JSON response with EXACTLY this schema:
{{
  "answer": "Clear, detailed response answering the question, embedding inline citations where appropriate.",
  "citations": [
    {{
      "section": "Section name",
      "excerpt": "Relevant text excerpt (1-2 sentences)"
    }}
  ]
}}
"""

    rag_text_chunks = [c["full_doc"] for c in chunks]

    try:
        from app.services import llm_client
        from app.models.schemas import PaperChatResponse

        chat_resp = await llm_client.generate_structured(
            prompt=user_prompt,
            schema_cls=PaperChatResponse,
            system_instruction=system_prompt,
            endpoint="paper_chat",
            rag_chunks=rag_text_chunks,
        )
        answer = chat_resp.answer
        citations = [c.model_dump() for c in chat_resp.citations]
        citation_flags = [f.model_dump() for f in chat_resp.citation_flags]
    except Exception as e:
        logger.error(f"Error calling LLM for paper chat: {e}")
        answer = f"Based on the paper content: {chunks[0]['text_snippet'] if chunks else 'No specific text found.'}"
        citations = [
            {
                "section": c["section"],
                "excerpt": c["text_snippet"],
            } for c in chunks[:2]
        ]
        citation_flags = []

    # ── RAG Grounding Check (embedding cosine similarity) ───────────────────
    GROUNDING_THRESHOLD = 0.35
    try:
        grounding_score = rag.compute_answer_grounding_score(answer, rag_text_chunks)
        if grounding_score < GROUNDING_THRESHOLD and rag_text_chunks:
            warning = (
                f"⚠️ Low confidence: This answer has limited grounding in the uploaded paper "
                f"(similarity score: {grounding_score:.2f}). Please verify claims against the source PDF."
            )
            answer = warning + "\n\n" + answer
            citation_flags.append({
                "sentence": answer[:120],
                "reason": f"Embedding similarity between answer and retrieved chunks is {grounding_score:.2f}, below threshold {GROUNDING_THRESHOLD}.",
                "suggested_citation_or_softening": "Cross-check this response against the original paper before use.",
            })
            logger.warning(f"Low RAG grounding score {grounding_score:.2f} for paper_id={paper_id}")
    except Exception as gs_err:
        logger.debug(f"Grounding score computation skipped: {gs_err}")
    # ─────────────────────────────────────────────────────────────────────────

    # Save turns to database
    now_str = datetime.datetime.utcnow().isoformat()
    cursor = conn.cursor()
    
    # Save user message
    cursor.execute(
        "INSERT INTO paper_chat_history (paper_id, conversation_id, role, content, citations_json, created_at) VALUES (?, ?, ?, ?, ?, ?)",
        (paper_id, conv_id, "user", message, json.dumps([]), now_str)
    )
    # Save assistant response
    cursor.execute(
        "INSERT INTO paper_chat_history (paper_id, conversation_id, role, content, citations_json, created_at) VALUES (?, ?, ?, ?, ?, ?)",
        (paper_id, conv_id, "assistant", answer, json.dumps({"citations": citations, "citation_flags": citation_flags}), now_str)
    )
    conn.commit()
    conn.close()

    return {
        "answer": answer,
        "citations": citations,
        "citation_flags": citation_flags,
        "conversation_id": conv_id,
    }


async def explain_selection(paper_id: str, selected_text: str) -> dict:
    """
    Provide a plain-language explanation of a highlighted text passage.
    """
    if not selected_text or not selected_text.strip():
        raise HTTPException(status_code=400, detail="Selected text cannot be empty")

    system_prompt = (
        "You are an expert scientific communicator. "
        "Provide a clear, accessible, plain-language breakdown of the user's selected text from an academic paper. "
        "Simplify jargon without losing technical accuracy."
    )

    user_prompt = f"""
Selected Text:
"{selected_text}"

Explain what this passage means in 2-3 concise, clear sentences. Focus on explaining key concepts or terminology.
"""

    try:
        explanation = await complete(system_prompt, user_prompt, max_tokens=400)
    except Exception as e:
        logger.error(f"Failed to generate text explanation: {e}")
        explanation = f"This passage discusses: '{selected_text[:150]}...' in the context of the paper's methodology."

    return {
        "explanation": explanation.strip(),
        "selected_text": selected_text,
    }
