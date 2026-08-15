"""
Cost and Token Tracker Service.
Tracks LLM API usage (prompt tokens, completion tokens, call counts, estimated cost) per project.
"""
from __future__ import annotations

import json
import logging
import os
from pathlib import Path
from typing import Dict, Any

logger = logging.getLogger(__name__)

# Standard model costs per 1,000,000 tokens (USD)
MODEL_PRICING = {
    "gemini-2.5-flash": {"input": 0.075, "output": 0.30},
    "gemini-1.5-flash": {"input": 0.075, "output": 0.30},
    "gemini-1.5-pro": {"input": 1.25, "output": 5.00},
    "claude-3-5-sonnet": {"input": 3.00, "output": 15.00},
    "claude-sonnet-4-5": {"input": 3.00, "output": 15.00},
    "gpt-4o": {"input": 2.50, "output": 10.00},
    "default": {"input": 0.15, "output": 0.60},
}


def _get_tracker_file_path() -> Path:
    path = Path("./data/cost_tracker.json").resolve()
    path.parent.mkdir(parents=True, exist_ok=True)
    return path


def _load_tracker_data() -> dict:
    file_path = _get_tracker_file_path()
    if not file_path.exists():
        return {}
    try:
        return json.loads(file_path.read_text(encoding="utf-8"))
    except Exception as e:
        logger.warning(f"Error reading cost tracker file: {e}")
        return {}


def _save_tracker_data(data: dict):
    file_path = _get_tracker_file_path()
    try:
        file_path.parent.mkdir(parents=True, exist_ok=True)
        file_path.write_text(json.dumps(data, indent=2), encoding="utf-8")
    except Exception as e:
        logger.error(f"Error saving cost tracker data: {e}")


def calculate_cost(prompt_tokens: int, completion_tokens: int, model_name: str = "default") -> float:
    """Calculate USD cost given prompt and completion token counts."""
    pricing = MODEL_PRICING.get(model_name.lower(), MODEL_PRICING["default"])
    input_cost = (prompt_tokens / 1_000_000) * pricing["input"]
    output_cost = (completion_tokens / 1_000_000) * pricing["output"]
    return round(input_cost + output_cost, 6)


def record_llm_usage(
    project_id: str,
    prompt_tokens: int,
    completion_tokens: int,
    model_name: str = "default",
    action: str = "llm_extraction",
) -> dict:
    """
    Record an LLM request for a project. Updates project token and cost metrics.
    """
    data = _load_tracker_data()
    project_stats = data.get(project_id, {
        "project_id": project_id,
        "total_prompt_tokens": 0,
        "total_completion_tokens": 0,
        "total_tokens": 0,
        "total_requests": 0,
        "estimated_cost_usd": 0.0,
        "breakdown": {},
    })

    cost = calculate_cost(prompt_tokens, completion_tokens, model_name)
    total = prompt_tokens + completion_tokens

    project_stats["total_prompt_tokens"] += prompt_tokens
    project_stats["total_completion_tokens"] += completion_tokens
    project_stats["total_tokens"] += total
    project_stats["total_requests"] += 1
    project_stats["estimated_cost_usd"] = round(project_stats["estimated_cost_usd"] + cost, 6)

    action_stats = project_stats["breakdown"].get(action, {
        "requests": 0,
        "tokens": 0,
        "cost_usd": 0.0,
    })
    action_stats["requests"] += 1
    action_stats["tokens"] += total
    action_stats["cost_usd"] = round(action_stats["cost_usd"] + cost, 6)
    project_stats["breakdown"][action] = action_stats

    data[project_id] = project_stats
    _save_tracker_data(data)
    return project_stats


def get_project_cost_stats(project_id: str) -> dict:
    """Retrieve token usage and cost stats for a specific project workspace."""
    data = _load_tracker_data()
    if project_id not in data:
        return {
            "project_id": project_id,
            "total_prompt_tokens": 0,
            "total_completion_tokens": 0,
            "total_tokens": 0,
            "total_requests": 0,
            "estimated_cost_usd": 0.0,
            "breakdown": {},
        }
    return data[project_id]


def get_global_cost_stats() -> dict:
    """Retrieve aggregated usage and cost stats across all project workspaces."""
    data = _load_tracker_data()
    total_prompt = 0
    total_completion = 0
    total_tokens = 0
    total_requests = 0
    total_cost = 0.0

    for pid, stats in data.items():
        total_prompt += stats.get("total_prompt_tokens", 0)
        total_completion += stats.get("total_completion_tokens", 0)
        total_tokens += stats.get("total_tokens", 0)
        total_requests += stats.get("total_requests", 0)
        total_cost += stats.get("estimated_cost_usd", 0.0)

    return {
        "total_projects": len(data),
        "total_prompt_tokens": total_prompt,
        "total_completion_tokens": total_completion,
        "total_tokens": total_tokens,
        "total_requests": total_requests,
        "total_estimated_cost_usd": round(total_cost, 6),
    }
