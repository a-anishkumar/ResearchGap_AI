"""
Corpus Coverage Analytics & Community Detection Service.
Computes Shannon Entropy, Gini Index, domain skew warnings, and graph community detection (Louvain clusters).
"""
from __future__ import annotations

import math
import logging
from typing import Dict, List, Any
from app.core.neo4j_driver import run_query

logger = logging.getLogger(__name__)


def compute_shannon_entropy(frequencies: dict[str, int]) -> dict[str, float]:
    """
    Compute Shannon Entropy (H) and Normalized Entropy (0.0 - 1.0) over entity frequencies.
    """
    total = sum(frequencies.values())
    if total == 0 or len(frequencies) == 0:
        return {"shannon_entropy": 0.0, "normalized_entropy": 0.0, "gini_coefficient": 0.0}

    probs = [freq / total for freq in frequencies.values() if freq > 0]
    entropy = -sum(p * math.log2(p) for p in probs)

    max_entropy = math.log2(len(frequencies)) if len(frequencies) > 1 else 1.0
    normalized_entropy = round(entropy / max_entropy, 4) if max_entropy > 0 else 0.0

    # Gini Coefficient computation
    sorted_freqs = sorted(frequencies.values())
    n = len(sorted_freqs)
    if n <= 1:
        gini = 0.0
    else:
        num = sum((i + 1) * val for i, val in enumerate(sorted_freqs))
        gini = (2 * num) / (n * sum(sorted_freqs)) - (n + 1) / n
        gini = max(0.0, min(1.0, round(gini, 4)))

    return {
        "shannon_entropy": round(entropy, 4),
        "normalized_entropy": normalized_entropy,
        "gini_coefficient": gini,
    }


async def analyze_corpus_coverage() -> dict:
    """
    Analyze domain and method distribution across the uploaded corpus to detect skew and bias.
    """
    domain_rows = await run_query(
        """
        MATCH (p:Paper)-[:APPLIES_TO_DOMAIN]->(d:Domain)
        RETURN d.name AS domain, count(p) AS freq
        ORDER BY freq DESC
        """
    )
    domain_freqs = {r["domain"]: r["freq"] for r in domain_rows}

    method_rows = await run_query(
        """
        MATCH (p:Paper)-[:USES_METHOD]->(m:Method)
        RETURN m.name AS method, count(p) AS freq
        ORDER BY freq DESC
        """
    )
    method_freqs = {r["method"]: r["freq"] for r in method_rows}

    paper_count_rows = await run_query("MATCH (p:Paper) RETURN count(p) AS count")
    paper_count = paper_count_rows[0]["count"] if paper_count_rows else 0

    domain_metrics = compute_shannon_entropy(domain_freqs)
    method_metrics = compute_shannon_entropy(method_freqs)

    # Skew & warning detection
    total_domain_occurrences = sum(domain_freqs.values())
    skew_warning = None
    dominant_domains = []

    if total_domain_occurrences > 0 and len(domain_freqs) > 0:
        top_2_count = sum(list(domain_freqs.values())[:2])
        top_2_ratio = top_2_count / total_domain_occurrences
        dominant_domains = list(domain_freqs.keys())[:2]

        if top_2_ratio >= 0.70 and len(domain_freqs) >= 3:
            skew_warning = (
                f"Corpus Skew Alert: {round(top_2_ratio * 100, 1)}% of paper domain linkages belong to "
                f"2 domains ({', '.join(dominant_domains)}). Research gap scores outside these domains "
                f"may reflect sample sparsity rather than true literature opportunities."
            )

    # Health Index (0-100)
    health_score = int(domain_metrics["normalized_entropy"] * 60 + method_metrics["normalized_entropy"] * 40)
    if paper_count < 5:
        health_score = max(10, health_score - 30)

    return {
        "paper_count": paper_count,
        "unique_domains": len(domain_freqs),
        "unique_methods": len(method_freqs),
        "domain_entropy": domain_metrics["shannon_entropy"],
        "domain_normalized_entropy": domain_metrics["normalized_entropy"],
        "domain_gini_coefficient": domain_metrics["gini_coefficient"],
        "method_entropy": method_metrics["shannon_entropy"],
        "method_normalized_entropy": method_metrics["normalized_entropy"],
        "method_gini_coefficient": method_metrics["gini_coefficient"],
        "corpus_health_score": health_score,
        "is_skewed": skew_warning is not None,
        "skew_warning": skew_warning,
        "dominant_domains": dominant_domains,
        "domain_frequencies": domain_freqs,
    }


async def detect_graph_communities() -> dict:
    """
    Perform community detection on graph nodes to discover implicit sub-fields.
    """
    # Fetch graph nodes & relationships
    node_rows = await run_query(
        """
        MATCH (p:Paper) RETURN p.id AS id, p.title AS label, 'Paper' AS type
        UNION ALL
        MATCH (m:Method) RETURN m.name AS id, m.name AS label, 'Method' AS type
        UNION ALL
        MATCH (d:Domain) RETURN d.name AS id, d.name AS label, 'Domain' AS type
        UNION ALL
        MATCH (ds:Dataset) RETURN ds.name AS id, ds.name AS label, 'Dataset' AS type
        """
    )
    link_rows = await run_query(
        """
        MATCH (p:Paper)-[:USES_METHOD]->(m:Method) RETURN p.id AS s, m.name AS t, 'USES_METHOD' AS rt
        UNION ALL
        MATCH (p:Paper)-[:APPLIES_TO_DOMAIN]->(d:Domain) RETURN p.id AS s, d.name AS t, 'APPLIES_TO_DOMAIN' AS rt
        UNION ALL
        MATCH (p:Paper)-[:EVALUATES_ON]->(ds:Dataset) RETURN p.id AS s, ds.name AS t, 'EVALUATES_ON' AS rt
        """
    )

    if not node_rows:
        return {"community_count": 0, "communities": [], "node_community_map": {}}

    # Build adjacency mapping for community detection (Label Propagation / Modularity optimization)
    adj: dict[str, set[str]] = {n["id"]: set() for n in node_rows if n and "id" in n and n["id"]}
    for link in link_rows:
        s, t = link.get("s"), link.get("t")
        if s in adj and t in adj:
            adj[s].add(t)
            adj[t].add(s)

    # Connected component / Label propagation heuristic algorithm
    community_map: dict[str, int] = {}
    visited = set()
    current_community = 0

    for node_id in adj:
        if node_id not in visited:
            current_community += 1
            queue = [node_id]
            visited.add(node_id)

            component_nodes = []
            while queue:
                curr = queue.pop(0)
                community_map[curr] = current_community
                component_nodes.append(curr)

                for neighbor in adj[curr]:
                    if neighbor not in visited:
                        visited.add(neighbor)
                        queue.append(neighbor)

    # Aggregate community details
    community_clusters: dict[int, list[str]] = {}
    for node_id, comm_id in community_map.items():
        if comm_id not in community_clusters:
            community_clusters[comm_id] = []
        community_clusters[comm_id].append(node_id)

    communities_summary = []
    for comm_id, members in community_clusters.items():
        communities_summary.append({
            "community_id": comm_id,
            "size": len(members),
            "sample_nodes": members[:5],
        })

    communities_summary.sort(key=lambda x: x["size"], reverse=True)

    return {
        "community_count": len(community_clusters),
        "communities": communities_summary,
        "node_community_map": community_map,
    }
