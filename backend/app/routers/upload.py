"""
Upload router — accepts PDF files, saves to disk, triggers async pipeline.
"""
from __future__ import annotations

import uuid
import asyncio
import logging
from pathlib import Path
from fastapi import APIRouter, UploadFile, File, HTTPException, BackgroundTasks
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.models.schemas import UploadResponse, PaperMeta, ProcessingState

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
        await graph_builder.write_paper(paper_id, filename, extraction)
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
    raw_dir = Path(settings.data_raw_path)
    raw_dir.mkdir(parents=True, exist_ok=True)

    papers: list[PaperMeta] = []
    max_bytes = settings.max_upload_mb * 1024 * 1024

    for upload in files:
        if not upload.filename or not upload.filename.lower().endswith(".pdf"):
            raise HTTPException(status_code=400, detail=f"Only PDF files accepted, got: {upload.filename}")

        content = await upload.read()
        if len(content) > max_bytes:
            raise HTTPException(
                status_code=413,
                detail=f"{upload.filename} exceeds {settings.max_upload_mb}MB limit",
            )

        paper_id = str(uuid.uuid4())
        save_path = raw_dir / f"{paper_id}.pdf"
        save_path.write_bytes(content)

        state = ProcessingState(
            paper_id=paper_id,
            filename=upload.filename,
            stage="uploaded",
            progress=5,
        )
        set_state(state)

        background_tasks.add_task(_run_pipeline, paper_id, save_path, upload.filename)

        papers.append(
            PaperMeta(
                paper_id=paper_id,
                filename=upload.filename,
                page_count=0,
                status="uploaded",
            )
        )

    return UploadResponse(papers=papers)


@router.get("/status/{paper_id}")
async def get_upload_status(paper_id: str):
    state = get_state(paper_id)
    if not state:
        raise HTTPException(status_code=404, detail="Paper not found")
    return state


@router.get("/status")
async def get_all_status():
    return list(processing_states.values())
