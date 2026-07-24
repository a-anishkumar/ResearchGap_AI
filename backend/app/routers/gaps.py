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

        # RAG retrieval: gather relevant chunks for context
        query = f"{gap.method} applied to {gap.domain}"
        chunks = rag.retrieve(query, top_k=settings.rag_top_k)
        context_snippets = "\n\n".join(
            f'[{c["paper_id"]}] {c["text"][:300]}' for c in chunks
        )
        supporting_papers = list({c["paper_id"] for c in chunks if c.get("title")})

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



