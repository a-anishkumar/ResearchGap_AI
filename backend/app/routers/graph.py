"""
Graph router — Neo4j query endpoints for visualization.
"""
from __future__ import annotations

import logging
from fastapi import APIRouter, HTTPException, Query
from app.models.schemas import (
    GraphStats,
    GraphData,
    TimelineResponse,
    ConnectRequest,
    ConnectResponse,
    AuthorNetworkResponse,
    AuthorDetailResponse,
)
from app.services import graph_builder, s2_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/graph", tags=["graph"])


@router.get("/stats", response_model=GraphStats)
async def graph_stats():
    try:
        stats = await graph_builder.get_graph_stats()
        return GraphStats(**stats)
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Neo4j error: {e}")


@router.get("/data", response_model=GraphData)
async def graph_data():
    try:
        data = await graph_builder.get_graph_data()
        return GraphData(**data)
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Neo4j error: {e}")


@router.get("/timeline", response_model=TimelineResponse)
async def graph_timeline():
    """Return publication year vs. Semantic Scholar citation counts timeline for all project papers."""
    try:
        items = await s2_service.get_timeline_data()
        return TimelineResponse(papers=items)
    except Exception as e:
        logger.error(f"Failed fetching timeline data: {e}")
        raise HTTPException(status_code=500, detail=f"Timeline fetch error: {e}")


@router.post("/connect", response_model=ConnectResponse)
async def graph_connect_papers(req: ConnectRequest):
    """Find shortest citation path between two papers using Semantic Scholar BFS."""
    try:
        res = await s2_service.find_shortest_citation_path(req.paper_id_a, req.paper_id_b)
        return ConnectResponse(**res)
    except Exception as e:
        logger.error(f"Failed connecting papers {req.paper_id_a} and {req.paper_id_b}: {e}")
        raise HTTPException(status_code=500, detail=f"Paper connection error: {e}")


@router.get("/authors", response_model=AuthorNetworkResponse)
async def graph_author_network():
    """Return co-authorship graph (nodes and links) across all project papers."""
    try:
        data = await s2_service.get_author_network()
        return AuthorNetworkResponse(**data)
    except Exception as e:
        logger.error(f"Failed fetching author network: {e}")
        raise HTTPException(status_code=500, detail=f"Author network error: {e}")


@router.get("/authors/{name}", response_model=AuthorDetailResponse)
async def graph_author_detail(name: str):
    """Return author's project papers plus top 10 external papers from Semantic Scholar."""
    try:
        data = await s2_service.get_author_detail(name)
        return AuthorDetailResponse(**data)
    except Exception as e:
        logger.error(f"Failed fetching detail for author '{name}': {e}")
        raise HTTPException(status_code=500, detail=f"Author detail error: {e}")


@router.get("/entities")
async def graph_entities():
    """Return full entity lists (methods, domains, datasets, results, papers) with associations."""
    try:
        return await graph_builder.get_entities()
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Entity fetch error: {e}")



@router.get("/node/{node_id}")
async def graph_node_detail(
    node_id: str,
    node_type: str = Query(..., description="Node type: Paper | Method | Domain | Dataset"),
):
    """Return rich drill-down detail for a single clicked graph node."""
    try:
        detail = await graph_builder.get_node_detail(node_id, node_type)
        if not detail:
            raise HTTPException(status_code=404, detail=f"Node '{node_id}' of type '{node_type}' not found")
        return detail
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Node detail error: {e}")


@router.post("/merge-nodes")
async def merge_nodes_endpoint(
    source_name: str = Query(..., description="Entity node name to merge from"),
    target_name: str = Query(..., description="Canonical entity node name to merge into"),
    entity_type: str = Query("Method", description="Entity type: Method | Domain | Dataset"),
):
    """Human-in-the-Loop entity node merge endpoint for post-extraction curation."""
    try:
        res = await graph_builder.merge_nodes(source_name, target_name, entity_type)
        if res.get("status") == "error":
            raise HTTPException(status_code=400, detail=res.get("message"))
        return res
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed merging nodes: {e}")


@router.get("/stats/coverage")
async def graph_corpus_coverage():
    """Return domain concentration, Shannon Entropy, and corpus skewness warning status."""
    import math
    try:
        data = await graph_builder.get_entities()
        domains = data.get("domains", [])
        if not domains:
            return {"corpus_skew_warning": False, "entropy": 0.0, "top_domain_share": 0.0, "message": "No domain data available yet."}

        total_papers = sum(d.get("paper_count", 0) for d in domains)
        if total_papers == 0:
            return {"corpus_skew_warning": False, "entropy": 0.0, "top_domain_share": 0.0, "message": "No papers mapped to domains."}

        shares = [d.get("paper_count", 0) / total_papers for d in domains if d.get("paper_count", 0) > 0]
        top_share = max(shares) if shares else 0.0
        entropy = -sum(p * math.log2(p) for p in shares)

        # Skew warning triggered if top 2 domains represent > 75% of domain mappings
        sorted_shares = sorted(shares, reverse=True)
        top_2_share = sum(sorted_shares[:2]) if len(sorted_shares) >= 2 else top_share

        skew_warning = top_2_share >= 0.75 and len(domains) > 2
        msg = f"Corpus is heavily skewed toward top domains ({round(top_2_share * 100, 1)}% concentration). Gap discovery outside primary domains may reflect sample sparsity." if skew_warning else "Corpus domain coverage is balanced."

        return {
            "corpus_skew_warning": skew_warning,
            "entropy": round(entropy, 3),
            "top_domain_share": round(top_share, 3),
            "top_2_domain_share": round(top_2_share, 3),
            "total_domains": len(domains),
            "message": msg
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Coverage metric calculation error: {e}")

