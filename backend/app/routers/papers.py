"""
Papers router — paper detail view, re-process, single paper analysis, and paper comparison.
POST /api/papers/compare           → side-by-side paper comparison
GET  /api/papers/{paper_id}            → full paper metadata + related papers
POST /api/papers/{paper_id}/reprocess  → re-run LLM extraction + graph write
POST /api/papers/{paper_id}/analyze    → LLM deep paper analytical breakdown
"""
from __future__ import annotations

import logging
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from app.services import rag, graph_builder, paper_analyzer, paper_chat, llm_client

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/papers", tags=["papers"])


class CompareRequest(BaseModel):
    paper_id_a: str
    paper_id_b: str


class PaperChatRequest(BaseModel):
    message: str
    conversation_id: str | None = None


class ExplainSelectionRequest(BaseModel):
    selected_text: str


@router.post("/compare")
async def compare_two_papers(req: CompareRequest):
    """Generate structured side-by-side comparison for two papers."""
    return await paper_analyzer.compare_papers(req.paper_id_a, req.paper_id_b)


@router.get("/{paper_id}")
async def get_paper(paper_id: str):
    """Return full metadata for a single paper, plus semantically related papers."""
    try:
        all_papers = await graph_builder.get_all_papers()
        paper = next((p for p in all_papers if p["paper_id"] == paper_id), None)
        if not paper:
            raise HTTPException(status_code=404, detail="Paper not found")

        # Find related papers via RAG similarity (use title as query)
        related = []
        if paper.get("title"):
            chunks = rag.retrieve(paper["title"], top_k=6)
            seen_ids = {paper_id}
            for c in chunks:
                pid = c.get("paper_id", "")
                if pid and pid not in seen_ids:
                    seen_ids.add(pid)
                    related.append({
                        "paper_id": pid,
                        "title": c.get("title", pid[:8]),
                        "relevance": round(max(0, 1 - c.get("distance", 0)) * 100, 1),
                    })

        return {**paper, "related_papers": related[:5]}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Error fetching paper: {e}")


@router.post("/{paper_id}/reprocess")
async def reprocess_paper(paper_id: str):
    """Re-run LLM extraction and graph write for an existing paper."""
    from app.routers.upload import processing_states, _run_pipeline
    from pathlib import Path
    from app.core.project import get_raw_dir
    raw_dir = get_raw_dir()

    state = processing_states.get(paper_id)
    if not state:
        raise HTTPException(status_code=404, detail="Paper not found in processing queue")

    pdf_path = raw_dir / f"{paper_id}.pdf"
    if not pdf_path.exists():
        raise HTTPException(status_code=404, detail="PDF file not found on disk")

    # Reset state for re-processing
    state.stage = "uploaded"
    state.progress = 5
    state.error = None

    import asyncio
    asyncio.create_task(_run_pipeline(paper_id, pdf_path, state.filename))

    return {"status": "reprocessing", "paper_id": paper_id, "filename": state.filename}


@router.post("/{paper_id}/analyze")
async def analyze_single_paper(paper_id: str):
    """Generate or retrieve cached LLM deep analytical breakdown for a single paper."""
    return await paper_analyzer.analyze_paper(paper_id)


@router.post("/{paper_id}/chat")
async def chat_with_paper_endpoint(paper_id: str, req: PaperChatRequest):
    """Ask a question about a specific paper with RAG citations."""
    return await paper_chat.chat_with_paper(paper_id, req.message, req.conversation_id)


@router.post("/{paper_id}/chat/stream")
async def stream_paper_chat_endpoint(paper_id: str, req: PaperChatRequest):
    """Stream Q&A response for paper chat using SSE."""
    prompt = f"Answer question regarding paper {paper_id}: {req.message}"
    return StreamingResponse(
        llm_client.stream_generate(prompt, system_instruction="You are an intelligent AI paper assistant."),
        media_type="text/event-stream"
    )


@router.get("/{paper_id}/chat/history")
async def get_paper_chat_history_endpoint(paper_id: str, conversation_id: str | None = None):
    """Reload conversation turns for a paper."""
    return await paper_chat.get_chat_history(paper_id, conversation_id)


@router.post("/{paper_id}/explain-selection")
async def explain_paper_selection_endpoint(paper_id: str, req: ExplainSelectionRequest):
    """Get a plain-language explanation of highlighted text from a paper."""
    return await paper_chat.explain_selection(paper_id, req.selected_text)


