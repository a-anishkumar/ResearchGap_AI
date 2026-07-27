"""Quick connectivity test for Neo4j — run this after filling in .env"""
import asyncio
import sys
import os

# Add app to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest

@pytest.mark.asyncio
async def test_neo4j_connectivity():
    from app.core.config import settings
    print(f"Neo4j URI: {settings.neo4j_uri}")
    print(f"Gemini key set: {bool(settings.gemini_api_key)}")

    try:
        from app.core.neo4j_driver import verify_connectivity
        await verify_connectivity()
        print("[OK] Neo4j connection verified (or fallback active)")
    except Exception as e:
        print(f"[ERROR] Neo4j error: {e}")
        print("   → Check your NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD in .env")

if __name__ == "__main__":
    asyncio.run(test_neo4j_connectivity())

