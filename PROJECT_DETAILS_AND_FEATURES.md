# ResearchGap AI — Complete System Details & Feature Guide

**ResearchGap AI** is an advanced, automated **Research Gap Discovery Engine & Academic Knowledge Graph Platform**. It enables researchers, academics, and R&D teams to upload batches of 20–100+ scientific papers (PDFs), automatically extract structured research taxonomies (methods, domains, datasets, metrics, and tasks), construct an interactive Neo4j knowledge graph, and algorithmically discover unexplored, high-impact research opportunities.

---

## 📋 Table of Contents

1. [Executive Summary & Problem Statement](#1-executive-summary--problem-statement)
2. [High-Level Architecture](#2-high-level-architecture)
3. [Complete Feature Breakdown](#3-complete-feature-breakdown)
   - [1. Multi-Project Management](#1-multi-project-management)
   - [2. PDF Parsing & Automated Ingestion Pipeline](#2-pdf-parsing--automated-ingestion-pipeline)
   - [3. LLM-Powered Entity & Taxonomy Extraction](#3-llm-powered-entity--taxonomy-extraction)
   - [4. Interactive Knowledge Graph & Visual Analytics](#4-interactive-knowledge-graph--visual-analytics)
   - [5. Algorithmic Research Gap Discovery](#5-algorithmic-research-gap-discovery)
   - [6. RAG-Grounded AI Research Proposal Generator](#6-rag-grounded-ai-research-proposal-generator)
   - [7. Multi-Modal Semantic Search Engine](#7-multi-modal-semantic-search-engine)
   - [8. Deep Inspection Drawers & Analytics Panels](#8-deep-inspection-drawers--analytics-panels)
4. [Data Models & Schema Specifications](#4-data-models--schema-specifications)
   - [Neo4j Graph Database Schema](#neo4j-graph-database-schema)
   - [ChromaDB Vector Store Schema](#chromadb-vector-store-schema)
   - [SQLite Fallback Database Schema](#sqlite-fallback-database-schema)
5. [Complete REST API Reference](#5-complete-rest-api-reference)
6. [Frontend Page & Component Architecture](#6-frontend-page--component-architecture)
7. [Technology Stack](#7-technology-stack)
8. [Installation, Configuration & Quick Start](#8-installation-configuration--quick-start)
9. [Engineering & Architectural Decisions](#9-engineering--architectural-decisions)
10. [Roadmap & Future Enhancements](#10-roadmap--future-enhancements)

---

## 1. Executive Summary & Problem Statement

### The Problem
Scientific literature expands by millions of publications annually. Researchers face significant challenges:
* **Information Overload**: Reading and manually cross-referencing dozens or hundreds of papers is slow and tedious.
* **Siloed Knowledge**: Research methods developed in one domain (e.g., computer vision) often take years to cross over into other domains (e.g., material science or genomics).
* **Identifying True Novelty**: Finding genuinely unexplored combinations of methods and application domains—without accidentally re-inventing existing work—requires exhaustive literature mapping.

### The Solution: ResearchGap AI
ResearchGap AI transforms unstructured academic PDFs into a structured knowledge graph and vector space. By performing topological graph traversal combined with Retrieval-Augmented Generation (RAG):
* It pinpoints **Method × Domain pairs** that have no direct connections in the literature corpus.
* It evaluates each gap using multi-dimensional scoring (Novelty, Feasibility, Impact, Risk).
* It auto-generates comprehensive, literature-grounded **Research Proposals** (problem statements, hypotheses, blueprints, and citation references).

---

## 2. High-Level Architecture

```
                                  +-----------------------+
                                  |   React 18 Frontend   |
                                  | Vite + Tailwind + App |
                                  +-----------+-----------+
                                              |
                                      REST API / JSON
                                              v
                                  +-----------------------+
                                  |    FastAPI Backend    |
                                  |   (Python 3.13 Async) |
                                  +-----+-----------+-----+
                                        |           |
            +---------------------------+           +---------------------------+
            |                           |                                       |
            v                           v                                       v
+------------------------+  +-----------------------+               +-----------------------+
|    PDF Parser Engine   |  |   Hybrid LLM Client   |               |  Vector Embeddings    |
| (PyMuPDF + pdfplumber) |  | (Claude API / Ollama) |               | (ChromaDB + Sentence) |
+------------------------+  +-----------------------+               +-----------------------+
                                        |                                       |
                                        +-------------------+-------------------+
                                                            |
                                                            v
                                                +-----------------------+
                                                |   Neo4j Graph DB      |
                                                | (AuraDB / Local 5.x)  |
                                                |  (SQLite Fallback)    |
                                                +-----------------------+
```

---

## 3. Complete Feature Breakdown

### 1. Multi-Project Management
* **Project Workspaces**: Create, switch, list, and manage distinct research workspaces (e.g., "Medical Imaging LLMs", "Quantum Optimization").
* **Isolated Data Scoping**: Every project maintains its own isolated graph network and vector collection via project context headers (`X-Project-ID`).
* **Project Statistics**: Instant dashboard visibility into paper counts, extracted methods, domains, and gap opportunities per project.

### 2. PDF Parsing & Automated Ingestion Pipeline
* **Drag-and-Drop Batch Upload**: Upload batches of 20 to 100+ academic PDFs simultaneously.
* **Hybrid Text Extraction**: Uses `PyMuPDF` (fitz) for fast text and section extraction, falling back to `pdfplumber` for complex layout formatting.
* **Scanned PDF Handling**: Detects image-only/scanned PDFs (`is_scanned=True`), gracefully flagging them without breaking batch execution.
* **Real-time Pipeline Tracking**: Multi-stage progress tracking per paper:
  `Uploading` ➔ `Parsing Text` ➔ `LLM Taxonomy Extraction` ➔ `Vector Embedding` ➔ `Graph Injection`.
* **Automated Deduplication**: Prevents duplicate processing by computing title and content hashes.

### 3. LLM-Powered Entity & Taxonomy Extraction
* **Structured Information Extraction**: Uses LLMs (Anthropic Claude API `claude-sonnet-4-5` or local Ollama LLMs such as `llama3`, `mistral`, `phi3`) to parse paper text into structured JSON:
  * **Paper Metadata**: Title, Authors, Publication Year, Abstract.
  * **Methods**: Name, Category, Core Rationale, Novelty, Known Limitations.
  * **Application Domains**: Name, Subfield, Target Tasks, Real-world Context.
  * **Datasets & Metrics**: Benchmark datasets used, evaluation metrics reported.
  * **Semantic Relationships**: Extracted graph edges linking papers, methods, domains, datasets, and metrics.
* **30+ Acronym & Name Normalization Rules**: Automated normalization (lowercase ➔ whitespace collapse ➔ synonym mapping e.g. `XAI` ➔ `Explainable AI`, `CNN` ➔ `Convolutional Neural Network` ➔ Title Case) to eliminate redundant graph nodes.

### 4. Interactive Knowledge Graph & Visual Analytics
* **2D Force-Directed Graph Engine**: Powered by `react-force-graph-2d` for interactive zoom, drag, pan, and node inspection.
* **Color-Coded Multi-Node Entity Schema**:
  * 🔵 **Paper** (`#3B82F6`) — Academic publication node.
  * 🟢 **Method** (`#10B981`) — Algorithmic technique or model.
  * 🟡 **Domain** (`#F59E0B`) — Application field or subject domain.
  * 🟣 **Task** (`#8B5CF6`) — Target objective or problem task.
  * 🔴 **Metric** (`#F43F5E`) — Evaluation metric.
  * 🩵 **Dataset** (`#06B6D4`) — Benchmark dataset.
* **Dynamic Graph Filtering**: Filter by node types, edge relationship types, search text, or minimum node degree connection.
* **Graph Analytics Panel**: Real-time display of total nodes, edges, graph density, average degree centrality, top hub nodes, and graph components.

### 5. Algorithmic Research Gap Discovery
* **Unexplored Combination Mining**: Traverses the graph to discover pairs of **(Method M, Domain D)** where no paper in the corpus has applied Method **M** to Domain **D**.
* **Multidimensional Opportunity Scoring**:
  * 🎯 **Novelty Score (0–100%)**: Based on topological distance and path absence in the knowledge graph.
  * ⚡ **Feasibility Score (0–100%)**: Assesses method prerequisites against domain data constraints.
  * 📈 **Domain Impact Score (0–100%)**: Measures potential performance jump and domain transformation.
  * ⚠️ **Technical Risk Rating**: Categorized into Low, Medium, or High risk.
* **Structural Graph Indicators**: Highlights missing bridge edges, disconnected subgraphs, and cross-domain transfer opportunities.

### 6. RAG-Grounded AI Research Proposal Generator
* **Retrieval-Augmented Context Retrieval**: Uses ChromaDB vector search (`all-MiniLM-L6-v2`) to pull exact relevant paper chunks contextually tied to the target Method and Domain.
* **Automated Proposal Generation**: LLM constructs a complete, structured research blueprint:
  * **Suggested Paper Title**: Publication-ready title.
  * **Problem Statement**: Detailed explanation of why applying Method M to Domain D is non-trivial and valuable.
  * **Research Hypothesis**: Scientific hypothesis to be tested.
  * **Methodology Blueprint**: Step-by-step adaptation strategy.
  * **Expected Contributions**: Theoretical and empirical expected outcomes.
  * **Literature Justification & Citation Seeds**: Relevant papers from the corpus supporting the gap.

### 7. Multi-Modal Semantic Search Engine
* **Unified Academic Search**: Simultaneous search across Papers, Methods, Domains, Datasets, and Research Gaps.
* **Hybrid Search Strategy**: Combines vector semantic similarity, keyword matching, and graph neighborhood expansion.
* **Instant Filtering & Snippets**: Filter by entity category, date range, or confidence score with direct navigation to graph nodes or paper detail drawers.

### 8. Deep Inspection Drawers & Analytics Panels
* **Paper Detail Drawer**: Full view of paper metadata, abstract, extracted methods/domains list, extracted vector text chunks, and source PDF preview.
* **Node Detail Panel**: Detailed view of any selected node, its 1st-degree neighbors, connected papers, incoming/outgoing relationship edges, and centrality metrics.
* **Stat Detail Panel**: In-depth analytics dashboard breaking down global project statistics, distribution charts, and ingestion status.

---

## 4. Data Models & Schema Specifications

### Neo4j Graph Database Schema

#### Node Labels & Properties
```cypher
// Paper Node
(:Paper {
  paper_id: STRING [UNIQUE, PRIMARY KEY],
  title: STRING,
  authors: LIST<STRING>,
  year: INTEGER,
  filename: STRING,
  created_at: STRING
})

// Method Node
(:Method {
  name: STRING [UNIQUE, PRIMARY KEY],
  category: STRING,
  description: STRING,
  normalized_name: STRING
})

// Domain Node
(:Domain {
  name: STRING [UNIQUE, PRIMARY KEY],
  subfield: STRING,
  description: STRING,
  normalized_name: STRING
})

// Dataset Node
(:Dataset {
  name: STRING [UNIQUE, PRIMARY KEY],
  domain: STRING
})

// Metric Node
(:Metric {
  name: STRING [UNIQUE, PRIMARY KEY]
})
```

#### Relationship Types & Edges
* `(:Paper)-[:USES_METHOD]->(:Method)`
* `(:Paper)-[:STUDIES_DOMAIN]->(:Domain)`
* `(:Paper)-[:BENCHMARKED_ON]->(:Dataset)`
* `(:Paper)-[:EVALUATED_BY]->(:Metric)`
* `(:Method)-[:APPLIED_TO]->(:Domain)`
* `(:Method)-[:IMPROVES_UPON]->(:Method)`
* `(:Method)-[:COMBINED_WITH]->(:Method)`

---

### ChromaDB Vector Store Schema
* **Collection**: `research_papers_{project_id}`
* **Embedding Model**: `sentence-transformers/all-MiniLM-L6-v2` (384 dimensions)
* **Chunk Metadata**:
  ```json
  {
    "paper_id": "p_12345",
    "filename": "paper_example.pdf",
    "chunk_index": 0,
    "section": "Abstract / Introduction / Methodology",
    "project_id": "default"
  }
  ```

---

### SQLite Fallback Database Schema
When running offline or without Neo4j, the system seamlessly uses a local SQLite database (`data/researchgap.db`):
* `papers`: `(paper_id TEXT PRIMARY KEY, title TEXT, authors TEXT, year INT, filename TEXT, raw_text TEXT)`
* `methods`: `(name TEXT PRIMARY KEY, category TEXT, description TEXT)`
* `domains`: `(name TEXT PRIMARY KEY, subfield TEXT, description TEXT)`
* `paper_methods`: `(paper_id TEXT, method_name TEXT)`
* `paper_domains`: `(paper_id TEXT, domain_name TEXT)`
* `method_domains`: `(method_name TEXT, domain_name TEXT)`

---

## 5. Complete REST API Reference

| Group | Method | Endpoint | Description |
|-------|--------|----------|-------------|
| **Projects** | `GET` | `/api/projects` | List all research projects |
| | `POST` | `/api/projects` | Create a new research project workspace |
| | `GET` | `/api/projects/{id}` | Get project metadata & stats |
| | `DELETE` | `/api/projects/{id}` | Delete a project workspace and its data |
| **Upload** | `POST` | `/api/upload` | Upload multiple PDF papers (multipart/form-data) |
| | `GET` | `/api/upload/status` | Poll ingestion progress for all active papers |
| | `GET` | `/api/upload/status/{id}`| Poll ingestion progress for a single paper |
| **Extraction**| `POST` | `/api/extract/{id}` | Manually trigger LLM taxonomy extraction on a paper |
| **Papers** | `GET` | `/api/papers` | Get list of all ingested papers with metadata |
| | `GET` | `/api/papers/{id}` | Get comprehensive paper details & extracted entities |
| | `DELETE` | `/api/papers/{id}` | Delete paper, its graph nodes, and vector chunks |
| **Graph** | `GET` | `/api/graph/data` | Fetch full node/edge graph JSON for visualization |
| | `GET` | `/api/graph/stats` | Fetch graph metrics (node count, edge count, density) |
| | `GET` | `/api/graph/node/{id}`| Fetch specific node details & neighbor connections |
| **Gaps** | `GET` | `/api/gaps/analyze` | Run gap engine & return ranked gap opportunities |
| | `POST` | `/api/gaps/suggest` | Generate RAG-grounded AI research proposal statement |
| **Search** | `GET` | `/api/search` | Execute multi-modal search (query, type, limit) |
| **System** | `GET` | `/api/health` | Health check endpoint (Neo4j, ChromaDB, LLM status) |

---

## 6. Frontend Page & Component Architecture

### Application Pages (`frontend/src/pages/`)
1. `ProjectsPage.jsx`: Project workspace switcher, project creation modal, and overview cards.
2. `UploadPage.jsx`: Drag-and-drop file uploader, batch queue manager, and upload settings.
3. `ProcessingPage.jsx`: Real-time paper processing progress dashboard with stage indicators.
4. `DashboardPage.jsx`: High-level system dashboard featuring quick stats, top entities, recent papers, and system status.
5. `GraphPage.jsx`: Interactive 2D knowledge graph viewer with control panels, filters, and node inspector.
6. `GapsPage.jsx`: Research gap discovery matrix, gap filtering controls, score breakdown, and AI proposal generator modal.
7. `SearchPage.jsx`: Multi-modal search page with filters by entity category, date, and relevance score.

### Key Components (`frontend/src/components/`)
* `Navbar.jsx`: Navigation bar with project switcher, active project indicator, and system health status.
* `GapCard.jsx`: Interactive card displaying gap metrics (Novelty, Feasibility, Impact), risk rating, and proposal trigger.
* `GraphAnalyticsPanel.jsx`: Floating panel over graph page displaying density, degree distribution, and top hub nodes.
* `NodeDetailPanel.jsx`: Side-drawer for exploring selected graph node metadata, connected edges, and paper sources.
* `PaperDetailDrawer.jsx`: Slide-out panel for reading paper abstract, extracted taxonomy, and chunk text.
* `PaperProgressCard.jsx`: Progress bar card representing ingestion stage for each uploaded PDF.
* `StatDetailPanel.jsx`: Detailed statistical breakdown panel for project metrics.
* `Toast.jsx`: Global notification toast system.

---

## 7. Technology Stack

| Layer | Technology / Library | Version | Purpose |
|-------|----------------------|---------|---------|
| **Frontend UI** | React | `^18.3.1` | Component-based interactive UI |
| **Build Tool** | Vite | `^5.4.0` | High-performance dev server & bundler |
| **Styling** | TailwindCSS | `^3.4.0` | Custom modern responsive styling |
| **State Management** | Zustand | `^4.5.0` | Fast, lightweight global state management |
| **Graph Visualization**| `react-force-graph-2d` | `^1.25.0` | 2D canvas force-directed graph rendering |
| **Icons** | Lucide React | `^0.420.0` | Clean, modern iconography |
| **Backend Framework** | FastAPI | `^0.115.0` | Asynchronous high-performance Python REST API |
| **Language** | Python | `3.13` | Core backend execution engine |
| **PDF Parsing** | PyMuPDF (fitz) + pdfplumber | `^1.24.0` | Fast text extraction & PDF layout parsing |
| **Primary LLM** | Anthropic Claude API | `claude-sonnet-4-5` | High-accuracy structured JSON taxonomy extraction |
| **Local LLM Fallback**| Ollama API | `llama3 / mistral` | Local offline LLM execution |
| **Vector Store** | ChromaDB | `^0.5.0` | Persistent vector database for semantic chunk retrieval |
| **Embedding Model** | `all-MiniLM-L6-v2` | Sentence-Transformers | Fast CPU vector embeddings (384 dimensions) |
| **Graph Database** | Neo4j AuraDB / Neo4j 5 | `^5.20.0` | Native property graph database |
| **Fallback Storage** | SQLite | Python Native | Zero-dependency local graph fallback |

---

## 8. Installation, Configuration & Quick Start

### Prerequisites
* **Python 3.11+** (Python 3.13 recommended)
* **Node.js 18+** & npm
* **Neo4j Account** (Optional: Free Neo4j AuraDB instance or local Neo4j 5)
* **API Key** (Anthropic Claude API Key or local Ollama installation)

---

### Step 1: Environment Configuration

Create a `.env` file in `researchgap-ai/backend/.env`:

```env
# Primary LLM Configuration
ANTHROPIC_API_KEY=sk-ant-api03-...
LLM_MODEL=claude-sonnet-4-5

# Optional Ollama Local LLM Configuration
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3

# Neo4j Graph Database Configuration
NEO4J_URI=neo4j+s://xxxxxxxx.databases.neo4j.io
NEO4J_USER=neo4j
NEO4J_PASSWORD=your_neo4j_password

# Vector & Data Path Configuration
VECTOR_DB_PATH=./data/chroma
DATA_RAW_PATH=./data/raw
EMBEDDING_MODEL=all-MiniLM-L6-v2
```

---

### Step 2: Backend Setup & Execution

```bash
# Navigate to backend directory
cd researchgap-ai/backend

# Create virtual environment
python -m venv venv

# Activate virtual environment
# On Windows:
venv\Scripts\activate
# On Mac/Linux:
# source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Start FastAPI server
uvicorn app.main:app --reload --port 8000
```
Backend API interactive documentation will be available at: http://localhost:8000/docs

---

### Step 3: Frontend Setup & Execution

```bash
# Open a new terminal and navigate to frontend directory
cd researchgap-ai/frontend

# Install dependencies
npm install

# Start Vite dev server
npm run dev
```
Frontend web application will be accessible at: http://localhost:5173

---

## 9. Engineering & Architectural Decisions

1. **Cloud Neo4j AuraDB Free with Local SQLite Fallback**:
   * *Decision*: Support both Neo4j AuraDB (cloud graph DB) and an automatic zero-config SQLite local database fallback.
   * *Rationale*: Eliminates compulsory local Docker setup while ensuring the application works out-of-the-box offline.

2. **Embedding Model: `all-MiniLM-L6-v2`**:
   * *Decision*: Use Sentence-Transformers `all-MiniLM-L6-v2`.
   * *Rationale*: Lightweight (~80MB), ultra-fast CPU inference (0.1s per chunk), producing 384-dimensional dense vectors without requiring GPU or external embedding API costs.

3. **ChromaDB over FAISS**:
   * *Decision*: Use ChromaDB for persistent vector storage.
   * *Rationale*: Native disk persistence, simple Python API, and native metadata filtering (by `paper_id` and `project_id`).

4. **FastAPI BackgroundTasks Pipeline**:
   * *Decision*: Use FastAPI built-in `BackgroundTasks` for PDF processing.
   * *Rationale*: Avoids complex Redis/Celery broker requirements for processing 20–100 PDF batches while providing clean async non-blocking execution.

5. **Entity Name Normalization Pipeline**:
   * *Decision*: Multi-stage string normalization (lower ➔ collapse whitespace ➔ 30+ synonym mapping ➔ Title Case).
   * *Rationale*: Prevents duplicate node creation in graph databases (e.g., prevents separate nodes for "BERT", "Bert", and "Bidirectional Encoder Representations from Transformers").

---

## 10. Roadmap & Future Enhancements

- [ ] **External Gap Validation**: Cross-check candidate gaps against arXiv / Semantic Scholar API to flag external false positives.
- [ ] **Node Merge / Split UI**: Human-in-the-loop graph editing for post-extraction entity curation.
- [ ] **Proposal Export to LaTeX & BibTeX**: Export research blueprints with `.tex` and `.bib` citation seeds.
- [ ] **Batch LLM Concurrency Control**: Async semaphore queue to prevent LLM API rate limit errors during 100+ PDF uploads.
- [ ] **Corpus Bias & Skew Warnings**: Entropy-based domain coverage warning for skewed paper sample sets.
- [ ] **Graph Versioning & Diffing**: Snapshot delta tracking showing gap emergence and closure over time.
- [ ] **Community Detection**: Louvain clustering for discovering implicit subfields in knowledge networks.
- [ ] **API Token & Cost Dashboard**: Per-project token usage and cost metrics tracker.
- [ ] **Scanned PDF OCR**: Integrate Tesseract OCR for scanned/image-only PDFs.
- [ ] **Multi-User Authentication**: JWT-based user authentication and collaborative project sharing.

---

## 11. Academic Limitations, Ground-Truth Validation & Publication Defensibility

When submitting scientific papers based on or introducing **ResearchGap AI** (e.g. to ACL, NeurIPS, EMNLP, or IEEE VIS), reviewers frequently evaluate gap discovery systems against key scientific standards:

### 1. Corpus-Dependency & Single-Corpus Bias
* *Limitation*: A gap defined as "Method M was never applied to Domain D" is inherently bounded by the uploaded paper sample (e.g. 20–100 papers).
* *Defensibility Strategy*: Incorporate live external API verification (arXiv API, Semantic Scholar API) to cross-reference candidate gaps globally, distinguishing local corpus gaps from true literature gaps.

### 2. Ground-Truth Validation & Held-out Rediscovery Benchmark
* *Limitation*: Lack of benchmark evaluation for gap discovery accuracy.
* *Defensibility Strategy*: Evaluate on a held-out historical benchmark dataset (e.g. 500 papers across 5 fields). Temporarily mask known groundbreaking paper connections (e.g., Transformers applied to Protein Folding) and evaluate **Top-K Recall** of rediscovery.

### 3. Human-in-the-Loop Curation
* *Limitation*: Unchecked LLM extraction hallucination risks propagating errors into knowledge graph edges.
* *Defensibility Strategy*: Provide human curation endpoints (`/api/graph/merge-nodes`) and entity extraction confidence scores (0.0–1.0) so researchers can review and refine extracted taxonomies before running gap analysis.

