"""
Upload router — accepts PDF files, saves to disk, triggers async pipeline.
"""
from __future__ import annotations

import uuid
import asyncio
import hashlib
import logging
from difflib import SequenceMatcher
from pathlib import Path
from fastapi import APIRouter, UploadFile, File, HTTPException, BackgroundTasks
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.models.schemas import UploadResponse, PaperMeta, ProcessingState
from app.core.project import get_raw_dir, get_project_name

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/upload", tags=["upload"])

# In-memory processing state (keyed by paper_id)
processing_states: dict[str, ProcessingState] = {}


def get_state(paper_id: str) -> ProcessingState | None:
    return processing_states.get(paper_id)


def set_state(state: ProcessingState):
    processing_states[state.paper_id] = state


async def _run_pipeline(paper_id: str, pdf_path: Path, filename: str):
    """
    Full async pipeline for a single paper:
    parse → LLM extract → embed → graph write
    """
    from app.services import pdf_parser, llm_extractor, rag, graph_builder

    state = processing_states[paper_id]

    try:
        # Stage 1: Parse PDF
        state.stage = "parsing"
        state.progress = 10
        parsed = pdf_parser.parse_pdf(pdf_path)

        if parsed.error and not parsed.raw_text:
            state.stage = "error"
            state.error = parsed.error
            state.progress = 0
            return

        state.stage = "parsed"
        state.progress = 30

        # Stage 2: LLM extraction
        state.stage = "extracting"
        state.progress = 40
        extraction = await llm_extractor.extract_paper(
            extraction_text=parsed.extraction_text,
            filename=filename,
        )
        state.extraction = extraction
        state.stage = "extracted"
        state.progress = 60

        # Stage 3: Embed + store in ChromaDB
        state.stage = "embedding"
        state.progress = 70
        chunks = pdf_parser.chunk_text(parsed.raw_text)
        rag.ingest_chunks(
            paper_id=paper_id,
            chunks=chunks,
            metadata_extra={"title": extraction.title},
        )
        state.stage = "embedded"
        state.progress = 85

        # Stage 4: Write to Neo4j graph
        state.stage = "graphing"
        state.progress = 90
        try:
            await graph_builder.write_paper(paper_id, filename, extraction)
        except Exception as e:
            logger.warning(f"Could not write paper {filename} to Neo4j (skipping): {e}")
        state.stage = "done"
        state.progress = 100
        logger.info(f"Pipeline complete for {filename} ({paper_id})")

    except Exception as e:
        logger.exception(f"Pipeline error for {filename}: {e}")
        state.stage = "error"
        state.error = str(e)
        state.progress = 0


@router.post("", response_model=UploadResponse)
async def upload_papers(
    background_tasks: BackgroundTasks,
    files: list[UploadFile] = File(...),
):
    raw_dir = get_raw_dir()
    raw_dir.mkdir(parents=True, exist_ok=True)

    papers: list[PaperMeta] = []
    max_bytes = settings.max_upload_mb * 1024 * 1024
    current_proj = get_project_name()

    for upload in files:
        if not upload.filename or not upload.filename.lower().endswith(".pdf"):
            raise HTTPException(status_code=400, detail=f"Only PDF files accepted, got: {upload.filename}")

        content = await upload.read()
        if len(content) > max_bytes:
            raise HTTPException(
                status_code=413,
                detail=f"{upload.filename} exceeds {settings.max_upload_mb}MB limit",
            )

        # ── Duplicate Detection ────────────────────────────────────────────────
        file_hash = hashlib.sha256(content).hexdigest()

        # Check for exact duplicate by hash (same bytes)
        for existing_state in processing_states.values():
            if existing_state.project == current_proj and existing_state.sha256 == file_hash:
                raise HTTPException(
                    status_code=409,
                    detail={
                        "error": "duplicate",
                        "message": f"Duplicate detected: '{upload.filename}' is identical to already-uploaded '{existing_state.filename}'.",
                        "existing_paper_id": existing_state.paper_id,
                        "existing_filename": existing_state.filename,
                    },
                )

        # Check near-duplicate by filename similarity (fast check before LLM extraction)
        near_dup_warning = None
        clean_name = upload.filename.lower().replace(".pdf", "").replace("_", " ").replace("-", " ")
        for existing_state in processing_states.values():
            if existing_state.project == current_proj and existing_state.sha256 != file_hash:
                existing_clean = existing_state.filename.lower().replace(".pdf", "").replace("_", " ").replace("-", " ")
                ratio = SequenceMatcher(None, clean_name, existing_clean).ratio()
                if ratio > 0.85:
                    near_dup_warning = {
                        "warning": "near_duplicate",
                        "message": f"Near-duplicate detected: '{upload.filename}' looks very similar to '{existing_state.filename}'.",
                        "similar_to": existing_state.filename,
                        "similarity": round(ratio, 2),
                    }
                    break
        # ──────────────────────────────────────────────────────────

        paper_id = str(uuid.uuid4())
        save_path = raw_dir / f"{paper_id}.pdf"
        save_path.write_bytes(content)

        state = ProcessingState(
            paper_id=paper_id,
            filename=upload.filename,
            stage="uploaded",
            progress=5,
            project=current_proj,
            sha256=file_hash,
        )
        set_state(state)

        background_tasks.add_task(_run_pipeline, paper_id, save_path, upload.filename)

        paper_meta = PaperMeta(
            paper_id=paper_id,
            filename=upload.filename,
            page_count=0,
            status="uploaded",
        )
        papers.append(paper_meta)

    return UploadResponse(papers=papers)


@router.get("/status/{paper_id}")
async def get_upload_status(paper_id: str):
    state = get_state(paper_id)
    if not state:
        raise HTTPException(status_code=404, detail="Paper not found")
    return state


@router.get("/status")
async def get_all_status():
    current_proj = get_project_name()
    return [s for s in processing_states.values() if s.project == current_proj]


@router.delete("/{paper_id}")
async def delete_paper_endpoint(paper_id: str):
    """
    Delete paper from memory, raw storage, ChromaDB, and Neo4j/SQLite graph.
    """
    from app.services import graph_builder, rag
    import os

    # 1. Remove from in-memory processing states
    if paper_id in processing_states:
        del processing_states[paper_id]

    # 2. Delete the physical PDF file
    try:
        raw_dir = get_raw_dir()
        pdf_path = raw_dir / f"{paper_id}.pdf"
        if pdf_path.exists():
            os.remove(pdf_path)
            logger.info(f"Deleted PDF file on disk: {pdf_path}")
    except Exception as e:
        logger.warning(f"Could not delete PDF file for {paper_id}: {e}")

    # 3. Delete from ChromaDB vector store
    try:
        rag.delete_paper_chunks(paper_id)
    except Exception as e:
        logger.warning(f"Could not delete ChromaDB chunks for {paper_id}: {e}")

    # 4. Delete from graph DB (Neo4j or SQLite)
    try:
        await graph_builder.delete_paper(paper_id)
    except Exception as e:
        logger.exception(f"Error deleting paper {paper_id} from graph database: {e}")
        raise HTTPException(
            status_code=500, detail=f"Failed to delete paper from graph database: {e}"
        )

    return {"status": "ok", "message": f"Paper {paper_id} deleted successfully"}
