"""
Paper Analysis and Comparison Service.
Provides single-paper deep analysis and two-paper comparison powered by RAG + Gemini LLM.
"""
from __future__ import annotations

import json
import logging
import sqlite3
import datetime
from fastapi import HTTPException
from app.core.claude_client import complete
from app.core.project import get_sqlite_db_path
from app.services import graph_builder, rag, gap_finder


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


async def analyze_paper(paper_id: str) -> dict:
    """
    Generate or return cached LLM analytical breakdown for a single paper.
    """
    db_path = get_sqlite_db_path()
    db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # Ensure table exists
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS paper_analyses (
            paper_id TEXT PRIMARY KEY,
            analysis_json TEXT,
            created_at TEXT
        )
    """)
    conn.commit()

    # 1. Check cache first
    cursor.execute("SELECT analysis_json FROM paper_analyses WHERE paper_id = ?", (paper_id,))
    row = cursor.fetchone()
    if row and row[0]:
        try:
            cached_data = json.loads(row[0])
            conn.close()
            logger.info(f"Retrieved cached paper analysis for {paper_id}")
            return cached_data
        except Exception as e:
            logger.warning(f"Failed to parse cached analysis for {paper_id}: {e}")

    # 2. Fetch paper node detail
    paper = await graph_builder.get_node_detail(paper_id, "Paper")
    if not paper or not paper.get("id"):
        conn.close()
        raise HTTPException(status_code=404, detail="Paper not found")

    # 3. Retrieve RAG text chunks from ChromaDB
    try:
        col = rag._get_collection()
        existing = col.get(where={"paper_id": paper_id}, include=["documents"])
        chunks = existing.get("documents", []) if existing else []
    except Exception as e:
        logger.warning(f"RAG lookup error for {paper_id}: {e}")
        chunks = []

    context_text = "\n---\n".join(chunks[:5]) if chunks else "Full text unavailable; relying on extracted metadata."

    # 4. Fetch project gap context
    try:
        gaps_res = await gap_finder.analyze_gaps(top_n=10)
        top_gaps = gaps_res.get("top_gaps", [])
        gaps_str = ", ".join([f"{g.method} × {g.domain}" for g in top_gaps[:6]]) if top_gaps else "None identified yet."
    except Exception:
        gaps_str = "None available."

    # 5. Build LLM prompt
    title = paper.get("title", "Untitled Paper")
    methods = ", ".join(paper.get("methods", [])) or "None extracted"
    domains = ", ".join(paper.get("domains", [])) or "None extracted"
    datasets = ", ".join(paper.get("datasets", [])) or "None extracted"
    results = json.dumps(paper.get("results", []))

    system_prompt = (
        "You are an expert AI research scientist. Produce a rigorous, structured analytical breakdown of the "
        "given paper using its metadata, RAG text chunks, and corpus research gap context. "
        "Output ONLY valid JSON without markdown wrapping."
    )

    user_prompt = f"""
Paper Title: {title}
Year: {paper.get('year', 'Unknown')}
Authors: {', '.join(paper.get('authors', []))}
Extracted Methods: {methods}
Extracted Domains: {domains}
Extracted Datasets: {datasets}
Reported Results: {results}

Corpus Research Gaps:
{gaps_str}

Paper RAG Chunks:
{context_text}

Generate a JSON object with EXACTLY the following keys:
{{
  "summary": "3-5 sentences summarizing the core problem, approach, and findings in plain language.",
  "key_contributions": ["List of main scientific or technical contributions"],
  "incremental_aspects": ["List of incremental improvements or minor modifications"],
  "strengths": ["Methodology strengths"],
  "weaknesses": ["Methodology limitations, missing baselines, or evaluation weaknesses"],
  "gap_relation": "Detailed explanation of how this paper's methods and domains relate to the identified corpus research gaps.",
  "followup_questions": ["3-4 concrete, insightful follow-up research questions a scientist should ask."]
}}
"""

    try:
        raw_llm_resp = await complete(system_prompt, user_prompt, max_tokens=2048)
        clean_json = _clean_json_string(raw_llm_resp)
        analysis_dict = json.loads(clean_json)
    except Exception as e:
        logger.error(f"LLM paper analysis generation failed for {paper_id}: {e}")
        # Fallback structured response
        analysis_dict = {
            "summary": f"This paper ({title}) addresses research challenges in {domains}. It employs methods such as {methods}.",
            "key_contributions": [f"Integration of {methods} in {domains}"],
            "incremental_aspects": ["Standard architectural adaptation to domain-specific datasets."],
            "strengths": ["Clear problem formulation", "Extracted empirical evaluations"],
            "weaknesses": ["Limited cross-domain generalizability evaluation"],
            "gap_relation": f"Extends applications in {domains} using {methods}.",
            "followup_questions": [
                f"How well does {methods} generalize to unobserved domains?",
                "What are the primary performance bottlenecks under extreme dataset distribution shifts?"
            ]
        }

    # 6. Cache analysis in SQLite
    now_str = datetime.datetime.utcnow().isoformat()
    cursor.execute(
        "INSERT OR REPLACE INTO paper_analyses (paper_id, analysis_json, created_at) VALUES (?, ?, ?)",
        (paper_id, json.dumps(analysis_dict), now_str)
    )
    conn.commit()
    conn.close()

    logger.info(f"Generated and cached deep paper analysis for {paper_id}")
    return analysis_dict


async def compare_papers(paper_id_a: str, paper_id_b: str) -> dict:
    """
    Compare two papers side-by-side using taxonomy overlap + RAG + LLM analysis.
    """
    if paper_id_a == paper_id_b:
        raise HTTPException(status_code=400, detail="Please select two distinct papers to compare.")

    paper_a = await graph_builder.get_node_detail(paper_id_a, "Paper")
    paper_b = await graph_builder.get_node_detail(paper_id_b, "Paper")

    if not paper_a or not paper_a.get("id"):
        raise HTTPException(status_code=404, detail=f"Paper '{paper_id_a}' not found")
    if not paper_b or not paper_b.get("id"):
        raise HTTPException(status_code=404, detail=f"Paper '{paper_id_b}' not found")

    # Direct taxonomy overlap
    methods_a = set(paper_a.get("methods", []))
    methods_b = set(paper_b.get("methods", []))
    shared_methods = list(methods_a & methods_b)

    domains_a = set(paper_a.get("domains", []))
    domains_b = set(paper_b.get("domains", []))
    shared_domains = list(domains_a & domains_b)

    datasets_a = set(paper_a.get("datasets", []))
    datasets_b = set(paper_b.get("datasets", []))
    shared_datasets = list(datasets_a & datasets_b)

    # Retrieve RAG text for both papers
    def get_chunks(pid: str) -> str:
        try:
            col = rag._get_collection()
            existing = col.get(where={"paper_id": pid}, include=["documents"])
            d = existing.get("documents", []) if existing else []
            return "\n---\n".join(d[:3]) if d else "Chunks unavailable."
        except Exception:
            return "Chunks unavailable."

    chunks_a = get_chunks(paper_id_a)
    chunks_b = get_chunks(paper_id_b)

    system_prompt = (
        "You are an expert AI literature review engine. Compare two scientific papers side-by-side. "
        "Analyze technical overlaps, methodological divergences, performance results, and potential complementary synergies. "
        "Output ONLY valid JSON without markdown code fences."
    )

    user_prompt = f"""
--- PAPER A ---
Title: {paper_a.get('title')}
Year: {paper_a.get('year')}
Methods: {', '.join(paper_a.get('methods', []))}
Domains: {', '.join(paper_a.get('domains', []))}
Datasets: {', '.join(paper_a.get('datasets', []))}
Results: {json.dumps(paper_a.get('results', []))}
RAG Sample: {chunks_a}

--- PAPER B ---
Title: {paper_b.get('title')}
Year: {paper_b.get('year')}
Methods: {', '.join(paper_b.get('methods', []))}
Domains: {', '.join(paper_b.get('domains', []))}
Datasets: {', '.join(paper_b.get('datasets', []))}
Results: {json.dumps(paper_b.get('results', []))}
RAG Sample: {chunks_b}

--- DIRECT TAXONOMY OVERLAP ---
Shared Methods: {', '.join(shared_methods) or 'None'}
Shared Domains: {', '.join(shared_domains) or 'None'}
Shared Datasets: {', '.join(shared_datasets) or 'None'}

Generate a JSON object with EXACTLY the following structure:
{{
  "divergent_approaches": "Paragraph detailing how the two papers differ in problem formulation, algorithmic technique, or dataset focus.",
  "performance_comparison": "Paragraph comparing reported metrics, benchmark results, or empirical strengths of each paper.",
  "complementary_insights": "Paragraph proposing how techniques or domains from Paper A and Paper B could be combined into a novel research contribution.",
  "verdict": "Complementary" | "Redundant" | "Unrelated despite surface similarity",
  "verdict_rationale": "1-2 concise sentences justifying the verdict."
}}
"""

    try:
        raw_resp = await complete(system_prompt, user_prompt, max_tokens=1500)
        clean_json = _clean_json_string(raw_resp)
        llm_analysis = json.loads(clean_json)
    except Exception as e:
        logger.error(f"LLM paper comparison failed for {paper_id_a} vs {paper_id_b}: {e}")
        llm_analysis = {
            "divergent_approaches": f"Paper A focuses on {', '.join(paper_a.get('methods', [])) or 'method A'}, while Paper B utilizes {', '.join(paper_b.get('methods', [])) or 'method B'}.",
            "performance_comparison": "Both papers present empirical results on their respective benchmark datasets.",
            "complementary_insights": "Combining the methodology of Paper A with the application domain of Paper B could yield a promising hybrid approach.",
            "verdict": "Complementary" if shared_domains or shared_methods else "Unrelated despite surface similarity",
            "verdict_rationale": "The papers address overlapping subfields with distinct algorithmic strategies."
        }

    return {
        "paper_a": paper_a,
        "paper_b": paper_b,
        "direct_overlap": {
            "shared_methods": shared_methods,
            "shared_domains": shared_domains,
            "shared_datasets": shared_datasets,
        },
        "llm_analysis": llm_analysis,
    }
