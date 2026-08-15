"""
Proposal Service — Manages RAG-grounded research proposal storage and 3-pass academic polish.
"""
from __future__ import annotations

import json
import logging
import re
import sqlite3
import datetime
from typing import Optional

from app.core.claude_client import complete
from app.core.project import get_sqlite_db_path
from app.models.schemas import (
    ResearchProposal,
    ProposalPolishResponse,
    PolishedSections,
    PolishedSection,
    CitationFlag,
    TitleVariant,
)
from app.services import rag, graph_builder

logger = logging.getLogger(__name__)


def _sanitize_id(text: str) -> str:
    """Sanitize text into safe string for ID key."""
    cleaned = re.sub(r"[^a-zA-Z0-9_]", "_", text.lower())
    return re.sub(r"_+", "_", cleaned).strip("_")


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


def _ensure_table(cursor: sqlite3.Cursor):
    """Ensure proposals table exists in SQLite database."""
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS proposals (
            id TEXT PRIMARY KEY,
            method TEXT,
            domain TEXT,
            title TEXT,
            problem_statement TEXT,
            hypothesis TEXT,
            methodology_blueprint TEXT,
            expected_contributions TEXT,
            literature_justification TEXT,
            citation_seeds TEXT,
            polish_json TEXT,
            created_at TEXT
        )
    """)


async def get_proposal(proposal_id: str) -> Optional[ResearchProposal]:
    """Retrieve proposal by ID from SQLite DB."""
    db_path = get_sqlite_db_path()
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    _ensure_table(cursor)

    cursor.execute("""
        SELECT id, method, domain, title, problem_statement, hypothesis,
               methodology_blueprint, expected_contributions, literature_justification,
               citation_seeds, polish_json
        FROM proposals WHERE id = ?
    """, (proposal_id,))
    row = cursor.fetchone()
    conn.close()

    if not row:
        return None

    (pid, method, domain, title, prob_stmt, hyp, meth_bp, exp_contrib, lit_just, cit_seeds, polish_json) = row

    polish_result = None
    if polish_json:
        try:
            polish_dict = json.loads(polish_json)
            polish_result = ProposalPolishResponse(**polish_dict)
        except Exception as e:
            logger.warning(f"Failed parsing cached polish result for proposal {proposal_id}: {e}")

    try:
        methodology_list = json.loads(meth_bp) if meth_bp else []
    except Exception:
        methodology_list = [meth_bp] if meth_bp else []

    try:
        seeds_list = json.loads(cit_seeds) if cit_seeds else []
    except Exception:
        seeds_list = [cit_seeds] if cit_seeds else []

    return ResearchProposal(
        id=pid,
        method=method or "",
        domain=domain or "",
        title=title or f"Applying {method} to {domain}",
        problem_statement=prob_stmt or "",
        hypothesis=hyp or "",
        methodology_blueprint=methodology_list,
        expected_contributions=exp_contrib or "",
        literature_justification=lit_just or "",
        citation_seeds=seeds_list,
        polish_result=polish_result,
    )


async def create_or_get_proposal(
    method: str,
    domain: str,
    suggestion: str = "",
    supporting_papers: list[str] | None = None
) -> ResearchProposal:
    """Create or retrieve a structured proposal blueprint for a given method × domain gap."""
    prop_id = f"prop_{_sanitize_id(method)}_{_sanitize_id(domain)}"
    existing = await get_proposal(prop_id)
    if existing:
        return existing

    # Generate proposal fields from suggestion or default template
    supporting_papers = supporting_papers or []
    title = f"Applying {method} to {domain}: A RAG-Grounded Framework"
    
    # Parse structured sections if suggestion text has bullet points
    prob_stmt = f"While {method} demonstrates strong empirical utility, its application to {domain} remains under-explored in current literature. This gap creates a critical opportunity to resolve domain-specific challenges."
    exp_contrib = f"1. Architectural integration of {method} adapted for {domain}.\n2. Empirical validation against standard benchmarks.\n3. Open-source implementation and reproducible pipeline."
    
    if suggestion:
        if "WHY THIS GAP EXISTS:" in suggestion:
            parts = suggestion.split("RESEARCH OPPORTUNITY:")
            prob_stmt = parts[0].replace("WHY THIS GAP EXISTS:", "").strip()
            if len(parts) > 1:
                exp_contrib = parts[1].strip()
        else:
            prob_stmt = suggestion.strip()

    hypothesis = f"Adapting the algorithmic primitives of {method} to the constraints and feature representations of {domain} will yield significant performance gains in accuracy, efficiency, and cross-domain generalization."
    
    methodology_blueprint = [
        f"Pipeline Formulation: Collect and preprocess benchmark datasets representative of {domain}.",
        f"Architectural Adaptation: Modify {method} to process domain-specific inputs and constraints.",
        f"Evaluation & Benchmarking: Compare performance against state-of-the-art baselines on key domain metrics.",
    ]

    seeds_str = ", ".join(supporting_papers[:3]) if supporting_papers else "Corpus Literature Base"
    literature_justification = f"This work builds on empirical foundations established in recent corpus studies including {seeds_str}."

    now_str = datetime.datetime.utcnow().isoformat()

    db_path = get_sqlite_db_path()
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    _ensure_table(cursor)

    cursor.execute("""
        INSERT OR REPLACE INTO proposals (
            id, method, domain, title, problem_statement, hypothesis,
            methodology_blueprint, expected_contributions, literature_justification,
            citation_seeds, polish_json, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        prop_id, method, domain, title, prob_stmt, hypothesis,
        json.dumps(methodology_blueprint), exp_contrib, literature_justification,
        json.dumps(supporting_papers), None, now_str
    ))
    conn.commit()
    conn.close()

    return ResearchProposal(
        id=prop_id,
        method=method,
        domain=domain,
        title=title,
        problem_statement=prob_stmt,
        hypothesis=hypothesis,
        methodology_blueprint=methodology_blueprint,
        expected_contributions=exp_contrib,
        literature_justification=literature_justification,
        citation_seeds=supporting_papers,
        polish_result=None,
    )


async def polish_proposal(proposal_id: str) -> ProposalPolishResponse:
    """
    Run 3 LLM sub-passes on an existing proposal:
    1. Academic Tone Pass (Problem Statement & Expected Contributions)
    2. Citation-Need Flagging (Scan claims, search ChromaDB for citations)
    3. Title Variant Generator (3 alternative titles with rationales)
    Caches result in SQLite proposals table.
    """
    db_path = get_sqlite_db_path()
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    _ensure_table(cursor)

    # Check cache first
    cursor.execute("SELECT polish_json FROM proposals WHERE id = ?", (proposal_id,))
    row = cursor.fetchone()
    if row and row[0]:
        try:
            cached_data = json.loads(row[0])
            conn.close()
            logger.info(f"Retrieved cached proposal polish result for {proposal_id}")
            return ProposalPolishResponse(**cached_data)
        except Exception as e:
            logger.warning(f"Failed loading cached polish_json for {proposal_id}: {e}")

    conn.close()

    # Get proposal
    proposal = await get_proposal(proposal_id)
    if not proposal:
        # Auto-create fallback proposal if missing
        parts = proposal_id.replace("prop_", "").split("_")
        method = parts[0] if parts else "Method"
        domain = parts[1] if len(parts) > 1 else "Domain"
        proposal = await create_or_get_proposal(method, domain)

    # ── Sub-Pass 1: Academic Tone Pass ─────────────────────────────────────────
    system_tone = (
        "You are an expert academic editor for top-tier peer-reviewed computer science and AI conferences (e.g. NeurIPS, ICML). "
        "Rewrite informal, passive, or conversational phrasing into formal, authoritative academic register. "
        "Preserve all original factual claims, methods, and technical details exactness. "
        "Output ONLY valid JSON with keys 'problem_statement' and 'expected_contributions'."
    )
    user_tone = f"""
Rewrite these two sections into formal academic prose:

SECTION 1 (Problem Statement):
{proposal.problem_statement}

SECTION 2 (Expected Contributions):
{proposal.expected_contributions}

Output JSON format:
{{
  "problem_statement": "polished formal text here",
  "expected_contributions": "polished formal text here"
}}
"""
    try:
        from app.services import llm_client
        class ToneResult(BaseModel):
            problem_statement: str
            expected_contributions: str

        tone_res = await llm_client.generate_structured(
            prompt=user_tone,
            schema_cls=ToneResult,
            system_instruction=system_tone,
            endpoint="proposal_polish_tone"
        )
        polished_prob = tone_res.problem_statement
        polished_exp = tone_res.expected_contributions
    except Exception as e:
        logger.warning(f"Sub-pass 1 (Tone) LLM error: {e}")
        polished_prob = proposal.problem_statement
        polished_exp = proposal.expected_contributions

    polished_sections = PolishedSections(
        problem_statement=PolishedSection(original=proposal.problem_statement, polished=polished_prob),
        expected_contributions=PolishedSection(original=proposal.expected_contributions, polished=polished_exp),
    )

    # ── Sub-Pass 2: Citation-Need Flagging ─────────────────────────────────────
    system_citation = (
        "You are an academic citation checker. Scan the provided proposal text for factual, comparative, or empirical claims "
        "that require academic citations (e.g., claims of performance superiority, state-of-the-art benchmarks, or specific method limitations). "
        "Ignore claims already backed by listed citation seeds. "
        "Return a JSON array of flagged items with keys 'sentence' and 'reason'."
    )
    combined_text = f"{polished_prob}\n\n{proposal.hypothesis}\n\n{polished_exp}"
    user_citation = f"""
Proposal Text:
{combined_text}

Known Citation Seeds: {', '.join(proposal.citation_seeds) or 'None listed'}

Identify up to 3 specific sentences making empirical or comparative claims that lack citations.
Output JSON array:
[
  {{ "sentence": "exact sentence from text", "reason": "why this claim requires a citation or softening" }}
]
"""
    citation_flags: list[CitationFlag] = []
    try:
        from app.services import llm_client
        class RawFlagItem(BaseModel):
            sentence: str
            reason: str

        class RawFlagList(BaseModel):
            flags: list[RawFlagItem] = []

        raw_cit_list = await llm_client.generate_structured(
            prompt=user_citation,
            schema_cls=RawFlagList,
            system_instruction=system_citation,
            endpoint="proposal_polish_citations"
        )
        for item in raw_cit_list.flags[:3]:
            sentence = item.sentence
            reason = item.reason
            if not sentence:
                continue

            rag_results = rag.retrieve(sentence, top_k=2)
            suggested_action = ""
            if rag_results and rag_results[0].get("title"):
                matched_title = rag_results[0]["title"]
                suggested_action = f"Cite corpus paper: [{matched_title}]"
            elif rag_results and rag_results[0].get("paper_id"):
                suggested_action = f"Cite corpus paper ID: [{rag_results[0]['paper_id']}]"
            else:
                suggested_action = f"Soften claim wording: Prefix sentence with 'Preliminary literature suggests that...'"

            citation_flags.append(CitationFlag(
                sentence=sentence,
                reason=reason,
                suggested_citation_or_softening=suggested_action
            ))
    except Exception as e:
        logger.warning(f"Sub-pass 2 (Citation Flagging) error: {e}")
        citation_flags.append(CitationFlag(
            sentence=f"The application of {proposal.method} to {proposal.domain} yields superior accuracy and generalizability.",
            reason="Comparative efficacy claim without explicit empirical citation seed.",
            suggested_citation_or_softening=f"Cite corpus paper or soften to 'Current literature indicates potential accuracy gains when applying {proposal.method}'."
        ))

    # ── Sub-Pass 3: Title Variant Generator ────────────────────────────────────
    system_title = (
        "You are an academic title generator for top AI research papers. Given a research proposal, generate 3 alternative title options "
        "ranked by clarity vs. specificity. Return a JSON array of 3 objects with keys 'title' and 'rationale'."
    )
    user_title = f"""
Original Title: {proposal.title}
Method: {proposal.method}
Domain: {proposal.domain}
Problem: {polished_prob[:300]}

Generate 3 title variants:
1. Highly Specific (technically descriptive)
2. High-Impact & Concise (focused on novelty)
3. Domain-Centric (framed around application impact)

Output JSON format:
[
  {{ "title": "Variant 1 Title", "rationale": "Why this title works" }},
  {{ "title": "Variant 2 Title", "rationale": "Why this title works" }},
  {{ "title": "Variant 3 Title", "rationale": "Why this title works" }}
]
"""
    title_variants: list[TitleVariant] = []
    try:
        from app.services import llm_client
        class TitleList(BaseModel):
            titles: list[TitleVariant] = []

        titles_res = await llm_client.generate_structured(
            prompt=user_title,
            schema_cls=TitleList,
            system_instruction=system_title,
            endpoint="proposal_polish_titles"
        )
        title_variants = titles_res.titles[:3]
    except Exception as e:
        logger.warning(f"Sub-pass 3 (Title Variants) error: {e}")

    if not title_variants:
        title_variants = [
            TitleVariant(title=f"Leveraging {proposal.method} for {proposal.domain}: A Systematic Exploration", rationale="Technically specific title highlighting systematic methodology."),
            TitleVariant(title=f"Beyond Traditional Boundaries: {proposal.method} in {proposal.domain}", rationale="Concise, high-impact phrasing focusing on domain novelty."),
            TitleVariant(title=f"Domain-Adaptive {proposal.method} Framework for {proposal.domain}", rationale="Framed around application impact and algorithmic adaptation.")
        ]

    response = ProposalPolishResponse(
        polished_sections=polished_sections,
        citation_flags=citation_flags,
        title_variants=title_variants,
    )

    # ── Cache result in SQLite ─────────────────────────────────────────────────
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        _ensure_table(cursor)
        cursor.execute(
            "UPDATE proposals SET polish_json = ? WHERE id = ?",
            (json.dumps(response.model_dump()), proposal_id)
        )
        conn.commit()
        conn.close()
        logger.info(f"Cached proposal polish result in SQLite for {proposal_id}")
    except Exception as e:
        logger.warning(f"Failed caching proposal polish in SQLite for {proposal_id}: {e}")

    return response


def export_proposal_latex(proposal: ResearchProposal) -> str:
    """Generate publication-ready LaTeX (.tex) template for a research proposal."""
    methodology_items = "\n".join([f"  \\item {step}" for step in proposal.methodology_blueprint])
    seeds_tex = "\n".join([f"  \\item {seed}" for seed in proposal.citation_seeds]) if proposal.citation_seeds else "  \\item Corpus Reference Base"

    prob_text = proposal.problem_statement
    exp_text = proposal.expected_contributions
    if proposal.polish_result and proposal.polish_result.polished_sections:
        prob_text = proposal.polish_result.polished_sections.problem_statement.polished
        exp_text = proposal.polish_result.polished_sections.expected_contributions.polished

    latex_content = f"""\\documentclass[11pt,a4paper]{{article}}
\\usepackage[utf8]{{utf8}}
\\usepackage{{amsmath,amssymb,amsfonts}}
\\usepackage{{hyperref}}
\\usepackage{{booktabs}}
\\usepackage[margin=1in]{{geometry}}

\\title{{\\textbf{{{proposal.title}}}}}
\\author{{\\textbf{{ResearchGap AI Generated Proposal Blueprint}}\\\\
Method: \\textit{{{proposal.method}}} \\quad|\\quad Domain: \\textit{{{proposal.domain}}}}}
\\date{{\\today}}

\\begin{{document}}

\\maketitle

\\begin{{abstract}}
This research proposal introduces a novel algorithmic synthesis applying \\textbf{{{proposal.method}}} to \\textbf{{{proposal.domain}}}. Built using topological knowledge graph discovery and literature RAG retrieval, this document presents the problem formulation, scientific hypothesis, methodology blueprint, and expected contributions.
\\end{{abstract}}

\\section{{1. Problem Formulation \\& Gap Statement}}
{prob_text}

\\section{{2. Research Hypothesis}}
{proposal.hypothesis}

\\section{{3. Proposed Methodology Blueprint}}
\\begin{{enumerate}}
{methodology_items}
\\end{{enumerate}}

\\section{{4. Expected Scientific Contributions}}
{exp_text}

\\section{{5. Literature Grounding \\& Citation Seeds}}
{proposal.literature_justification}

\\subsection*{{Corpus Reference Seeds}}
\\begin{{itemize}}
{seeds_tex}
\\end{{itemize}}

\\end{{document}}
"""
    return latex_content


def export_proposal_bibtex(proposal: ResearchProposal) -> str:
    """Generate BibTeX (.bib) file containing citation entries for the research proposal."""
    clean_method = re.sub(r"[^a-zA-Z0-9]", "", proposal.method)
    clean_domain = re.sub(r"[^a-zA-Z0-9]", "", proposal.domain)

    bib_entries = [
        f"""@article{{{clean_method}{clean_domain}2026,
  title     = {{{proposal.title}}},
  author    = {{ResearchGap AI Platform}},
  journal   = {{Automated Gap Discovery & Research Blueprints}},
  year      = {{2026}},
  note      = {{Method: {proposal.method}, Domain: {proposal.domain}}}
}}"""
    ]

    for i, seed in enumerate(proposal.citation_seeds):
        seed_id = re.sub(r"[^a-zA-Z0-9]", "", seed.split(":")[0] if ":" in seed else f"seed_{i+1}")
        bib_entries.append(
            f"""@misc{{{seed_id}2024,
  title     = {{{seed}}},
  author    = {{Corpus Author et al.}},
  year      = {{2024}},
  howpublished = {{ResearchGap Ingested Corpus}}
}}"""
        )

    return "\n\n".join(bib_entries)


def export_proposal_markdown(proposal: ResearchProposal) -> str:
    """Generate Markdown (.md) representation of the proposal."""
    prob_text = proposal.problem_statement
    exp_text = proposal.expected_contributions
    if proposal.polish_result and proposal.polish_result.polished_sections:
        prob_text = proposal.polish_result.polished_sections.problem_statement.polished
        exp_text = proposal.polish_result.polished_sections.expected_contributions.polished

    methodology_md = "\n".join([f"{i+1}. {step}" for i, step in enumerate(proposal.methodology_blueprint)])
    seeds_md = "\n".join([f"- {seed}" for seed in proposal.citation_seeds]) if proposal.citation_seeds else "- Corpus Literature Base"

    return f"""# {proposal.title}

**Method**: `{proposal.method}`  
**Domain**: `{proposal.domain}`  
**Generated by**: ResearchGap AI Engine  

---

## 1. Problem Formulation & Gap Statement
{prob_text}

## 2. Research Hypothesis
{proposal.hypothesis}

## 3. Methodology Blueprint
{methodology_md}

## 4. Expected Contributions
{exp_text}

## 5. Literature Grounding & Citation Seeds
{proposal.literature_justification}

### Corpus Reference Seeds
{seeds_md}
"""


def export_proposal_pdf(proposal: ResearchProposal) -> bytes:
    """Compile research proposal into a clean binary PDF document using ReportLab."""
    import io
    from reportlab.lib.pagesizes import letter
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, HRFlowable
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib import colors

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter, rightMargin=40, leftMargin=40, topMargin=40, bottomMargin=40)
    styles = getSampleStyleSheet()

    title_style = ParagraphStyle(
        "ProposalTitle",
        parent=styles["Title"],
        fontName="Helvetica-Bold",
        fontSize=18,
        leading=22,
        textColor=colors.HexColor("#1E293B"),
        alignment=0,
    )
    heading_style = ParagraphStyle(
        "ProposalHeading",
        parent=styles["Heading2"],
        fontName="Helvetica-Bold",
        fontSize=13,
        leading=16,
        textColor=colors.HexColor("#2563EB"),
        spaceBefore=12,
        spaceAfter=6,
    )
    body_style = ParagraphStyle(
        "ProposalBody",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=10,
        leading=14,
        textColor=colors.HexColor("#334155"),
        spaceAfter=8,
    )

    story = []
    story.append(Paragraph(proposal.title, title_style))
    story.append(Spacer(1, 6))
    story.append(Paragraph(f"<b>Method:</b> {proposal.method} | <b>Domain:</b> {proposal.domain}", body_style))
    story.append(Spacer(1, 8))
    story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#E2E8F0"), spaceAfter=12))

    prob_text = proposal.problem_statement
    exp_text = proposal.expected_contributions
    if proposal.polish_result and proposal.polish_result.polished_sections:
        prob_text = proposal.polish_result.polished_sections.problem_statement.polished
        exp_text = proposal.polish_result.polished_sections.expected_contributions.polished

    story.append(Paragraph("1. Problem Formulation & Gap Statement", heading_style))
    story.append(Paragraph(prob_text, body_style))

    story.append(Paragraph("2. Research Hypothesis", heading_style))
    story.append(Paragraph(proposal.hypothesis, body_style))

    story.append(Paragraph("3. Methodology Blueprint", heading_style))
    for i, step in enumerate(proposal.methodology_blueprint):
        story.append(Paragraph(f"<b>Step {i+1}:</b> {step}", body_style))

    story.append(Paragraph("4. Expected Scientific Contributions", heading_style))
    story.append(Paragraph(exp_text, body_style))

    story.append(Paragraph("5. Literature Grounding & Citation Seeds", heading_style))
    story.append(Paragraph(proposal.literature_justification, body_style))

    doc.build(story)
    return buffer.getvalue()
