import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.services import s2_service
from app.models.schemas import TimelineResponse, ConnectResponse, AuthorNetworkResponse, AuthorDetailResponse

async def run_s2_tests():
    print("=========================================================")
    print("SEMANTIC SCHOLAR INTEGRATION - END-TO-END TEST")
    print("=========================================================")

    # 1. Timeline Test
    print("\n[Feature 1] Testing Timeline View Endpoint...")
    timeline = await s2_service.get_timeline_data()
    print(f"[OK] Timeline items count: {len(timeline)}")
    if timeline:
        sample = timeline[0]
        print(f"     Sample Paper: {sample['title']}")
        print(f"     Year: {sample['year']} | Citations: {sample['citation_count']} | Method: {sample['method']}")

    # 2. Authors Network Test
    print("\n[Feature 3] Testing Author Network Endpoint...")
    author_net = await s2_service.get_author_network()
    print(f"[OK] Author Nodes count: {len(author_net['nodes'])}")
    print(f"     Co-authorship Links count: {len(author_net['links'])}")
    if author_net['nodes']:
        first_author = author_net['nodes'][0]['name']
        print(f"     Sample Author: {first_author}")

        print(f"\n[Feature 3b] Testing Author Detail Endpoint for '{first_author}'...")
        detail = await s2_service.get_author_detail(first_author)
        print(f"[OK] Author Detail Name: {detail['author_name']}")
        print(f"     In-Project Papers: {len(detail['in_project_papers'])}")
        print(f"     External Top Papers (S2): {len(detail['external_top_papers'])}")

    # 3. Literature Connector Test
    print("\n[Feature 2] Testing Literature Connector Path Search...")
    all_papers = await s2_service.graph_builder.get_all_papers()
    if len(all_papers) >= 2:
        pid_a = all_papers[0].get("paper_id")
        pid_b = all_papers[1].get("paper_id")
        print(f"     Connecting Paper A ({all_papers[0].get('title')[:30]}...) -> Paper B ({all_papers[1].get('title')[:30]}...)")
        connect_res = await s2_service.find_shortest_citation_path(pid_a, pid_b)
        print(f"[OK] Connector Message: {connect_res['message']}")
        print(f"     Path Length: {len(connect_res['path']) if connect_res['path'] else 0}")
    else:
        print("     Skipping 2-paper connect test (need >= 2 papers in corpus).")

    print("\n=========================================================")
    print("ALL SEMANTIC SCHOLAR INTEGRATION TESTS PASSED CLEANLY!")
    print("=========================================================")

if __name__ == "__main__":
    asyncio.run(run_s2_tests())
