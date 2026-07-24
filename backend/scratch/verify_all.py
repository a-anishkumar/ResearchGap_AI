import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.services import proposal_service
from app.models.schemas import ProposalPolishResponse, ResearchProposal

async def run_verification():
    print("=========================================================")
    print("PROPOSAL POLISH MODULE — END-TO-END VERIFICATION")
    print("=========================================================")
    
    # 1. Create Proposal
    method = "Graph Neural Networks"
    domain = "Quantum Computing"
    suggestion = (
        "WHY THIS GAP EXISTS:\n"
        "• Graph Neural Networks haven't been applied to quantum circuit topology placement.\n\n"
        "RESEARCH OPPORTUNITY:\n"
        "• Can GNNs optimize quantum compiler gate mapping efficiently?\n"
        "• Provides a novel hybrid quantum-classical learning representation.\n\n"
        "EXPECTED PARAMETER OUTCOMES:\n"
        "• Accuracy: High-fidelity gate mapping under noisy intermediate-scale quantum constraints.\n"
        "• Speed: Reduced compilation time for 100+ qubit circuits."
    )
    
    print("\n[Step 1] Creating/Retrieving Proposal Blueprint...")
    prop = await proposal_service.create_or_get_proposal(
        method=method,
        domain=domain,
        suggestion=suggestion,
        supporting_papers=["Quantum Compiler Design 2024", "Graph Networks in Physics"]
    )
    assert isinstance(prop, ResearchProposal)
    assert prop.id == "prop_graph_neural_networks_quantum_computing"
    print(f"[OK] Proposal Created ID: {prop.id}")
    print(f"   Title: {prop.title}")
    print(f"   Problem Statement: {prop.problem_statement[:80]}...")
    print(f"   Expected Contributions: {prop.expected_contributions[:80]}...")

    # 2. Run 3 LLM Polish Passes
    print("\n[Step 2] Executing 3 LLM Polish Sub-Passes...")
    polish_res = await proposal_service.polish_proposal(prop.id)
    assert isinstance(polish_res, ProposalPolishResponse)

    print("\n1. ACADEMIC TONE PASS (Diffs):")
    print(f"   Original Prob Stmt: {polish_res.polished_sections.problem_statement.original[:70]}...")
    print(f"   Polished Prob Stmt: {polish_res.polished_sections.problem_statement.polished}")
    print(f"   Original Exp Contrib: {polish_res.polished_sections.expected_contributions.original[:70]}...")
    print(f"   Polished Exp Contrib: {polish_res.polished_sections.expected_contributions.polished}")

    print("\n2. CITATION-NEED FLAGGING (RAG Vector Search):")
    print(f"   Flagged Claims Count: {len(polish_res.citation_flags)}")
    for i, flag in enumerate(polish_res.citation_flags, 1):
        print(f"   Flag #{i}:")
        print(f"     Sentence: \"{flag.sentence}\"")
        print(f"     Reason: {flag.reason}")
        print(f"     Action: {flag.suggested_citation_or_softening}")

    print("\n3. TITLE VARIANT GENERATOR (3 Chips):")
    print(f"   Variants Count: {len(polish_res.title_variants)}")
    for i, tv in enumerate(polish_res.title_variants, 1):
        print(f"   Chip #{i}: \"{tv.title}\"")
        print(f"           Rationale: {tv.rationale}")

    # 3. Test SQLite Caching
    print("\n[Step 3] Verifying SQLite Cache Storage...")
    cached_prop = await proposal_service.get_proposal(prop.id)
    assert cached_prop is not None
    assert cached_prop.polish_result is not None
    assert len(cached_prop.polish_result.title_variants) == 3
    print("[OK] Polish result successfully cached in SQLite proposals table!")

    print("=========================================================")
    print("ALL PROPOSAL POLISH VERIFICATIONS PASSED SUCCESSFULLY!")
    print("=========================================================")

if __name__ == "__main__":
    asyncio.run(run_verification())
