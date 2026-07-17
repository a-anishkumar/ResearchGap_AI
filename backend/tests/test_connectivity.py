"""Quick connectivity test for Neo4j — run this after filling in .env"""
import asyncio
import sys
import os

# Add app to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

async def test():
    from app.core.config import settings
    print(f"Neo4j URI: {settings.neo4j_uri}")
    print(f"Anthropic key set: {bool(settings.anthropic_api_key)}")

    try:
        from app.core.neo4j_driver import verify_connectivity
        await verify_connectivity()
        print("✅ Neo4j connected!")
    except Exception as e:
        print(f"❌ Neo4j error: {e}")
        print("   → Check your NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD in .env")

asyncio.run(test())
