"""
RAG (Retrieval-Augmented Generation) service.
Uses ChromaDB + sentence-transformers for local embeddings.
"""
from __future__ import annotations

import logging
import uuid
from typing import Any
from pathlib import Path
from app.core.config import settings

logger = logging.getLogger(__name__)

_collections: dict[str, Any] = {}


def _get_collection():
    from app.core.project import get_project_name, get_chroma_path
    project = get_project_name()
    if project not in _collections:
        import chromadb
        from chromadb.config import Settings as ChromaSettings

        path = str(get_chroma_path().resolve())
        client = chromadb.PersistentClient(
            path=path,
            settings=ChromaSettings(anonymized_telemetry=False),
        )
        _collections[project] = client.get_or_create_collection(
            name="papers",
            metadata={"hnsw:space": "cosine"},
        )
        logger.info(f"ChromaDB collection for project '{project}' ready at {path} ({_collections[project].count()} docs)")
    return _collections[project]


def _get_embedding_fn():
    """Lazy-load sentence-transformers embedding function for ChromaDB."""
    from chromadb.utils import embedding_functions
    return embedding_functions.SentenceTransformerEmbeddingFunction(
        model_name=settings.embedding_model
    )


def ingest_chunks(paper_id: str, chunks: list[str], metadata_extra: dict | None = None):
    """Store text chunks for a paper in ChromaDB."""
    if not chunks:
        return
    collection = _get_collection()
    ef = _get_embedding_fn()

    ids = [f"{paper_id}_{i}" for i in range(len(chunks))]
    metadatas = [{"paper_id": paper_id, **(metadata_extra or {})} for _ in chunks]

    # Embed
    embeddings = ef(chunks)

    # Delete old chunks for this paper (re-ingest idempotency)
    try:
        existing = collection.get(where={"paper_id": paper_id})
        if existing["ids"]:
            collection.delete(ids=existing["ids"])
    except Exception:
        pass

    collection.add(
        ids=ids,
        documents=chunks,
        embeddings=embeddings,
        metadatas=metadatas,
    )
    logger.info(f"Ingested {len(chunks)} chunks for paper {paper_id}")


def retrieve(query: str, top_k: int | None = None) -> list[dict]:
    """
    Retrieve top-k most relevant chunks for a query.
    Returns list of {text, paper_id, distance}.
    """
    k = top_k or settings.rag_top_k
    collection = _get_collection()

    if collection.count() == 0:
        return []

    ef = _get_embedding_fn()
    query_embedding = ef([query])[0]

    results = collection.query(
        query_embeddings=[query_embedding],
        n_results=min(k, collection.count()),
        include=["documents", "metadatas", "distances"],
    )

    output = []
    for doc, meta, dist in zip(
        results["documents"][0],
        results["metadatas"][0],
        results["distances"][0],
    ):
        output.append(
            {
                "text": doc,
                "paper_id": meta.get("paper_id", ""),
                "title": meta.get("title", ""),
                "distance": dist,
            }
        )
    return output


def get_collection_stats() -> dict:
    try:
        col = _get_collection()
        return {"document_count": col.count()}
    except Exception as e:
        return {"document_count": 0, "error": str(e)}


def delete_paper_chunks(paper_id: str):
    """Delete all text chunks associated with a specific paper from ChromaDB."""
    collection = _get_collection()
    try:
        existing = collection.get(where={"paper_id": paper_id})
        if existing["ids"]:
            collection.delete(ids=existing["ids"])
            logger.info(f"Deleted chunks for paper {paper_id} from ChromaDB")
    except Exception as e:
        logger.warning(f"Failed to delete chunks for paper {paper_id} from ChromaDB: {e}")
        raise
