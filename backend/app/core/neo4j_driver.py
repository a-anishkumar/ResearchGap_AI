from neo4j import AsyncGraphDatabase, AsyncDriver
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)

_driver: AsyncDriver | None = None


async def get_driver() -> AsyncDriver:
    global _driver
    if _driver is None:
        _driver = AsyncGraphDatabase.driver(
            settings.neo4j_uri,
            auth=(settings.neo4j_user, settings.neo4j_password),
        )
    return _driver


async def close_driver():
    global _driver
    if _driver:
        await _driver.close()
        _driver = None


async def verify_connectivity():
    driver = await get_driver()
    await driver.verify_connectivity()
    logger.info("✅ Neo4j connection verified")


async def run_query(query: str, parameters: dict | None = None):
    driver = await get_driver()
    async with driver.session() as session:
        result = await session.run(query, parameters or {})
        return await result.data()
