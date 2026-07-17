"""
Graph router — Neo4j query endpoints for visualization.
"""
from __future__ import annotations

import logging
from fastapi import APIRouter, HTTPException
from app.models.schemas import GraphStats, GraphData
from app.services import graph_builder

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
