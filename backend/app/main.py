"""
ResearchGap AI — FastAPI application entry point.
"""
from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.project import ProjectContextMiddleware
from app.routers import upload, extract, graph, gaps, search, papers, projects, export

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

        # Check if we are using SQLite fallback or Neo4j
        from app.core.neo4j_driver import _use_local_sqlite
        if not _use_local_sqlite:
            from app.services.graph_builder import ensure_constraints
            await ensure_constraints()
            logger.info("✅ Neo4j constraints ready")
        else:
            # Sync any completed processing states to SQLite
            from app.routers.upload import processing_states
            from app.services.graph_builder import write_paper
            synced_count = 0
            for pid, state in list(processing_states.items()):
                if state.stage == "done" and state.extraction:
                    try:
                        await write_paper(pid, state.filename, state.extraction)
                        synced_count += 1
                    except Exception as e:
                        logger.warning(f"Failed seeding paper {state.filename} to SQLite: {e}")
            if synced_count > 0:
                logger.info(f"✅ Synced {synced_count} completed papers from memory to SQLite graph db")
    except Exception as e:
        logger.warning(
            f"⚠️  Graph setup not available at startup: {e}\n"
            "   Will attempt to fall back to SQLite or query endpoints dynamically."
        )

    # ChromaDB init (lazy — just log readiness)
    try:
        from app.services.rag import get_collection_stats
        stats = get_collection_stats()
        logger.info(f"✅ ChromaDB ready — {stats.get('document_count', 0)} docs")
    except Exception as e:
        logger.warning(f"⚠️  ChromaDB not ready at startup: {e}")

    # Pre-populate processing_states from the database
    try:
        from app.services.graph_builder import get_all_papers
        from app.routers.upload import processing_states
        from app.models.schemas import ProcessingState, PaperExtraction
        
        db_papers = await get_all_papers()
        for p in db_papers:
            pid = p["paper_id"]
            if pid not in processing_states:
                processing_states[pid] = ProcessingState(
                    paper_id=pid,
                    filename=p["filename"],
                    stage="done",
                    progress=100,
                    extraction=PaperExtraction(
                        title=p["title"],
                        authors=p["authors"],
                        year=p["year"],
                        methods=p["methods"],
                        domains=p["domains"],
                        datasets=p["datasets"],
                        results=[]
                    )
                )
        logger.info(f"✅ Loaded {len(db_papers)} existing papers from database into processing states")
    except Exception as e:
        logger.warning(f"⚠️  Could not pre-populate processing states from database: {e}")

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

app.add_middleware(ProjectContextMiddleware)

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
app.include_router(search.router)
app.include_router(papers.router)
app.include_router(projects.router)
app.include_router(export.router)


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
