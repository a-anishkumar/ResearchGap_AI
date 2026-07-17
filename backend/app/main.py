"""
ResearchGap AI — FastAPI application entry point.
"""
from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.routers import upload, extract, graph, gaps

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s — %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup checks: verify Neo4j, initialize graph constraints."""
    logger.info("🚀 ResearchGap AI starting up...")

    # Neo4j connectivity check
    try:
        from app.core.neo4j_driver import verify_connectivity
        await verify_connectivity()

        from app.services.graph_builder import ensure_constraints
        await ensure_constraints()
        logger.info("✅ Neo4j constraints ready")
    except Exception as e:
        logger.warning(
            f"⚠️  Neo4j not available at startup: {e}\n"
            "   Upload/extract/embed will still work. Graph endpoints will return 503."
        )

    # ChromaDB init (lazy — just log readiness)
    try:
        from app.services.rag import get_collection_stats
        stats = get_collection_stats()
        logger.info(f"✅ ChromaDB ready — {stats.get('document_count', 0)} docs")
    except Exception as e:
        logger.warning(f"⚠️  ChromaDB not ready at startup: {e}")

    yield

    # Shutdown
    try:
        from app.core.neo4j_driver import close_driver
        await close_driver()
    except Exception:
        pass
    logger.info("👋 ResearchGap AI shut down")


app = FastAPI(
    title="ResearchGap AI",
    description="Automatic Research Gap Discovery Engine",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(upload.router)
app.include_router(extract.router)
app.include_router(graph.router)
app.include_router(gaps.router)


@app.get("/")
async def root():
    return {"name": "ResearchGap AI", "version": "1.0.0", "status": "running"}


@app.get("/api/health")
async def health():
    neo4j_ok = False
    try:
        from app.core.neo4j_driver import verify_connectivity
        await verify_connectivity()
        neo4j_ok = True
    except Exception:
        pass

    chroma_docs = 0
    try:
        from app.services.rag import get_collection_stats
        chroma_docs = get_collection_stats().get("document_count", 0)
    except Exception:
        pass

    return {
        "status": "ok",
        "neo4j": "connected" if neo4j_ok else "unavailable",
        "chromadb_docs": chroma_docs,
        "gemini_key_set": bool(settings.gemini_api_key),
    }
