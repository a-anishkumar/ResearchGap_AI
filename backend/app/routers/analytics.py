"""
Analytics & Telemetry Router.
Endpoints for corpus coverage entropy, skew alerts, graph community detection, and API cost tracking.
"""
from __future__ import annotations

from fastapi import APIRouter, Header

from app.services import corpus_analytics, cost_tracker
from app.core.project import get_active_project_id, resolve_project_id

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


@router.get("/coverage")
async def get_corpus_coverage_analytics(x_project_id: str | None = Header(default=None)):
    """
    Get Shannon entropy, Gini coefficient, and domain skew warning alerts for the corpus.
    """
    project_id = resolve_project_id(x_project_id)
    analytics = await corpus_analytics.analyze_corpus_coverage()
    analytics["project_id"] = project_id
    return analytics


@router.get("/communities")
async def get_graph_communities(x_project_id: str | None = Header(default=None)):
    """
    Get Louvain community detection clusters partitioning graph nodes into sub-fields.
    """
    project_id = resolve_project_id(x_project_id)
    communities = await corpus_analytics.detect_graph_communities()
    communities["project_id"] = project_id
    return communities


@router.get("/cost")
async def get_project_cost_telemetry(x_project_id: str | None = Header(default=None)):
    """
    Get token consumption, API request count, and estimated LLM USD costs for the current project.
    """
    project_id = resolve_project_id(x_project_id)
    stats = cost_tracker.get_project_cost_stats(project_id)
    return stats


@router.get("/cost/global")
async def get_global_cost_telemetry():
    """
    Get aggregate token consumption and cost metrics across all project workspaces.
    """
    stats = cost_tracker.get_global_cost_stats()
    return stats
