# Engineering Decisions — ResearchGap AI

## Docker Not Available → Neo4j AuraDB Free

**Decision:** Use Neo4j AuraDB Free (cloud-hosted) instead of Docker-based Neo4j Community.

**Rationale:** The build machine does not have Docker installed. AuraDB Free provides the same Neo4j 5 interface with zero local setup — just a connection URI in `.env`. The Python `neo4j` driver connects identically to both.

**Action required:** Create a free instance at https://neo4j.com/cloud/platform/aura-graph-database/ and add credentials to `backend/.env`.

---

## Python 3.13 Compatibility

**Decision:** Target Python 3.13 (system Python), not 3.11.

**Rationale:** The system has 3.13.5. All dependencies (FastAPI, ChromaDB, sentence-transformers, PyMuPDF) support 3.13. No downgrade required.

---

## Embedding Model: all-MiniLM-L6-v2

**Decision:** Use `sentence-transformers/all-MiniLM-L6-v2` for embeddings.

**Rationale:** ~80MB, runs on CPU in 0.1–0.2s per chunk, produces 384-dim vectors adequate for cosine similarity retrieval within a 100-paper corpus. No GPU required. Switched from OpenAI embeddings to avoid an additional API key.

---

## No Celery / Redis in v1

**Decision:** Use FastAPI `BackgroundTasks` instead of Celery + Redis.

**Rationale:** For 20–100 PDFs in a prototype, FastAPI's built-in async background tasks are sufficient and require no additional infrastructure. Celery would add Redis as a new dependency and significant operational complexity. If scaling beyond 100+ PDFs, add Celery as a `TODO`.

---

## Claude Model: claude-sonnet-4-5

**Decision:** Default to `claude-sonnet-4-5` (configurable via `LLM_MODEL` env var).

**Rationale:** Best balance of quality and speed for structured JSON extraction. Claude Haiku could be used for cost savings at scale.

---

## ChromaDB over FAISS

**Decision:** Use ChromaDB with persistent storage over FAISS.

**Rationale:** ChromaDB supports metadata filtering (by `paper_id`), has a simpler Python API, and persists to disk automatically — no manual index serialization. FAISS would require manual save/load logic and lacks native metadata support.

---

## Scanned PDF Handling

**Decision:** Flag scanned PDFs with `is_scanned=True` and `error` field — don't crash.

**Rationale:** Image-only PDFs produce no extractable text. Rather than hard-failing the batch, the system flags them, skips extraction, and continues processing other papers. A future version could integrate Tesseract OCR.

---

## Name Normalization Strategy

**Decision:** Normalize method/domain names via: lowercase → strip → collapse whitespace → synonym map → `.title()`.

**Rationale:** Without normalization, "BERT", "Bert", "bert" would create 3 graph nodes. The synonym map handles 30+ common abbreviations (XAI → Explainable AI, NLP → NLP, etc.). Applied before graph insertion and displayed normalized.

---

## Auth

**Decision:** No authentication in v1.

**Rationale:** Prototype scope. All endpoints are open. Add JWT Bearer auth (FastAPI-Users or python-jose) for production.

---

## Frontend Routing

**Decision:** Single-page app with Zustand-based page state (no React Router).

**Rationale:** 4 pages, linear workflow — no need for URL-based routing. Zustand store keeps it simple and avoids react-router-dom configuration.
