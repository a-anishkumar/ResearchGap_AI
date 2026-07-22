"""
Export router — BibTeX and LaTeX proposal export generation endpoints.
"""
from __future__ import annotations

import logging
import re
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import PlainTextResponse
from app.services import gap_finder, graph_builder

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/gaps/export", tags=["export"])


def _to_bibtex_key(title: str, year: int | str | None) -> str:
    cleaned = re.sub(r"[^a-zA-Z0-9]", "", title.split()[0] if title else "Paper")
    yr = str(year) if year else "2024"
    return f"{cleaned.lower()}{yr}"


@router.get("/bibtex", response_class=PlainTextResponse)
async def export_bibtex(
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


@router.get("/latex", response_class=PlainTextResponse)
async def export_latex(
    method: str = Query(..., description="Method name"),
    domain: str = Query(..., description="Domain name")
):
    """Generate LaTeX proposal document template for applying Method to Domain."""
    try:
        val_res = await gap_finder.check_external_gap_validation(method, domain)
        bib_key_m = re.sub(r"[^a-zA-Z0-9]", "", method.lower())
        bib_key_d = re.sub(r"[^a-zA-Z0-9]", "", domain.lower())

        latex_doc = f"""\\documentclass[11pt, a4paper]{{article}}
\\usepackage[utf8]{{inputenc}}
\\usepackage{{amsmath, amssymb, graphicx, hyperref, booktabs}}

\\title{{\\textbf{{Research Proposal: Applying {method} to {domain}}}}}
\\author{{\\textbf{{ResearchGap AI Proposal Engine}}}}
\\date{{\\today}}

\\begin{{document}}

\\maketitle

\\begin{{abstract}}
This document outlines a research proposal exploring the integration of \\textbf{{{method}}} into the domain of \\textbf{{{domain}}}. Algorithmic analysis of the literature corpus indicates a direct research gap. External literature validation status: \\textit{{{val_res.get('status')}}}.
\\end{{abstract}}

\\section{{Problem Statement}}
While \\textbf{{{method}}} has demonstrated strong utility in machine learning architectures, its direct application to \\textbf{{{domain}}} remains under-explored in the target corpus. This work aims to bridge this domain divide.

\\section{{Core Hypothesis}}
We hypothesize that adapting \\textbf{{{method}}} to the specific constraints of \\textbf{{{domain}}} will yield improved accuracy, scalability, and generalization.

\\section{{Proposed Methodology Blueprint}}
\\begin{{enumerate}}
    \\item \\textbf{{Data Pipeline}}: Preprocess benchmark datasets relevant to {domain}.
    \\item \\textbf{{Model Adaptation}}: Modify {method} architecture to accommodate domain-specific feature spaces.
    \\item \\textbf{{Evaluation}}: Benchmark against traditional approaches using standard evaluation metrics.
\\end{{enumerate}}

\\section{{Literature Justification}}
Seed citations from the corpus support the foundational readiness of both the method and domain.

\\bibliographystyle{{plain}}
\\bibliography{{references}}

\\end{{document}}"""

        return latex_doc
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate LaTeX document: {e}")
