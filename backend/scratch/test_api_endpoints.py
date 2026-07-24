import requests

BASE_URL = "http://localhost:8000/api/gaps"

def test_proposal_endpoints():
    print("1. Testing proposal generation endpoint...")
    gen_res = requests.post(f"{BASE_URL}/proposals/generate", params={
        "method": "Transformer Architecture",
        "domain": "Biomedical Named Entity Recognition",
        "suggestion": "WHY THIS GAP EXISTS:\n• High computational overhead in clinical texts.\n\nRESEARCH OPPORTUNITY:\n• Lightweight Transformers for clinical NER."
    })
    assert gen_res.status_code == 200, f"Generate failed: {gen_res.text}"
    prop_data = gen_res.json()
    prop_id = prop_data["id"]
    print(f"✅ Generated Proposal ID: {prop_id}")
    print(f"   Title: {prop_data['title']}")

    print("\n2. Testing proposal lookup by ID endpoint...")
    get_res = requests.get(f"{BASE_URL}/proposals/{prop_id}")
    assert get_res.status_code == 200, f"Get proposal failed: {get_res.text}"
    print(f"✅ Retrieved Proposal ID: {get_res.json()['id']}")

    print("\n3. Testing 3-Pass Proposal Polish endpoint...")
    polish_res = requests.post(f"{BASE_URL}/proposals/{prop_id}/polish")
    assert polish_res.status_code == 200, f"Polish failed: {polish_res.text}"
    p_data = polish_res.json()
    
    print("✅ Polish response structure verified:")
    print(f"   Polished Sections keys: {list(p_data['polished_sections'].keys())}")
    print(f"   Problem Statement Original: {p_data['polished_sections']['problem_statement']['original'][:60]}...")
    print(f"   Problem Statement Polished: {p_data['polished_sections']['problem_statement']['polished'][:60]}...")
    print(f"   Citation Flags count: {len(p_data['citation_flags'])}")
    if p_data['citation_flags']:
        print(f"   Sample Flag: {p_data['citation_flags'][0]['sentence'][:60]}...")
        print(f"   Sample Suggestion: {p_data['citation_flags'][0]['suggested_citation_or_softening']}")
    print(f"   Title Variants count: {len(p_data['title_variants'])}")
    for tv in p_data['title_variants']:
        print(f"   • Variant Title: {tv['title']}")

    print("\n4. Testing Polish Cache Retrieval (2nd Call)...")
    cache_res = requests.post(f"{BASE_URL}/proposals/{prop_id}/polish")
    assert cache_res.status_code == 200, "Cache retrieval failed"
    print("✅ Cached polish result successfully returned!")

if __name__ == "__main__":
    test_proposal_endpoints()
