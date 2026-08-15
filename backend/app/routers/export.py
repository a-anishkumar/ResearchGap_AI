"""
Export router — BibTeX, LaTeX, Markdown, and PDF proposal export endpoints.
"""
from __future__ import annotations

import logging
import re
from fastapi import APIRouter, HTTPException, Query, Response
from fastapi.responses import PlainTextResponse

from app.services import gap_finder, graph_builder, proposal_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/export", tags=["export"])


def _to_bibtex_key(title: str, year: int | str | None) -> str:
    cleaned = re.sub(r"[^a-zA-Z0-9]", "", title.split()[0] if title else "Paper")
    yr = str(year) if year else "2024"
    return f"{cleaned.lower()}{yr}"


@router.get("/gaps/bibtex", response_class=PlainTextResponse)
async def export_gaps_bibtex(
    method: str = Query(..., description="Method name"),
    domain: str = Query(..., description="Domain name")
):
    """Generate BibTeX citations for papers related to the selected Method and Domain."""
    try:
        method_papers = await gap_finder.get_papers_for_method(method)
        domain_papers = await gap_finder.get_papers_for_domain(domain)
        all_papers = await graph_builder.get_all_papers()
        
        target_titles = set(method_papers + domain_papers)
        matched = [p for p in all_papers if p.get("title") in target_titles]

        if not matched:
            matched = all_papers[:5]  # Fallback to top project papers

        bib_entries = []
        for p in matched:
            key = _to_bibtex_key(p.get("title", "paper"), p.get("year"))
            authors_str = " and ".join(p.get("authors", ["Anonymous"])) if isinstance(p.get("authors"), list) else str(p.get("authors", "Anonymous"))
            entry = f"""@article{{{key},
  title = {{{p.get('title', 'Untitled')}}},
  author = {{{authors_str}}},
  year = {{{p.get('year') or 2024}}},
  journal = {{Corpus Publication}},
  note = {{Extracted by ResearchGap AI}}
}}"""
            bib_entries.append(entry)

        return "\n\n".join(bib_entries)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate BibTeX: {e}")


@router.get("/proposal/{proposal_id}/latex", response_class=PlainTextResponse)
async def export_proposal_latex(proposal_id: str):
    """Export research proposal blueprint as LaTeX (.tex) document."""
    proposal = await proposal_service.get_proposal(proposal_id)
    if not proposal:
        raise HTTPException(status_code=404, detail="Proposal not found.")
    return PlainTextResponse(
        content=proposal_service.export_proposal_latex(proposal),
        media_type="application/x-tex",
        headers={"Content-Disposition": f"attachment; filename={proposal_id}.tex"}
    )


@router.get("/proposal/{proposal_id}/bibtex", response_class=PlainTextResponse)
async def export_proposal_bibtex(proposal_id: str):
    """Export research proposal citation seeds as BibTeX (.bib) file."""
    proposal = await proposal_service.get_proposal(proposal_id)
    if not proposal:
        raise HTTPException(status_code=404, detail="Proposal not found.")
    return PlainTextResponse(
        content=proposal_service.export_proposal_bibtex(proposal),
        media_type="text/plain",
        headers={"Content-Disposition": f"attachment; filename={proposal_id}.bib"}
    )


@router.get("/proposal/{proposal_id}/markdown", response_class=PlainTextResponse)
async def export_proposal_markdown(proposal_id: str):
    """Export research proposal blueprint as Markdown (.md) document."""
    proposal = await proposal_service.get_proposal(proposal_id)
    if not proposal:
        raise HTTPException(status_code=404, detail="Proposal not found.")
    return PlainTextResponse(
        content=proposal_service.export_proposal_markdown(proposal),
        media_type="text/markdown",
        headers={"Content-Disposition": f"attachment; filename={proposal_id}.md"}
    )


@router.get("/proposal/{proposal_id}/pdf")
async def export_proposal_pdf(proposal_id: str):
    """Export research proposal blueprint as binary PDF document."""
    proposal = await proposal_service.get_proposal(proposal_id)
    if not proposal:
        raise HTTPException(status_code=404, detail="Proposal not found.")
    pdf_bytes = proposal_service.export_proposal_pdf(proposal)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={proposal_id}.pdf"}
    )
