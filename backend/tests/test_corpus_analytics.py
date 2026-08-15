"""
Unit tests for Corpus Analytics (Entropy, Gini, Skew Warning & Community Detection).
"""
import pytest
from app.services.corpus_analytics import compute_shannon_entropy, analyze_corpus_coverage


def test_compute_shannon_entropy_balanced():
    # Perfectly balanced distribution across 4 domains
    freqs = {"NLP": 10, "CV": 10, "Robotics": 10, "Genomics": 10}
    res = compute_shannon_entropy(freqs)

    assert res["shannon_entropy"] == 2.0  # log2(4) = 2.0
    assert res["normalized_entropy"] == 1.0
    assert res["gini_coefficient"] == 0.0


def test_compute_shannon_entropy_skewed():
    # Heavily skewed distribution
    freqs = {"NLP": 95, "CV": 3, "Robotics": 1, "Genomics": 1}
    res = compute_shannon_entropy(freqs)

    assert res["normalized_entropy"] < 0.5
    assert res["gini_coefficient"] > 0.5


@pytest.mark.asyncio
async def test_analyze_corpus_coverage():
    coverage = await analyze_corpus_coverage()
    assert "domain_entropy" in coverage
    assert "domain_normalized_entropy" in coverage
    assert "corpus_health_score" in coverage
    assert "is_skewed" in coverage
