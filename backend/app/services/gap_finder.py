"""
Gap analysis engine.
Computes cartesian(Method × Domain) - observed(Method × Domain) from Neo4j.
Ranks by independent frequency product.
"""
from __future__ import annotations

import logging
from app.core.neo4j_driver import run_query
from app.models.schemas import GapCandidate

logger = logging.getLogger(__name__)


async def get_observed_pairs() -> set[tuple[str, str]]:
    """Return (method, domain) pairs that co-occur in at least one paper."""
    rows = await run_query(
        """
        MATCH (p:Paper)-[:USES_METHOD]->(m:Method),
              (p:Paper)-[:APPLIES_TO_DOMAIN]->(d:Domain)
        RETURN DISTINCT m.name AS method, d.name AS domain
        """
    )
    return {(r["method"], r["domain"]) for r in rows}


async def get_method_frequencies() -> dict[str, int]:
    rows = await run_query(
        """
        MATCH (p:Paper)-[:USES_METHOD]->(m:Method)
        RETURN m.name AS method, count(p) AS freq
        ORDER BY freq DESC
        """
    )
    return {r["method"]: r["freq"] for r in rows}


async def get_domain_frequencies() -> dict[str, int]:
    rows = await run_query(
        """
        MATCH (p:Paper)-[:APPLIES_TO_DOMAIN]->(d:Domain)
        RETURN d.name AS domain, count(p) AS freq
        ORDER BY freq DESC
        """
    )
    return {r["domain"]: r["freq"] for r in rows}


async def get_papers_for_method(method: str) -> list[str]:
    rows = await run_query(
        """
        MATCH (p:Paper)-[:USES_METHOD]->(m:Method {name: $method})
        RETURN p.title AS title
        """,
        {"method": method},
    )
    return [r["title"] for r in rows]


async def get_papers_for_domain(domain: str) -> list[str]:
    rows = await run_query(
        """
        MATCH (p:Paper)-[:APPLIES_TO_DOMAIN]->(d:Domain {name: $domain})
        RETURN p.title AS title
        """,
        {"domain": domain},
    )
    return [r["title"] for r in rows]


async def get_papers_for_method_ids(method: str) -> list[dict]:
    """Return list of {paper_id, title} for papers using the given method."""
    rows = await run_query(
        """
        MATCH (p:Paper)-[:USES_METHOD]->(m:Method {name: $method})
        RETURN p.paper_id AS paper_id, p.title AS title
        """,
        {"method": method},
    )
    return [{"paper_id": r["paper_id"] or "", "title": r["title"] or ""} for r in rows]


async def get_papers_for_domain_ids(domain: str) -> list[dict]:
    """Return list of {paper_id, title} for papers in the given domain."""
    rows = await run_query(
        """
        MATCH (p:Paper)-[:APPLIES_TO_DOMAIN]->(d:Domain {name: $domain})
        RETURN p.paper_id AS paper_id, p.title AS title
        """,
        {"domain": domain},
    )
    return [{"paper_id": r["paper_id"] or "", "title": r["title"] or ""} for r in rows]


async def get_evidence_trail(method: str, domain: str) -> dict:
    """
    Compute the evidence trail for a gap:
      - method_only:  papers using the method but NOT in the domain
      - domain_only:  papers in the domain but NOT using the method
      (overlap would mean the gap is already filled, so we skip it)
    """
    method_papers = await get_papers_for_method_ids(method)
    domain_papers = await get_papers_for_domain_ids(domain)

    method_ids = {p["paper_id"] for p in method_papers if p["paper_id"]}
    domain_ids = {p["paper_id"] for p in domain_papers if p["paper_id"]}

    method_only = [p for p in method_papers if p["paper_id"] not in domain_ids]
    domain_only = [p for p in domain_papers if p["paper_id"] not in method_ids]

    return {
        "method_only": method_only,
        "domain_only": domain_only,
    }


import httpx
import xml.etree.ElementTree as ET
import urllib.parse

async def check_external_gap_validation(method: str, domain: str) -> dict:
    """
    Cross-check candidate gap against external arXiv API to detect global false positives.
    If papers exist globally outside this corpus, flags external_presence=True.
    """
    query_str = f'all:"{method}" AND all:"{domain}"'
    encoded_query = urllib.parse.quote(query_str)
    url = f"http://export.arxiv.org/api/query?search_query={encoded_query}&max_results=3"
    
    try:
        async with httpx.AsyncClient(timeout=4.0) as client:
            resp = await client.get(url)
            if resp.status_code == 200:
                root = ET.fromstring(resp.text)
                # arXiv API uses Atom namespace
                ns = {'atom': 'http://www.w3.org/2005/Atom'}
                entries = root.findall('atom:entry', ns)
                count = len(entries)
                if count > 0:
                    title_elem = entries[0].find('atom:title', ns)
                    sample_title = title_elem.text.strip() if title_elem is not None and title_elem.text else "External Publication"
                    return {
                        "external_presence": True,
                        "external_count": count,
                        "status": "Corpus Gap (External Papers Exist)",
                        "sample_external_paper": sample_title,
                        "confidence_rating": "Medium (Local Corpus Gap)"
                    }
                else:
                    return {
                        "external_presence": False,
                        "external_count": 0,
                        "status": "High-Confidence Global Gap",
                        "sample_external_paper": None,
                        "confidence_rating": "High (Unexplored Globally)"
                    }
    except Exception as e:
        logger.debug(f"External arXiv cross-check skipped for '{method} x {domain}': {e}")

    return {
        "external_presence": False,
        "external_count": 0,
        "status": "Unverified (Local Corpus Gap)",
        "sample_external_paper": None,
        "confidence_rating": "Moderate"
    }


async def analyze_gaps(top_n: int = 20) -> dict:
    """
    Compute Method × Domain gap analysis.
    Returns total possible / observed / missing counts + ranked top_n gaps.
    """
    observed = await get_observed_pairs()
    method_freq = await get_method_frequencies()
    domain_freq = await get_domain_frequencies()

    all_methods = list(method_freq.keys())
    all_domains = list(domain_freq.keys())

    total_possible = len(all_methods) * len(all_domains)
    observed_count = len(observed)

    # Build missing pairs ranked by freq_product
    candidates: list[GapCandidate] = []
    for method in all_methods:
        for domain in all_domains:
            if (method, domain) not in observed:
                score = float(method_freq[method]) * float(domain_freq[domain])
                candidates.append(
                    GapCandidate(
                        method=method,
                        domain=domain,
                        method_frequency=method_freq[method],
                        domain_frequency=domain_freq[domain],
                        score=score,
                    )
                )

    candidates.sort(key=lambda x: x.score, reverse=True)
    top_gaps = candidates[:top_n]

    logger.info(
        f"Gap analysis: {total_possible} possible pairs, "
        f"{observed_count} observed, {len(candidates)} gaps, "
        f"returning top {len(top_gaps)}"
    )

    return {
        "total_possible_pairs": total_possible,
        "observed_pairs": observed_count,
        "missing_pairs": len(candidates),
        "top_gaps": top_gaps,
    }

