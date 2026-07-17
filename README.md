# ResearchGap AI

**Automatic Research Gap Discovery Engine** — upload 20–100 academic PDFs, extract methods and domains via Claude AI, build a knowledge graph, and discover unexplored research combinations.

---

## Architecture

```
[React Frontend]  →  [FastAPI Backend]  →  [Neo4j AuraDB]
                                       →  [ChromaDB (local)]
                                       →  [Anthropic Claude API]
```

## Quick Start

### 1. Prerequisites

- Python 3.11+
- Node.js 18+
- Neo4j AuraDB Free account → https://neo4j.com/cloud/platform/aura-graph-database/
- Anthropic API key → https://console.anthropic.com/

### 2. Backend Setup

```bash
cd researchgap-ai/backend

# Create virtual environment
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # Mac/Linux

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env — fill in ANTHROPIC_API_KEY, NEO4J_URI, NEO4J_PASSWORD

# Start backend
uvicorn app.main:app --reload --port 8000
```

### 3. Frontend Setup

```bash
cd researchgap-ai/frontend

npm install
npm run dev
```

Open http://localhost:5173

### 4. Environment Variables (`backend/.env`)

```env
ANTHROPIC_API_KEY=sk-ant-...
NEO4J_URI=neo4j+s://xxxxxxxx.databases.neo4j.io
NEO4J_USER=neo4j
NEO4J_PASSWORD=your_aura_password
VECTOR_DB_PATH=./data/chroma
DATA_RAW_PATH=./data/raw
LLM_MODEL=claude-sonnet-4-5
EMBEDDING_MODEL=all-MiniLM-L6-v2
```

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST   | `/api/upload` | Upload PDFs (multipart) |
| GET    | `/api/upload/status` | Poll all paper statuses |
| GET    | `/api/upload/status/{id}` | Poll single paper |
| POST   | `/api/extract/{id}` | Manual LLM extraction trigger |
| GET    | `/api/graph/stats` | Node/edge counts |
| GET    | `/api/graph/data` | Full graph for visualization |
| GET    | `/api/gaps/analyze` | Ranked gap candidates |
| POST   | `/api/gaps/suggest` | RAG-grounded AI suggestions |
| GET    | `/api/health` | System health check |

---

## Workflow

1. **Upload** — drag-and-drop PDFs on the Upload page
2. **Processing** — watch real-time progress per paper (parse → extract → embed → graph)
3. **Graph** — explore the interactive force-graph knowledge map
4. **Gaps** — analyze missing Method×Domain pairs and generate AI research opportunity statements

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18 + Vite + TailwindCSS |
| Graph viz | react-force-graph-2d |
| State | Zustand + TanStack Query |
| Backend | FastAPI + Python 3.13 |
| PDF parsing | PyMuPDF + pdfplumber |
| LLM | Anthropic Claude (claude-sonnet-4-5) |
| Vector store | ChromaDB + sentence-transformers |
| Graph DB | Neo4j AuraDB Free |

---

## Limitations & TODOs

- [ ] OCR for scanned PDFs (Tesseract integration)
- [ ] Celery + Redis for 100+ PDF batches
- [ ] JWT authentication
- [ ] Export gap report as PDF/Markdown
- [ ] Paper deduplication by title similarity
- [ ] Multi-user support with namespaced graphs
