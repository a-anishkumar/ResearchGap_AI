"""
Taxonomy Curation Router.
Endpoints for Human-in-the-loop entity node merging and synonym discovery.
"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from app.services import node_curation

router = APIRouter(prefix="/api/curate", tags=["curate"])


class MergeNodesRequest(BaseModel):
    target_name: str = Field(..., description="Target node name to merge into")
    source_name: str = Field(..., description="Source node name to be merged and deleted")
    entity_type: str = Field("Method", description="Type of entity: Method, Domain, or Dataset")


@router.post("/merge")
async def merge_taxonomy_nodes(req: MergeNodesRequest):
    """
    Merge duplicate taxonomy nodes (e.g. merge 'XAI' into 'Explainable AI').
    Re-points all relationships to target_name and safely removes source_name.
    """
    if not req.target_name.strip() or not req.source_name.strip():
        raise HTTPException(status_code=400, detail="Target and source names must be non-empty.")

    result = await node_curation.merge_nodes(
        target_name=req.target_name,
        source_name=req.source_name,
        entity_type=req.entity_type,
    )
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("message", "Node merge operation failed."))
    return result


@router.get("/candidates")
async def get_synonym_candidates():
    """
    Retrieve candidate duplicate or synonym taxonomy nodes for human curation review.
    """
    candidates = await node_curation.find_taxonomy_synonym_candidates()
    return {"candidate_count": len(candidates), "candidates": candidates}
