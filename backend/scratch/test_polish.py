import asyncio
import sys
from pathlib import Path

# Add backend directory to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.services import proposal_service

async def main():
    print("--- 1. Creating proposal ---")
    prop = await proposal_service.create_or_get_proposal(
        method="Graph Neural Networks",
        domain="Quantum Computing",
        suggestion="WHY THIS GAP EXISTS:\n• GNNs haven't been applied to quantum circuit optimization.\n\nRESEARCH OPPORTUNITY:\n• How can GNNs improve quantum compiler placement?\n\nEXPECTED PARAMETER OUTCOMES:\n• Accuracy: High accuracy in gate mapping."
    )
    print(f"Proposal ID: {prop.id}")
    print(f"Title: {prop.title}")
    print(f"Problem Statement: {prop.problem_statement}")

    print("\n--- 2. Running Proposal Polish (3 Sub-Passes) ---")
    polish_res = await proposal_service.polish_proposal(prop.id)
    
    print("\n[Polished Sections Diff]")
    print(f"Original Prob Stmt: {polish_res.polished_sections.problem_statement.original}")
    print(f"Polished Prob Stmt: {polish_res.polished_sections.problem_statement.polished}")
    print(f"Original Exp Contrib: {polish_res.polished_sections.expected_contributions.original}")
    print(f"Polished Exp Contrib: {polish_res.polished_sections.expected_contributions.polished}")

    print("\n[Citation Flags]")
    for flag in polish_res.citation_flags:
        print(f"• Sentence: {flag.sentence}")
        print(f"  Reason: {flag.reason}")
        print(f"  Suggestion: {flag.suggested_citation_or_softening}")

    print("\n[Title Variants]")
    for tv in polish_res.title_variants:
        print(f"• {tv.title} -> {tv.rationale}")

    print("\n--- 3. Verifying Caching (2nd Run) ---")
    cached_res = await proposal_service.polish_proposal(prop.id)
    print(f"Cached Title Variants Count: {len(cached_res.title_variants)}")
    print("SUCCESS: Proposal Polish backend pipeline working cleanly!")

if __name__ == "__main__":
    asyncio.run(main())
