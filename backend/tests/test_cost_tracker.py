"""
Unit tests for Cost and Token Tracker service.
"""
import pytest
from app.services.cost_tracker import calculate_cost, record_llm_usage, get_project_cost_stats, get_global_cost_stats


def test_calculate_cost_pricing():
    # 1M input tokens @ $0.075 + 1M output tokens @ $0.30 = $0.375
    cost = calculate_cost(1_000_000, 1_000_000, "gemini-2.5-flash")
    assert cost == 0.375

    # Small calculation
    cost_small = calculate_cost(10_000, 5_000, "default")
    assert cost_small > 0


def test_record_llm_usage():
    pid = "test_project_cost_unit"
    stats = record_llm_usage(
        project_id=pid,
        prompt_tokens=1000,
        completion_tokens=500,
        model_name="gemini-2.5-flash",
        action="test_action",
    )
    assert stats["project_id"] == pid
    assert stats["total_prompt_tokens"] >= 1000
    assert stats["total_completion_tokens"] >= 500
    assert stats["total_tokens"] >= 1500
    assert stats["total_requests"] >= 1

    retrieved = get_project_cost_stats(pid)
    assert retrieved["total_tokens"] >= 1500

    global_stats = get_global_cost_stats()
    assert global_stats["total_projects"] >= 1
    assert global_stats["total_tokens"] >= 1500
