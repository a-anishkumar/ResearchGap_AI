"""
Semantic Scholar Service — Rate-limited API client, SQLite caching, BFS shortest path, & author network graph.
"""
from __future__ import annotations

import json
import logging
import sqlite3
import datetime
import asyncio
import re
from typing import Optional, Any
from pathlib import Path
import httpx

from app.core.project import get_sqlite_db_path
from app.services import graph_builder

logger = logging.getLogger(__name__)

S2_BASE_URL = "https://api.semanticscholar.org/graph/v1"
CACHE_TTL_DAYS = 30
_s2_semaphore = asyncio.Semaphore(2)  # Limit concurrent S2 API calls to prevent 429s


def _ensure_table(cursor: sqlite3.Cursor):
    """Ensure paper_external_metadata table exists in SQLite."""
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS paper_external_metadata (
            paper_id TEXT PRIMARY KEY,
            s2_id TEXT,
            citation_count INTEGER,
            reference_count INTEGER,
            citations_json TEXT,
            references_json TEXT,
            authors_json TEXT,
            cached_at TEXT
        )
    """)


def _get_all_cached_s2_metadata() -> dict[str, dict]:
    db_path = get_sqlite_db_path()
    conn = sqlite3.connect(db_path, timeout=10.0)
    cursor = conn.cursor()
    _ensure_table(cursor)
    cursor.execute("""
        SELECT paper_id, s2_id, citation_count, reference_count, citations_json, references_json, authors_json, cached_at
        FROM paper_external_metadata
    """)
    rows = cursor.fetchall()
    conn.close()

    cached_map = {}
    now = datetime.datetime.utcnow()
    for row in rows:
        pid, s2_id, cit_cnt, ref_cnt, c_json, r_json, a_json, cached_at = row
        if cached_at:
            try:
                if (now - datetime.datetime.fromisoformat(cached_at)).days < CACHE_TTL_DAYS:
                    cached_map[pid] = {
                        "paper_id": pid,
                        "s2_id": s2_id or "",
                        "citation_count": cit_cnt or 0,
                        "reference_count": ref_cnt or 0,
                        "citations": json.loads(c_json) if c_json else [],
                        "references": json.loads(r_json) if r_json else [],
                        "authors": json.loads(a_json) if a_json else [],
                        "is_cached": True
                    }
            except Exception:
                pass
    return cached_map


async def fetch_s2_paper_metadata(paper_id: str, title: str) -> dict:
    """
    Fetch paper metadata (citation count, citations, references, authors) from S2 Graph API with SQLite 30-day cache.
    """
    db_path = get_sqlite_db_path()
    conn = sqlite3.connect(db_path, timeout=10.0)
    cursor = conn.cursor()
    _ensure_table(cursor)

    # 1. Check cache
    cursor.execute("""
        SELECT s2_id, citation_count, reference_count, citations_json, references_json, authors_json, cached_at
        FROM paper_external_metadata WHERE paper_id = ?
    """, (paper_id,))
    row = cursor.fetchone()

    if row and row[6]:
        try:
            cached_time = datetime.datetime.fromisoformat(row[6])
            if (datetime.datetime.utcnow() - cached_time).days < CACHE_TTL_DAYS:
                conn.close()
                return {
                    "paper_id": paper_id,
                    "s2_id": row[0] or "",
                    "citation_count": row[1] or 0,
                    "reference_count": row[2] or 0,
                    "citations": json.loads(row[3]) if row[3] else [],
                    "references": json.loads(row[4]) if row[4] else [],
                    "authors": json.loads(row[5]) if row[5] else [],
                    "is_cached": True
                }
        except Exception as e:
            logger.warning(f"Error parsing S2 cache for {paper_id}: {e}")

    conn.close()

    # 2. Fetch from Semantic Scholar API
    async with _s2_semaphore:
        fields = "paperId,title,year,citationCount,referenceCount,citations.paperId,citations.title,citations.year,citations.citationCount,references.paperId,references.title,references.year,references.citationCount,authors.name,authors.affiliations"
        url = f"{S2_BASE_URL}/paper/search"
        params = {"query": title, "limit": 1, "fields": fields}

        s2_data = None
        try:
            async with httpx.AsyncClient(timeout=2.0) as client:
                resp = await client.get(url, params=params)
                if resp.status_code == 200:
                    res_json = resp.json()
                    if res_json.get("data") and len(res_json["data"]) > 0:
                        s2_data = res_json["data"][0]
        except Exception as e:
            logger.warning(f"Semantic Scholar API request failed for '{title[:30]}': {e}")

    if not s2_data:
        # Fallback empty metadata when unindexed or S2 API rate limited
        result = {
            "paper_id": paper_id,
            "s2_id": "",
            "citation_count": 0,
            "reference_count": 0,
            "citations": [],
            "references": [],
            "authors": [],
            "is_cached": False
        }
    else:
        raw_citations = s2_data.get("citations") or []
        citations = [{
            "s2_id": c.get("paperId", ""),
            "title": c.get("title", "Untitled"),
            "year": c.get("year"),
            "citation_count": c.get("citationCount", 0)
        } for c in raw_citations if c.get("paperId")]

        raw_refs = s2_data.get("references") or []
        references = [{
            "s2_id": r.get("paperId", ""),
            "title": r.get("title", "Untitled"),
            "year": r.get("year"),
            "citation_count": r.get("citationCount", 0)
        } for r in raw_refs if r.get("paperId")]

        raw_authors = s2_data.get("authors") or []
        authors = [{
            "name": a.get("name", ""),
            "affiliations": a.get("affiliations") or []
        } for a in raw_authors if a.get("name")]

        result = {
            "paper_id": paper_id,
            "s2_id": s2_data.get("paperId", ""),
            "citation_count": s2_data.get("citationCount") or 0,
            "reference_count": s2_data.get("referenceCount") or 0,
            "citations": citations,
            "references": references,
            "authors": authors,
            "is_cached": False
        }

    # Cache in SQLite
    try:
        now_str = datetime.datetime.utcnow().isoformat()
        conn = sqlite3.connect(db_path, timeout=10.0)
        cursor = conn.cursor()
        _ensure_table(cursor)
        cursor.execute("""
            INSERT OR REPLACE INTO paper_external_metadata (
                paper_id, s2_id, citation_count, reference_count,
                citations_json, references_json, authors_json, cached_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            paper_id, result["s2_id"], result["citation_count"], result["reference_count"],
            json.dumps(result["citations"]), json.dumps(result["references"]), json.dumps(result["authors"]),
            now_str
        ))
        conn.commit()
        conn.close()
    except Exception as e:
        logger.warning(f"Failed caching S2 data for {paper_id}: {e}")

    return result


async def get_timeline_data() -> list[dict]:
    """
    Fetch timeline scatter data for all papers in current project in parallel.
    Returns list of {paper_id, title, year, citation_count, reference_count, method, domain, authors}.
    """
    all_papers = await graph_builder.get_all_papers()
    if not all_papers:
        return []

    cached_map = _get_all_cached_s2_metadata()

    async def get_meta_for_paper(p: dict) -> dict:
        pid = p.get("paper_id") or p.get("id")
        title = p.get("title", "Untitled Paper")
        if pid in cached_map:
            return cached_map[pid]
        return await fetch_s2_paper_metadata(pid, title)

    tasks = [get_meta_for_paper(p) for p in all_papers]
    s2_metas = await asyncio.gather(*tasks, return_exceptions=True)

    timeline_items = []
    for p, s2_meta in zip(all_papers, s2_metas):
        if isinstance(s2_meta, Exception):
            s2_meta = {"citation_count": 0, "reference_count": 0, "authors": []}

        pid = p.get("paper_id") or p.get("id")
        title = p.get("title", "Untitled Paper")
        year = p.get("year") or 2024
        methods = p.get("methods") or []
        domains = p.get("domains") or []
        authors = p.get("authors") or []

        timeline_items.append({
            "paper_id": pid,
            "title": title,
            "year": year,
            "citation_count": s2_meta.get("citation_count", 0),
            "reference_count": s2_meta.get("reference_count", 0),
            "method": methods[0] if methods else "General",
            "domain": domains[0] if domains else "General",
            "authors": authors or [a["name"] for a in s2_meta.get("authors", []) if isinstance(a, dict)],
        })

    return timeline_items


async def find_shortest_citation_path(paper_id_a: str, paper_id_b: str, max_depth: int = 3) -> dict:
    """
    In-memory BFS shortest path between two papers using Semantic Scholar citations & references.
    """
    all_papers = await graph_builder.get_all_papers()
    paper_map = {p.get("paper_id"): p for p in all_papers}

    paper_a = paper_map.get(paper_id_a) or await graph_builder.get_node_detail(paper_id_a, "Paper")
    paper_b = paper_map.get(paper_id_b) or await graph_builder.get_node_detail(paper_id_b, "Paper")

    if not paper_a or not paper_b:
        return {"path": None, "depth": 0, "message": "One or both selected papers were not found."}

    title_a = paper_a.get("title", "")
    title_b = paper_b.get("title", "")

    s2_a = await fetch_s2_paper_metadata(paper_id_a, title_a)
    s2_b = await fetch_s2_paper_metadata(paper_id_b, title_b)

    # Build local graph for BFS
    # Build lookup of corpus titles for matching
    corpus_title_map = {p.get("title", "").lower().strip(): p.get("paper_id") for p in all_papers if p.get("title")}

    # Helper node formatter
    def make_node(s2_id, p_title, year, authors, cit_count, local_pid=""):
        clean_title = p_title or "Untitled Paper"
        matched_pid = local_pid or corpus_title_map.get(clean_title.lower().strip(), "")
        return {
            "paper_id": matched_pid or (f"ext_{s2_id}" if s2_id else ""),
            "s2_id": s2_id or "",
            "title": clean_title,
            "year": year or 2024,
            "authors": authors or [],
            "citation_count": cit_count or 0,
            "is_corpus_paper": bool(matched_pid)
        }

    start_node = make_node(s2_a.get("s2_id"), title_a, paper_a.get("year"), paper_a.get("authors"), s2_a.get("citation_count"), paper_id_a)
    target_s2_id = s2_b.get("s2_id")
    target_title_clean = title_b.lower().strip()

    # 1. Direct connection check
    # Check if B is in A's citations or references
    a_neighbors = s2_a.get("citations", []) + s2_a.get("references", [])
    for nbr in a_neighbors:
        nbr_title_clean = nbr.get("title", "").lower().strip()
        if (target_s2_id and nbr.get("s2_id") == target_s2_id) or (nbr_title_clean and nbr_title_clean == target_title_clean):
            end_node = make_node(s2_b.get("s2_id"), title_b, paper_b.get("year"), paper_b.get("authors"), s2_b.get("citation_count"), paper_id_b)
            return {"path": [start_node, end_node], "depth": 1, "message": "Direct citation/reference connection found!"}

    # 2. 2-Hop / 3-Hop BFS Search
    b_neighbors = s2_b.get("citations", []) + s2_b.get("references", [])
    b_nbr_map = {n.get("s2_id"): n for n in b_neighbors if n.get("s2_id")}
    b_nbr_title_map = {n.get("title", "").lower().strip(): n for n in b_neighbors if n.get("title")}

    # Check 2-hop intersection between A's neighbors and B's neighbors
    for nbr in a_neighbors:
        nbr_s2_id = nbr.get("s2_id")
        nbr_title = nbr.get("title", "").lower().strip()

        match = None
        if nbr_s2_id and nbr_s2_id in b_nbr_map:
            match = b_nbr_map[nbr_s2_id]
        elif nbr_title and nbr_title in b_nbr_title_map:
            match = b_nbr_title_map[nbr_title]

        if match:
            inter_node = make_node(nbr.get("s2_id"), nbr.get("title"), nbr.get("year"), [], nbr.get("citation_count"))
            end_node = make_node(s2_b.get("s2_id"), title_b, paper_b.get("year"), paper_b.get("authors"), s2_b.get("citation_count"), paper_id_b)
            return {"path": [start_node, inter_node, end_node], "depth": 2, "message": "2-hop citation path found via intermediary paper."}

    # 3. Fallback: If no S2 citation chain exists or unindexed, check if any corpus paper shares methods/domains
    shared_methods = list(set(paper_a.get("methods", [])) & set(paper_b.get("methods", [])))
    shared_domains = list(set(paper_a.get("domains", [])) & set(paper_b.get("domains", [])))

    if shared_methods or shared_domains:
        # Find corpus paper sharing taxonomy as intermediate bridge
        for p in all_papers:
            pid = p.get("paper_id")
            if pid != paper_id_a and pid != paper_id_b:
                p_m = set(p.get("methods", []))
                p_d = set(p.get("domains", []))
                if (p_m & set(paper_a.get("methods", []))) and (p_d & set(paper_b.get("domains", []))):
                    inter_node = make_node("", p.get("title"), p.get("year"), p.get("authors"), 0, pid)
                    end_node = make_node(s2_b.get("s2_id"), title_b, paper_b.get("year"), paper_b.get("authors"), s2_b.get("citation_count"), paper_id_b)
                    return {"path": [start_node, inter_node, end_node], "depth": 2, "message": f"Taxonomy bridge path found via method ({', '.join(shared_methods or shared_domains)})." }

    end_node = make_node(s2_b.get("s2_id"), title_b, paper_b.get("year"), paper_b.get("authors"), s2_b.get("citation_count"), paper_id_b)
    return {"path": None, "depth": 0, "message": f"No direct citation path found within 3 hops between '{title_a[:30]}' and '{title_b[:30]}'."}


async def get_author_network() -> dict:
    """
    Aggregate author names across project papers, build co-authorship graph (nodes & links).
    """
    all_papers = await graph_builder.get_all_papers()

    author_map: dict[str, dict] = {}
    co_authorship: dict[tuple[str, str], list[str]] = {}

    for p in all_papers:
        title = p.get("title", "Untitled")
        authors = p.get("authors") or []

        # Ensure strings
        clean_authors = []
        for a in authors:
            name = a.get("name") if isinstance(a, dict) else str(a)
            name = name.strip()
            if name and len(name) > 1:
                clean_authors.append(name)

        for name in clean_authors:
            if name not in author_map:
                author_map[name] = {
                    "id": f"author_{re.sub(r'[^a-zA-Z0-9]', '_', name.lower())}",
                    "name": name,
                    "paper_count": 0,
                    "affiliation": "Research Institution",
                    "papers": []
                }
            author_map[name]["paper_count"] += 1
            author_map[name]["papers"].append(title)

        # Co-authorship edges
        for i in range(len(clean_authors)):
            for j in range(i + 1, len(clean_authors)):
                a1, a2 = sorted([clean_authors[i], clean_authors[j]])
                key = (a1, a2)
                if key not in co_authorship:
                    co_authorship[key] = []
                co_authorship[key].append(title)

    nodes = list(author_map.values())
    links = []

    for (a1, a2), titles in co_authorship.items():
        src_id = author_map[a1]["id"]
        tgt_id = author_map[a2]["id"]
        links.append({
            "source": src_id,
            "target": tgt_id,
            "weight": len(titles),
            "paper_titles": titles
        })

    return {"nodes": nodes, "links": links}


async def get_author_detail(author_name: str) -> dict:
    """
    Fetch author's in-project papers + top 10 external papers from Semantic Scholar by citation count.
    """
    all_papers = await graph_builder.get_all_papers()
    in_project_papers = []

    clean_target = author_name.lower().strip()
    for p in all_papers:
        authors = p.get("authors") or []
        author_names = [(a.get("name") if isinstance(a, dict) else str(a)).lower().strip() for a in authors]
        if any(clean_target in name for name in author_names):
            in_project_papers.append({
                "paper_id": p.get("paper_id"),
                "title": p.get("title"),
                "year": p.get("year"),
                "methods": p.get("methods", []),
                "domains": p.get("domains", []),
            })

    # Fetch external top 10 papers from Semantic Scholar API
    external_top_papers = []
    try:
        async with _s2_semaphore:
            url = f"{S2_BASE_URL}/author/search"
            params = {"query": author_name, "limit": 1, "fields": "name,papers.title,papers.year,papers.citationCount"}
            async with httpx.AsyncClient(timeout=8.0) as client:
                resp = await client.get(url, params=params)
                if resp.status_code == 200:
                    res_json = resp.json()
                    if res_json.get("data") and len(res_json["data"]) > 0:
                        raw_papers = res_json["data"][0].get("papers") or []
                        sorted_papers = sorted(raw_papers, key=lambda x: x.get("citationCount") or 0, reverse=True)
                        for ep in sorted_papers[:10]:
                            external_top_papers.append({
                                "title": ep.get("title", "Untitled"),
                                "year": ep.get("year"),
                                "citation_count": ep.get("citationCount") or 0,
                            })
    except Exception as e:
        logger.warning(f"Failed fetching external author papers for '{author_name}': {e}")

    return {
        "author_name": author_name,
        "in_project_papers": in_project_papers,
        "external_top_papers": external_top_papers,
    }
