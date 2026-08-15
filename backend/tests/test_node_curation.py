"""
Unit tests for Node Curation and Taxonomy Curation Service.
"""
import pytest
from app.services.node_curation import merge_nodes, find_taxonomy_synonym_candidates


@pytest.mark.asyncio
async def test_merge_same_node_error():
    res = await merge_nodes("XAI", "XAI", "Method")
    assert res["success"] is False
    assert "distinct" in res["message"].lower()


@pytest.mark.asyncio
async def test_merge_nodes_sqlite():
    res = await merge_nodes("Explainable AI", "XAI", "Method")
    assert res["success"] is True
    assert res["target_node"] == "Explainable AI"
    assert res["deleted_node"] == "XAI"


@pytest.mark.asyncio
async def test_find_taxonomy_synonym_candidates():
    candidates = await find_taxonomy_synonym_candidates()
    assert isinstance(candidates, list)
