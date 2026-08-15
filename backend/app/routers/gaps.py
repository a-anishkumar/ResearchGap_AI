"""
Gaps router — gap analysis + LLM-grounded suggestions.
"""
from __future__ import annotations

import logging
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse
from app.core.config import settings
from app.core.claude_client import complete
from app.models.schemas import (
    GapAnalysisResponse,
    GapSuggestResponse,
    GapSuggestion,
    EvidenceTrail,
    EvidencePaper,
    ProposalPolishResponse,
    ResearchProposal,
)
from app.services import gap_finder, rag, proposal_service, llm_client

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/gaps", tags=["gaps"])

_SUGGEST_SYSTEM = """You are an expert research advisor analyzing research gaps.
Given an unexplored combination of a research method and application domain, respond EXACTLY in this format with no deviations:

WHY THIS GAP EXISTS:
• [1 sentence on why this combination hasn't been tried yet]

RESEARCH OPPORTUNITY:
• [1 sentence stating the core research question to explore]
• [1 sentence on what makes this combination valuable]

EXPECTED PARAMETER OUTCOMES (e.g., Accuracy, Speed, Scalability):
• Accuracy: [1 sentence on how combining these is expected to change accuracy or precision, citing reasoning from context]
• Speed/Efficiency: [1 sentence on expected change in computational efficiency or complexity]
• Scalability/Generalizability: [1 sentence on how well this scales or generalizes to new datasets/problems]

FIRST STEPS:
• [1 concrete action to start this research]
• [1 dataset or benchmark to use]

Cite the actual paper titles from the provided context when relevant. Be specific and actionable. Return ONLY this structured format."""


@router.get("/analyze", response_model=GapAnalysisResponse)
async def analyze_gaps(top_n: int = Query(default=20, ge=1, le=100)):
    try:
        result = await gap_finder.analyze_gaps(top_n=top_n)
        return GapAnalysisResponse(**result)
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Gap analysis error: {e}")


@router.post("/suggest", response_model=GapSuggestResponse)
async def suggest_gaps(top_n: int = Query(default=10, ge=1, le=50)):
    try:
        gap_result = await gap_finder.analyze_gaps(top_n=top_n)
        top_gaps = gap_result["top_gaps"]
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Gap analysis error: {e}")

    suggestions: list[GapSuggestion] = []

    for gap in top_gaps:
        method_papers = await gap_finder.get_papers_for_method(gap.method)
        domain_papers = await gap_finder.get_papers_for_domain(gap.domain)

        # Evidence trail: paper_id level method-only vs domain-only
        evidence_trail = None
        try:
            trail_data = await gap_finder.get_evidence_trail(gap.method, gap.domain)
            evidence_trail = EvidenceTrail(
                method_only=[EvidencePaper(**p) for p in trail_data["method_only"][:10]],
                domain_only=[EvidencePaper(**p) for p in trail_data["domain_only"][:10]],
            )
        except Exception as ev_err:
            logger.warning(f"Could not build evidence trail for {gap.method} x {gap.domain}: {ev_err}")

        # RAG retrieval: gather relevant chunks for context
        query = f"{gap.method} applied to {gap.domain}"
        chunks = []
        try:
            chunks = rag.retrieve(query, top_k=settings.rag_top_k)
        except Exception as rag_err:
            logger.warning(f"RAG retrieval failed for '{query}': {rag_err}")

        context_snippets = "\n\n".join(
            f'[{c["paper_id"]}] {c["text"][:300]}' for c in chunks
        )
        supporting_papers = list({c["paper_id"] for c in chunks if isinstance(c, dict) and c.get("title")})

        # Build grounded LLM prompt
        method_paper_list = "; ".join(method_papers[:5]) if method_papers else "none found"
        domain_paper_list = "; ".join(domain_papers[:5]) if domain_papers else "none found"

        user_prompt = f"""Research Gap to explain:
- Method: {gap.method} (used in {gap.method_frequency} papers, e.g., {method_paper_list})
- Domain: {gap.domain} (studied in {gap.domain_frequency} papers, e.g., {domain_paper_list})

Relevant context from the corpus:
{context_snippets or "No directly relevant chunks found, reason from the paper list above."}

Write a 2-3 sentence research opportunity statement explaining why combining {gap.method} with {gap.domain} is valuable and unexplored."""

        try:
            suggestion_text = await complete(
                system=_SUGGEST_SYSTEM,
                user=user_prompt,
                max_tokens=300,
            )
        except Exception as e:
            suggestion_text = (
                f"No LLM explanation available ({e}). "
                f"Gap: {gap.method} has not been applied to {gap.domain} in the current corpus."
            )

        clean_suggestion = suggestion_text.strip()

        # Persist proposal record in SQLite
        await proposal_service.create_or_get_proposal(
            method=gap.method,
            domain=gap.domain,
            suggestion=clean_suggestion,
            supporting_papers=supporting_papers[:5],
        )

        suggestions.append(
            GapSuggestion(
                method=gap.method,
                domain=gap.domain,
                score=gap.score,
                suggestion=clean_suggestion,
                supporting_papers=supporting_papers[:5],
                method_papers=method_papers[:5],
                domain_papers=domain_papers[:5],
                evidence_papers=evidence_trail,
            )
        )

    return GapSuggestResponse(suggestions=suggestions)


@router.get("/validate")
async def validate_gap_external(
    method: str = Query(..., description="Method name"),
    domain: str = Query(..., description="Domain name")
):
    """Cross-check candidate gap against external arXiv API to detect global false positives."""
    try:
        return await gap_finder.check_external_gap_validation(method=method, domain=domain)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gap validation failed: {e}")


@router.post("/proposals/generate", response_model=ResearchProposal)
async def generate_proposal(
    method: str = Query(..., description="Method name"),
    domain: str = Query(..., description="Domain name"),
    suggestion: str = Query(default="", description="Optional suggestion text")
):
    """Generate or retrieve full research proposal blueprint for a gap."""
    try:
        return await proposal_service.create_or_get_proposal(
            method=method,
            domain=domain,
            suggestion=suggestion,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed generating proposal: {e}")


@router.get("/proposals/{id}", response_model=ResearchProposal)
async def get_proposal_by_id(id: str):
    """Retrieve existing proposal blueprint and cached polish status by ID."""
    try:
        prop = await proposal_service.get_proposal(id)
        if not prop:
            # Fallback parse ID into method/domain
            parts = id.replace("prop_", "").split("_")
            method = parts[0] if parts else "Method"
            domain = parts[1] if len(parts) > 1 else "Domain"
            prop = await proposal_service.create_or_get_proposal(method, domain)
        return prop
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed retrieving proposal: {e}")


@router.get("/proposals/{id}/stream")
async def stream_proposal_draft(id: str):
    """Stream token-by-token real-time proposal expansion using SSE."""
    prop = await proposal_service.get_proposal(id)
    if not prop:
        parts = id.replace("prop_", "").split("_")
        method = parts[0] if parts else "Method"
        domain = parts[1] if len(parts) > 1 else "Domain"
        prop = await proposal_service.create_or_get_proposal(method, domain)

    prompt = f"Elaborate an in-depth academic methodology blueprint and hypothesis for combining {prop.method} with {prop.domain}."
    return StreamingResponse(
        llm_client.stream_generate(prompt, system_instruction="You are an expert AI scientific proposal writer."),
        media_type="text/event-stream"
    )


@router.post("/proposals/{id}/polish", response_model=ProposalPolishResponse)
async def polish_proposal_endpoint(id: str):
    """
    Run 3 LLM sub-passes on an existing proposal:
    1. Academic Tone Pass (Problem Statement & Expected Contributions diffs)
    2. Citation-Need Flagging (Scan claims, search ChromaDB)
    3. Title Variant Generator (3 alternative titles with rationales)
    Caches result alongside proposal record.
    """
    try:
        return await proposal_service.polish_proposal(id)
    except Exception as e:
        logger.error(f"Proposal polish failed for {id}: {e}")
        raise HTTPException(status_code=500, detail=f"Proposal polish error: {e}")


@router.get("/proposals/{id}/export")
async def export_proposal_pdf(id: str):
    """
    Export the research proposal as a downloadable PDF using reportlab.
    Returns the PDF as a streaming response for immediate browser download.
    """
    from fastapi.responses import StreamingResponse
    import io

    prop = await proposal_service.get_proposal(id)
    if not prop:
        raise HTTPException(status_code=404, detail=f"Proposal '{id}' not found")

    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib.units import cm
        from reportlab.lib import colors
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, HRFlowable, ListFlowable, ListItem
        from reportlab.lib.enums import TA_CENTER, TA_LEFT

        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            rightMargin=2.5 * cm,
            leftMargin=2.5 * cm,
            topMargin=2.5 * cm,
            bottomMargin=2.5 * cm,
        )

        styles = getSampleStyleSheet()
        style_title = ParagraphStyle(
            "ProposalTitle",
            parent=styles["Title"],
            fontSize=20,
            leading=24,
            textColor=colors.HexColor("#1a1a2e"),
            spaceAfter=6,
        )
        style_subtitle = ParagraphStyle(
            "ProposalSubtitle",
            parent=styles["Normal"],
            fontSize=12,
            textColor=colors.HexColor("#555555"),
            spaceAfter=20,
            alignment=TA_CENTER,
        )
        style_heading = ParagraphStyle(
            "SectionHeading",
            parent=styles["Heading2"],
            fontSize=13,
            textColor=colors.HexColor("#6172f3"),
            spaceBefore=16,
            spaceAfter=6,
        )
        style_body = ParagraphStyle(
            "BodyText",
            parent=styles["Normal"],
            fontSize=10,
            leading=15,
            spaceAfter=8,
        )
        style_bullet = ParagraphStyle(
            "BulletText",
            parent=styles["Normal"],
            fontSize=10,
            leading=14,
            leftIndent=20,
            spaceAfter=4,
        )

        story = []

        # Title page
        story.append(Paragraph(prop.title or f"{prop.method} in {prop.domain}", style_title))
        story.append(Paragraph(f"Research Gap Proposal: {prop.method} × {prop.domain}", style_subtitle))
        story.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor("#6172f3")))
        story.append(Spacer(1, 20))

        sections = [
            ("Problem Statement", prop.problem_statement),
            ("Hypothesis", prop.hypothesis),
            ("Expected Contributions", prop.expected_contributions),
            ("Literature Justification", prop.literature_justification),
        ]

        import html
        for heading, body in sections:
            if body:
                safe_heading = html.escape(heading)
                safe_body = html.escape(body).replace("\n", "<br/>")
                story.append(Paragraph(safe_heading, style_heading))
                story.append(Paragraph(safe_body, style_body))

        # Methodology Blueprint (bulleted list)
        if prop.methodology_blueprint:
            story.append(Paragraph("Methodology Blueprint", style_heading))
            for step in prop.methodology_blueprint:
                story.append(Paragraph(f"• {html.escape(str(step))}", style_bullet))

        # Citation Seeds
        if prop.citation_seeds:
            story.append(Paragraph("Key References & Citation Seeds", style_heading))
            for seed in prop.citation_seeds:
                story.append(Paragraph(f"• {html.escape(str(seed))}", style_bullet))

        story.append(Spacer(1, 30))
        story.append(HRFlowable(width="100%", thickness=0.5, color=colors.grey))
        story.append(Paragraph("Generated by ResearchGap AI — Automatic Research Gap Discovery Engine", style_subtitle))

        doc.build(story)
        buffer.seek(0)

        safe_title = (prop.title or f"{prop.method}_{prop.domain}").replace(" ", "_")[:60]
        filename = f"proposal_{safe_title}.pdf"

        return StreamingResponse(
            buffer,
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )

    except ImportError:
        raise HTTPException(
            status_code=500,
            detail="reportlab is not installed. Run: pip install reportlab",
        )
    except Exception as e:
        logger.error(f"PDF export failed for proposal {id}: {e}")
        raise HTTPException(status_code=500, detail=f"PDF export error: {e}")


@router.get("/proposals/{id}/export/markdown")
async def export_proposal_markdown(id: str):
    """Export the research proposal blueprint as clean Markdown text."""
    prop = await proposal_service.get_proposal(id)
    if not prop:
        raise HTTPException(status_code=404, detail=f"Proposal '{id}' not found")

    md_lines = [
        f"# {prop.title or f'{prop.method} in {prop.domain}'}",
        f"**Research Gap Proposal**: `{prop.method}` × `{prop.domain}`",
        "\n---\n",
        "## Problem Statement",
        prop.problem_statement or "",
        "\n## Hypothesis",
        prop.hypothesis or "",
        "\n## Methodology Blueprint",
    ]
    for step in (prop.methodology_blueprint or []):
        md_lines.append(f"- {step}")

    md_lines.extend([
        "\n## Expected Contributions",
        prop.expected_contributions or "",
        "\n## Literature Justification",
        prop.literature_justification or "",
        "\n## Citation Seeds",
    ])
    for seed in (prop.citation_seeds or []):
        md_lines.append(f"- {seed}")

    md_lines.extend(["\n---", "*Generated by ResearchGap AI*"])
    md_content = "\n".join(md_lines)

    import io
    from fastapi.responses import StreamingResponse
    safe_title = (prop.title or f"{prop.method}_{prop.domain}").replace(" ", "_")[:60]
    filename = f"proposal_{safe_title}.md"
    return StreamingResponse(
        io.BytesIO(md_content.encode("utf-8")),
        media_type="text/markdown",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )


@router.get("/proposals/{id}/export/latex")
async def export_proposal_latex(id: str):
    """Export the research proposal blueprint as formatted LaTeX document."""
    prop = await proposal_service.get_proposal(id)
    if not prop:
        raise HTTPException(status_code=404, detail=f"Proposal '{id}' not found")

    def sanitize_tex(t: str) -> str:
        if not t:
            return ""
        return t.replace("&", "\\&").replace("%", "\\%").replace("#", "\\#").replace("_", "\\_")

    methodology_items = "\n".join([f"  \\item {sanitize_tex(str(item))}" for item in (prop.methodology_blueprint or [])])
    citation_items = "\n".join([f"  \\item {sanitize_tex(str(item))}" for item in (prop.citation_seeds or [])])

    tex_content = f"""\\documentclass{{article}}
\\usepackage[utf8]{{inputenc}}
\\usepackage{{geometry}}
\\geometry{{a4paper, margin=1in}}
\\usepackage{{hyperref}}

\\title{{{sanitize_tex(prop.title or f"{prop.method} in {prop.domain}")}}}
\\author{{ResearchGap AI Discovery Engine}}
\\date{{\\today}}

\\begin{{document}}
\\maketitle

\\section*{{Research Gap}}
\\textbf{{Method:}} {sanitize_tex(prop.method)} \\\\
\\textbf{{Domain:}} {sanitize_tex(prop.domain)}

\\section{{Problem Statement}}
{sanitize_tex(prop.problem_statement)}

\\section{{Hypothesis}}
{sanitize_tex(prop.hypothesis)}

\\section{{Methodology Blueprint}}
\\begin{{itemize}}
{methodology_items}
\\end{{itemize}}

\\section{{Expected Contributions}}
{sanitize_tex(prop.expected_contributions)}

\\section{{Literature Justification}}
{sanitize_tex(prop.literature_justification)}

\\section{{Citation Seeds}}
\\begin{{itemize}}
{citation_items}
\\end{{itemize}}

\\end{{document}}
"""

    import io
    from fastapi.responses import StreamingResponse
    safe_title = (prop.title or f"{prop.method}_{prop.domain}").replace(" ", "_")[:60]
    filename = f"proposal_{safe_title}.tex"
    return StreamingResponse(
        io.BytesIO(tex_content.encode("utf-8")),
        media_type="application/x-latex",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )



