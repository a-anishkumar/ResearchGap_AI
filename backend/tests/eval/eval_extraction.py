#!/usr/bin/env python
"""
Evaluation harness for entity extraction accuracy.
Computes precision, recall, F1 per entity type against gold-standard fixtures.

Usage (from backend/ directory, with venv activated):
    python tests/eval/eval_extraction.py

Output:
    backend/tests/eval/report.md
"""
from __future__ import annotations

import asyncio
import json
import re
import sys
from pathlib import Path

# Allow running from backend/ directory
BACKEND_DIR = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(BACKEND_DIR))

FIXTURES_DIR = Path(__file__).parent / "fixtures"
REPORT_PATH = Path(__file__).parent / "report.md"


def normalize(text: str) -> str:
    """Lowercase, strip punctuation, collapse whitespace for fuzzy matching."""
    text = text.lower().strip()
    text = re.sub(r"[^a-z0-9\s]", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def token_precision_recall_f1(
    predicted: list[str], gold: list[str]
) -> tuple[float, float, float]:
    """
    Compute precision, recall, F1 using normalized string set overlap.
    A prediction matches a gold item if normalize(pred) == normalize(gold).
    """
    if not gold and not predicted:
        return 1.0, 1.0, 1.0
    if not gold:
        return 0.0, 1.0, 0.0
    if not predicted:
        return 0.0, 0.0, 0.0

    norm_gold = {normalize(g) for g in gold}
    norm_pred = [normalize(p) for p in predicted]

    tp = sum(1 for p in norm_pred if p in norm_gold)
    precision = tp / len(norm_pred) if norm_pred else 0.0
    recall = tp / len(norm_gold) if norm_gold else 0.0
    f1 = (
        2 * precision * recall / (precision + recall)
        if (precision + recall) > 0
        else 0.0
    )
    return precision, recall, f1


async def run_evaluation() -> list:
    """Run extraction on all fixtures and compute per-type metrics."""
    try:
        from app.services.llm_extractor import extract_paper
    except ImportError as e:
        print(f"ERROR: Could not import app modules: {e}")
        print("Ensure you run this from the backend/ directory with venv activated.")
        sys.exit(1)

    fixtures = sorted(FIXTURES_DIR.glob("*.json"))
    if not fixtures:
        print(f"No fixtures found in {FIXTURES_DIR}")
        sys.exit(1)

    print(f"Found {len(fixtures)} fixtures. Running extraction...")

    entity_types = ["methods", "domains", "datasets"]
    results = []

    for fixture_path in fixtures:
        with open(fixture_path) as f:
            gold = json.load(f)

        print(f"  Processing: {fixture_path.name} ...", end="", flush=True)

        # Build synthetic text from gold fields (no actual PDF needed for eval)
        methods_str = ", ".join(gold.get("methods", []))
        domains_str = ", ".join(gold.get("domains", []))
        datasets_str = ", ".join(gold.get("datasets", []))
        authors_str = ", ".join(gold.get("authors", []))

        synthetic_text = (
            f"Title: {gold.get('title', '')}\n"
            f"Authors: {authors_str}\n"
            f"Year: {gold.get('year', '')}\n\n"
            f"Abstract: This paper proposes a novel approach using {methods_str} "
            f"applied to {domains_str}. "
            f"We evaluate on {datasets_str} benchmark datasets.\n\n"
            f"Methods: We employ {methods_str} as our core methodology. "
            f"Our work contributes to the field of {domains_str}.\n\n"
            f"Experiments: We benchmark on {datasets_str}."
        )

        try:
            predicted = await extract_paper(synthetic_text, gold["filename"])
            row = {"fixture": fixture_path.name, "gold": gold, "predicted": predicted}

            per_type = {}
            for etype in entity_types:
                gold_vals = gold.get(etype, [])
                pred_vals = getattr(predicted, etype, [])
                p, r, f1 = token_precision_recall_f1(pred_vals, gold_vals)
                per_type[etype] = {"precision": p, "recall": r, "f1": f1,
                                   "predicted": pred_vals, "gold": gold_vals}

            row["per_type"] = per_type
            results.append(row)
            print(f" OK (methods F1={per_type['methods']['f1']:.2f}, "
                  f"domains F1={per_type['domains']['f1']:.2f}, "
                  f"datasets F1={per_type['datasets']['f1']:.2f})")
        except Exception as e:
            print(f" FAILED: {e}")
            results.append({"fixture": fixture_path.name, "error": str(e)})

    return results


def write_report(results: list) -> str:
    """Write a markdown report and return the string."""
    entity_types = ["methods", "domains", "datasets"]
    lines = [
        "# ResearchGap AI — Extraction Evaluation Report",
        "",
        f"**Fixtures evaluated:** {len(results)}",
        f"**Entity types scored:** {', '.join(entity_types)}",
        f"**Matching strategy:** Normalized token set overlap (case-insensitive, punctuation-stripped)",
        "",
        "## Per-Fixture Results",
        "",
        "| Fixture | Methods P | Methods R | Methods F1 | Domains P | Domains R | Domains F1 | Datasets P | Datasets R | Datasets F1 |",
        "|---------|-----------|-----------|------------|-----------|-----------|------------|------------|------------|-------------|"
    ]

    agg = {etype: {"p": [], "r": [], "f1": []} for etype in entity_types}

    for row in results:
        if "error" in row:
            lines.append(f"| {row['fixture']} | ERROR | — | — | — | — | — | — | — | — |")
            continue
        pt = row["per_type"]
        cells = [row["fixture"]]
        for etype in entity_types:
            p = pt[etype]["precision"]
            r = pt[etype]["recall"]
            f1 = pt[etype]["f1"]
            cells += [f"{p:.2f}", f"{r:.2f}", f"**{f1:.2f}**"]
            agg[etype]["p"].append(p)
            agg[etype]["r"].append(r)
            agg[etype]["f1"].append(f1)
        lines.append("| " + " | ".join(cells) + " |")

    lines += ["", "## Aggregate Scores (Macro-Average)", ""]
    lines.append("| Entity Type | Avg Precision | Avg Recall | **Avg F1** |")
    lines.append("|-------------|---------------|------------|-----------|")
    for etype in entity_types:
        vals = agg[etype]
        if vals["f1"]:
            ap = sum(vals["p"]) / len(vals["p"])
            ar = sum(vals["r"]) / len(vals["r"])
            af1 = sum(vals["f1"]) / len(vals["f1"])
        else:
            ap = ar = af1 = 0.0
        lines.append(f"| {etype.capitalize()} | {ap:.3f} | {ar:.3f} | **{af1:.3f}** |")

    lines += [
        "",
        "## Detailed Predictions vs Gold",
        "",
    ]
    for row in results:
        if "error" in row:
            continue
        lines.append(f"### {row['fixture']}")
        lines.append(f"**Title:** {row['gold'].get('title', '—')}")
        lines.append("")
        pt = row["per_type"]
        for etype in entity_types:
            gold_vals = pt[etype].get("gold", [])
            pred_vals = pt[etype].get("predicted", [])
            f1 = pt[etype]["f1"]
            lines.append(f"**{etype.capitalize()}** (F1={f1:.2f})")
            lines.append(f"- Gold: {gold_vals}")
            lines.append(f"- Predicted: {pred_vals}")
            lines.append("")

    lines += [
        "---",
        "",
        "*Generated by `tests/eval/eval_extraction.py`*",
        "*Entity matching uses normalized string set overlap (case-insensitive)*",
    ]

    return "\n".join(lines)


async def main():
    results = await run_evaluation()
    report = write_report(results)

    REPORT_PATH.write_text(report, encoding="utf-8")
    print(f"\nReport written to: {REPORT_PATH}")
    print("\n" + "=" * 60)

    # Print aggregate summary to console
    entity_types = ["methods", "domains", "datasets"]
    agg = {etype: [] for etype in entity_types}
    for row in results:
        if "error" in row or "per_type" not in row:
            continue
        for etype in entity_types:
            agg[etype].append(row["per_type"][etype]["f1"])

    print("AGGREGATE F1 SCORES:")
    for etype in entity_types:
        vals = agg[etype]
        avg_f1 = sum(vals) / len(vals) if vals else 0.0
        print(f"  {etype.capitalize():12s}: {avg_f1:.3f}")


if __name__ == "__main__":
    asyncio.run(main())
