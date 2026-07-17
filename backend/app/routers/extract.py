"""
Extract router — manual trigger for LLM extraction.
"""
from __future__ import annotations

import logging
from pathlib import Path
from fastapi import APIRouter, HTTPException

from app.core.config import settings
from app.models.schemas import ExtractResponse, BatchExtractResponse
from app.services import pdf_parser, llm_extractor
from app.routers.upload import processing_states

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/extract", tags=["extract"])


@router.post("/{paper_id}", response_model=ExtractResponse)
async def extract_single(paper_id: str):
    raw_dir = Path(settings.data_raw_path)
    pdf_path = raw_dir / f"{paper_id}.pdf"

    if not pdf_path.exists():
        raise HTTPException(status_code=404, detail=f"PDF not found for paper_id={paper_id}")

    filename = processing_states.get(paper_id, {})
    if hasattr(filename, "filename"):
        filename = filename.filename
    else:
        filename = f"{paper_id}.pdf"

    parsed = pdf_parser.parse_pdf(pdf_path)
    extraction = await llm_extractor.extract_paper(parsed.extraction_text, filename)
    return ExtractResponse(paper_id=paper_id, extraction=extraction, status="ok")
