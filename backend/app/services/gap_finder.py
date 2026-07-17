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
