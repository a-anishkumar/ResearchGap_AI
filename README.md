# 🔬 ResearchGap AI

> **Automatic Research Gap Discovery Engine** — Upload academic PDFs, let AI extract entities, build a knowledge graph, and surface unexplored research opportunities.

[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?style=flat&logo=fastapi)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=flat&logo=react)](https://react.dev)
[![Neo4j](https://img.shields.io/badge/Neo4j-AuraDB-008CC1?style=flat&logo=neo4j)](https://neo4j.com/cloud/platform/aura-graph-database/)
[![Python](https://img.shields.io/badge/Python-3.13-3776AB?style=flat&logo=python)](https://python.org)
[![Vite](https://img.shields.io/badge/Vite-6-646CFF?style=flat&logo=vite)](https://vitejs.dev)

---

## Table of Contents

1. [Project Overview](#-project-overview)
2. [Core Features](#-core-features)
3. [Tech Stack](#-tech-stack)
4. [Architecture](#-architecture)
5. [How It Works — System Workflow](#-how-it-works--system-workflow)
6. [AI / LLM Pipeline](#-ai--llm-pipeline)
7. [UI/UX Design System](#-uiux-design-system)
8. [File Structure](#-file-structure)
9. [API Reference](#-api-reference)
10. [Setup and Installation](#-setup--installation)
11. [Environment Variables](#-environment-variables)
12. [Running the App](#-running-the-app)

---

## Project Overview

**ResearchGap AI** is a full-stack web application that automates the traditionally time-consuming process of systematic literature review and research gap identification. Researchers upload batches of academic PDFs and the system will:

- **Extract** structured metadata (title, authors, year, methods, domains, datasets, results) using LLMs
- **Build** a knowledge graph connecting papers, methods, domains, and authors
- **Identify** research gaps — combinations of methods, domains, and datasets that are under-explored
- **Generate** detailed grant proposal blueprints for promising research directions
- **Enable** semantic search and AI-powered Q&A over the entire paper corpus
- **Visualize** the citation timeline, author collaboration network, and knowledge graph

The system supports **multi-project workspaces** so researchers can maintain isolated corpora for different research domains.

---

## Core Features

| Feature | Description |
|---------|-------------|
| Batch PDF Upload | Drag-and-drop upload for multiple PDFs up to 50MB each |
| AI Extraction | Automatic extraction of 7 entity types: title, authors, year, methods, domains, datasets, results |
| Knowledge Graph | Interactive force-directed graph showing method/domain/dataset relationships |
| Research Gap Analysis | AI scoring of unexplored method x domain combinations |
| Proposal Generator | 7-section grant proposal blueprints with AI polish |
| Paper Chat | RAG-powered Q&A chatbot over all uploaded papers |
| Paper Compare | Side-by-side AI comparison of any two papers |
| Citation Timeline | Year-by-year chart showing paper volume and domain shifts |
| Author Network | Force-directed co-authorship graph with Semantic Scholar data |
| Multi-Project | Isolated workspace namespacing for different research corpora |
| Stat Explorer | Click-through drill-down on all extracted entities from dashboard |
| Export | Export the full knowledge graph as JSON |

---

## Tech Stack

### Backend

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| API Framework | FastAPI | 0.115.6 | Async REST API with OpenAPI docs |
| Runtime | Python | 3.13 | Core language |
| Schema Validation | Pydantic v2 | 2.10.6 | Request/response + LLM output validation |
| Settings | pydantic-settings | 2.7.1 | Typed .env config management |
| PDF Parsing | PyMuPDF fitz | 1.25.3 | Primary PDF text/metadata extractor |
| PDF Parsing fallback | pdfplumber | 0.11.5 | Fallback for complex PDF layouts |
| Primary LLM | Google Gemini | gemini-2.5-flash-lite | Entity extraction, gap analysis, proposals |
| Local LLM | Ollama | llama3.2 | Offline fallback for extraction |
| Graph Database | Neo4j AuraDB | 5.28.1 | Knowledge graph storage and Cypher queries |
| SQLite Fallback | aiosqlite built-in | — | Auto-fallback when Neo4j unavailable |
| Vector Store | ChromaDB | 0.6.3 | Semantic embeddings for RAG search |
| Embeddings | sentence-transformers | 3.4.1 | all-MiniLM-L6-v2 local embedding model |
| HTTP Client | httpx | 0.28.1 | Async calls to Semantic Scholar API |
| Retry Logic | tenacity | 9.0.0 | Exponential backoff for LLM/API calls |
| ASGI Server | Uvicorn | 0.34.0 | Production-grade async server |
| External API | Semantic Scholar | v1 | Author metadata and publication lookup |

### Frontend

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| UI Framework | React | 18 | Component-based SPA |
| Build Tool | Vite | 6 | Fast HMR dev server + bundler |
| State Management | Zustand | 4 | Lightweight global store |
| HTTP Client | Axios | — | REST calls to FastAPI backend |
| Graph Visualization | react-force-graph-2d | — | Canvas-based force-directed graph |
| Chart Library | Recharts | — | Citation timeline charts |
| Styling | Tailwind CSS v3 | — | Utility-first CSS with custom tokens |
| Typography | Inter + Space Grotesk | — | Google Fonts |
| Icons | Inline SVG | — | No icon library dependency |
| Animations | CSS Animations | — | slide-up, fade-in, pulse-slow |

### Infrastructure

| Service | Purpose |
|---------|---------|
| Neo4j AuraDB | Managed cloud graph database |
| ChromaDB local | On-disk vector store for paper embeddings |
| Ollama optional | Self-hosted LLM inference |

---

## Architecture

`
Browser (React SPA)
  Dashboard | Knowledge Graph | Gaps | Chat | Timeline | Authors
  Zustand State Store
  axios -> /api/*
        |
        | HTTP REST
        v
FastAPI (Uvicorn) port 8000
  ProjectContextMiddleware (X-Project-Name header)
  Routers: /upload /graph /gaps /search /papers /projects /export /health
  Services:
    pdf_parser -> llm_extractor -> llm_client (Gemini/Ollama)
    graph_builder (Neo4j + SQLite) | rag (ChromaDB)
    gap_finder | proposal_service | paper_chat | s2_service
        |
  +----+----+----------+
  |         |          |
Gemini    Ollama   Semantic Scholar
API       local    API
  |
Neo4j AuraDB   (primary)
SQLite fallback (auto)
ChromaDB local  (vectors)
`

---

## How It Works — System Workflow

### Step 1 — Project Setup
1. User opens the app → Projects page loads
2. User creates or selects a project (e.g. quantum-nlp)
3. All API calls include X-Project-Name header via middleware
4. Neo4j/SQLite stores all data namespaced under the project

### Step 2 — Paper Upload
1. User drags PDFs to the Upload page
2. Frontend calls POST /api/upload with multipart form data
3. Files saved to ./data/raw/{project}/
4. Each paper gets UUID paper_id and enters processing_states
5. Backend spawns async background task: process_paper(paper_id)

### Step 3 — AI Extraction Pipeline

`
PDF file
  -> pdf_parser.py          extract raw text + page count
  -> llm_extractor.py       structured LLM prompt
  -> llm_client.py          Gemini or Ollama call
                            JSON: title, authors, year, methods[],
                                  domains[], datasets[], results[]
                            Pydantic validation + JSON repair
                            Retry with exponential backoff
  -> rag.py                 chunk -> embed -> ChromaDB
  -> graph_builder.py       write Paper + entity nodes to Neo4j
`

### Step 4 — Knowledge Graph Build
- Paper nodes linked to Method, Domain, Dataset nodes
- Relationships: USES_METHOD, IN_DOMAIN, USES_DATASET, CITES, CO_AUTHORED

### Step 5 — Research Gap Discovery
1. gap_finder.py queries Neo4j for all method x domain combinations
2. Counts co-occurrence frequency across papers
3. LLM scores each gap on novelty, feasibility, impact, literature support
4. Returns top N gaps ranked by composite AI score

### Step 6 — Proposal Generation
1. proposal_service.py retrieves top K chunks from ChromaDB
2. LLM generates 7-section proposal: Summary, Objectives, Background, Methodology, Outcomes, Timeline, Budget
3. Optional Polish step refines prose and adds citations

### Step 7 — Semantic Search / Chat
1. User types question -> query embedded -> ChromaDB retrieves top K chunks
2. LLM generates grounded answer with citations (paper title + page)

---

## AI / LLM Pipeline

### Hybrid LLM Client

Priority: Gemini (cloud) -> Ollama (local) -> Error

| Route | Trigger | Use Case |
|-------|---------|---------|
| Gemini gemini-2.5-flash-lite | GEMINI_API_KEY is set | Default, fast, high quality |
| Ollama llama3.2 | USE_OLLAMA=true | Privacy mode, fully local |
| Anthropic Claude | ANTHROPIC_API_KEY is set | Optional premium quality |

### Output Reliability Layer

Every LLM output passes through 3-stage validation:

`
Raw LLM text
  -> _normalize_json_text()   strip markdown, fix JSON syntax
  -> Pydantic validation       schema check
       Pass -> return result
       Fail -> 1-pass LLM repair -> re-validate
                  Fail -> log error, return fallback
`

Validated models: PaperExtraction, GapResult, ProposalSection, ChatResponse, ComparisonResult

### RAG Configuration

`
Vector DB:    ChromaDB (local)
Collection:   researchgap_{project_name}
Embedding:    all-MiniLM-L6-v2 (384-dim, local)
Chunk size:   ~500 tokens, 50-token overlap
Retrieval:    cosine similarity, top K=5
`

---

## UI/UX Design System

### Color Tokens

| Token | Value | Usage |
|-------|-------|-------|
| surface-900 | #0a0c14 | Page background |
| surface-800 | #10131f | Card backgrounds |
| brand-500 | #6172f3 | Primary accent, active nav |
| accent-cyan | #22d3ee | Secondary gradient |
| accent-purple | #a78bfa | Heading gradient |

### Typography

| Use | Font | Weight |
|-----|------|--------|
| Body text, labels | Inter | 400, 500, 600 |
| Headings, numbers | Space Grotesk | 700 |

### Design Principles

1. Glassmorphism — backdrop-blur + bg-white/[0.03] + border-white/5
2. Dark-first — all surfaces are dark navy; colors carry semantic meaning
3. Micro-animations — slide-up entry, hover scale, spinner overlays
4. Staggered renders — animationDelay: i * 50ms on list items
5. Status signaling — Green=success, Amber=warning, Red=error, Brand=active
6. Glow effects — active states get shadow-glow-brand; hover gets radial glow

### Navigation Architecture

`
Navbar (always visible)
  Logo -> Dashboard
  Core: Dashboard | Upload | Processing
  Analytics dropdown:
    Knowledge Graph | Timeline | Authors | Research Gaps | Search | Projects
  Project Switcher
  Health Pill (Neo4j status + Gemini)
`

### Component Library

| Component | Purpose |
|-----------|---------|
| Navbar.jsx | Top nav with Analytics dropdown |
| Toast.jsx | Success/error/info toast system |
| PaperDetailDrawer.jsx | Slide-in paper detail panel + chat |
| CompareModal.jsx | Side-by-side paper comparison modal |
| GapCard.jsx | Research gap card with proposal trigger |
| ProposalModal.jsx | Full-screen proposal viewer/editor |
| NodeDetailPanel.jsx | Graph node detail side panel |
| GraphAnalyticsPanel.jsx | Graph controls + legend |
| StatDetailPanel.jsx | Dashboard stat drill-down |
| PaperProgressCard.jsx | Processing status per paper |
| LiteratureConnectorModal.jsx | Paper connection builder |

---

## File Structure

`
researchgap-ai/
  README.md
  TECH_STACK.md
  DECISIONS.md
  PROJECT_DETAILS_AND_FEATURES.md
  SYSTEM_GAP_ANALYSIS_AND_ROADMAP.md
  .gitignore

  backend/
    .env                        environment variables (gitignored)
    .env.example                template for new developers
    requirements.txt            Python dependencies

    app/
      main.py                   FastAPI app + lifespan + middleware + routers

      core/
        config.py               Pydantic Settings (reads .env)
        neo4j_driver.py         Neo4j async driver + SQLite fallback
        claude_client.py        Anthropic Claude client (optional)
        ollama_client.py        Ollama local LLM client
        project.py              ProjectContextMiddleware

      models/
        schemas.py              All Pydantic request/response schemas

      routers/
        upload.py               POST /api/upload, GET /api/status
        extract.py              GET /api/extract/{paper_id}
        graph.py                GET /api/graph/*, /api/stats
        gaps.py                 POST /api/gaps/analyze, /proposal
        search.py               POST /api/search/*, /papers/chat
        papers.py               GET/DELETE /api/papers/*
        projects.py             GET/POST/DELETE /api/projects
        export.py               GET /api/export/graph

      services/
        llm_client.py           Hybrid LLM router + Output Reliability Layer
        llm_extractor.py        Extraction prompt builder
        pdf_parser.py           PDF text extraction (PyMuPDF + pdfplumber)
        paper_analyzer.py       Extraction pipeline orchestrator
        graph_builder.py        Neo4j/SQLite read/write operations
        rag.py                  ChromaDB embed/query
        gap_finder.py           Gap scoring algorithm
        proposal_service.py     7-section proposal generation
        paper_chat.py           RAG Q&A chatbot
        s2_service.py           Semantic Scholar API client

    data/
      raw/                      Uploaded PDFs (per project subfolder)
      chroma/                   ChromaDB vector store

    scratch/                    Dev/test scripts
    tests/                      Unit tests

  frontend/
    index.html                  Vite entry
    vite.config.js              Proxy: /api -> localhost:8000
    tailwind.config.js          Design tokens + animations
    package.json

    src/
      main.jsx                  React DOM mount
      App.jsx                   Page router + PageTransition
      index.css                 Global CSS + design system

      api/
        client.js               Axios instance + all API functions
        store.js                Zustand global state

      pages/
        DashboardPage.jsx       Stats grid + workflow stepper + quick actions
        UploadPage.jsx          Drag-drop upload
        ProcessingPage.jsx      Real-time paper status
        GraphPage.jsx           Knowledge graph explorer
        GapsPage.jsx            Gap list + proposal trigger
        SearchPage.jsx          Semantic search + chat
        TimelineView.jsx        Citation timeline chart
        AuthorNetworkView.jsx   Co-authorship graph
        ProjectsPage.jsx        Project CRUD manager

      components/
        Navbar.jsx              Top nav (Core + Analytics dropdown)
        Toast.jsx               Toast notification system
        PaperDetailDrawer.jsx   Paper side panel + chat
        CompareModal.jsx        Paper comparison modal
        GapCard.jsx             Research gap card
        ProposalModal.jsx       Grant proposal viewer
        NodeDetailPanel.jsx     Graph node details
        GraphAnalyticsPanel.jsx Graph controls
        StatDetailPanel.jsx     Dashboard drill-down
        PaperProgressCard.jsx   Processing progress
        LiteratureConnectorModal.jsx
`

---

## API Reference

Base URL: http://localhost:8000
Interactive docs: http://localhost:8000/docs

All project-scoped endpoints require X-Project-Name header (set automatically by frontend).

### Upload and Processing

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/upload | Upload PDF files multipart |
| GET | /api/status | Get all paper processing states |
| GET | /api/status/{paper_id} | Get single paper status |
| DELETE | /api/papers/{paper_id} | Delete a paper |

### Knowledge Graph

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/graph | Full graph nodes + links |
| GET | /api/graph/stats | Entity counts |
| GET | /api/graph/timeline | Papers grouped by year |
| GET | /api/graph/authors | Co-authorship network |
| GET | /api/graph/node/{node_id} | Node detail |
| GET | /api/export/graph | Export graph as JSON |

### Research Gaps

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/gaps/analyze | Run gap analysis |
| POST | /api/gaps/proposal | Generate proposal for a gap |
| POST | /api/gaps/proposal/polish | AI-polish a proposal |

### Search and Chat

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/search | Semantic search over corpus |
| POST | /api/search/chat | RAG chat with full corpus |
| POST | /api/papers/chat | Chat about a specific paper |
| POST | /api/papers/compare | Compare two papers |

### Projects

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/projects | List all projects |
| DELETE | /api/projects/{name} | Delete project + all data |

### Health

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/health | Neo4j status, ChromaDB doc count, Gemini key |

---

## Setup and Installation

### Prerequisites

- Python 3.11+ (3.13 recommended)
- Node.js 20+ and npm
- Git
- Google Gemini API key — get one free at https://aistudio.google.com/app/apikey
- Optional: Neo4j AuraDB free instance — app auto-falls back to SQLite
- Optional: Ollama for local LLM inference

### 1. Clone

`ash
git clone https://github.com/your-username/researchgap-ai.git
cd researchgap-ai
`

### 2. Backend

`ash
cd backend

# Create and activate virtual environment
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # macOS/Linux

# Install dependencies
pip install -r requirements.txt
`

### 3. Environment

`ash
cp .env.example .env
# Edit .env with your values
`

### 4. Frontend

`ash
cd ../frontend
npm install
`

---

## Environment Variables

Edit backend/.env:

`
# Required
GEMINI_API_KEY=your_gemini_api_key_here

# Neo4j (Optional — SQLite fallback if not set)
NEO4J_URI=neo4j+s://xxxxxxxx.databases.neo4j.io
NEO4J_USER=neo4j
NEO4J_PASSWORD=your_neo4j_password

# Storage
VECTOR_DB_PATH=./data/chroma
DATA_RAW_PATH=./data/raw

# Model Config
LLM_MODEL=gemini-2.5-flash-lite
EMBEDDING_MODEL=all-MiniLM-L6-v2
TOP_GAPS=20
RAG_TOP_K=5
MAX_UPLOAD_MB=50

# Ollama (Optional local LLM)
USE_OLLAMA=false
OLLAMA_HOST=http://localhost:11434
OLLAMA_MODEL=llama3.2
`

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| GEMINI_API_KEY | Yes | — | Google Gemini API key |
| NEO4J_URI | Optional | — | AuraDB URI (SQLite if missing) |
| NEO4J_USER | Optional | neo4j | Neo4j username |
| NEO4J_PASSWORD | Optional | — | Neo4j password |
| LLM_MODEL | No | gemini-2.5-flash-lite | Gemini model name |
| EMBEDDING_MODEL | No | all-MiniLM-L6-v2 | Embedding model |
| TOP_GAPS | No | 20 | Max gaps to analyze |
| RAG_TOP_K | No | 5 | Chunks per RAG query |
| MAX_UPLOAD_MB | No | 50 | Max PDF file size in MB |
| USE_OLLAMA | No | false | Enable local Ollama |
| OLLAMA_MODEL | No | llama3.2 | Ollama model name |

---

## Running the App

### Backend (terminal 1)

`ash
cd backend
venv\Scripts\activate
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
`

API: http://localhost:8000
Swagger docs: http://localhost:8000/docs

### Frontend (terminal 2)

`ash
cd frontend
npm run dev
`

App: http://localhost:5173

Vite proxy forwards /api/* to localhost:8000 automatically.

### Optional: Ollama

`ash
# Install from https://ollama.ai
ollama pull llama3.2
# Then set USE_OLLAMA=true in .env
`

---

## Roadmap

- Export proposals to PDF
- Batch paper comparison (3+)
- Citation graph from reference parsing
- ORCID/PubMed/arXiv direct import
- Multi-user auth + team workspaces
- Real-time collaborative proposal editing

---

## License

MIT License

---

## Acknowledgements

- Semantic Scholar API — Author data
- ChromaDB — Vector database
- Neo4j AuraDB — Graph database
- Google Gemini — Primary LLM
- Ollama — Local LLM inference
- react-force-graph — Graph visualization

---

Built for researchers who want to find what has not been done yet.
