from pydantic import BaseModel, Field
from typing import Optional


# ── Paper extraction (LLM output) ────────────────────────────────────────────

class ResultItem(BaseModel):
    metric: str = ""
    value: str = ""
    description: str = ""


class PaperExtraction(BaseModel):
    title: str = Field(default="Unknown Title")
    authors: list[str] = Field(default_factory=list)
    year: Optional[int] = None
    methods: list[str] = Field(default_factory=list)
    domains: list[str] = Field(default_factory=list)
    datasets: list[str] = Field(default_factory=list)
    results: list[ResultItem] = Field(default_factory=list)


# ── Upload / processing ───────────────────────────────────────────────────────

class PaperMeta(BaseModel):
    paper_id: str
    filename: str
    page_count: int
    status: str  # "uploaded" | "parsed" | "extracted" | "embedded" | "graphed" | "error"
    error: Optional[str] = None


class UploadResponse(BaseModel):
    papers: list[PaperMeta]


class ExtractResponse(BaseModel):
    paper_id: str
    extraction: PaperExtraction
    status: str


class BatchExtractResponse(BaseModel):
    results: list[ExtractResponse]
    errors: list[dict]


# ── Graph ─────────────────────────────────────────────────────────────────────

class GraphNode(BaseModel):
    id: str
    label: str
    type: str  # "Paper" | "Method" | "Domain" | "Dataset" | "Result"
    properties: dict = Field(default_factory=dict)


class GraphLink(BaseModel):
    source: str
    target: str
    type: str


class GraphData(BaseModel):
    nodes: list[GraphNode]
    links: list[GraphLink]


class GraphStats(BaseModel):
    papers: int
    methods: int
    domains: int
    datasets: int
    results: int
    relationships: int


# ── Gap analysis ──────────────────────────────────────────────────────────────

class GapCandidate(BaseModel):
    method: str
    domain: str
    method_frequency: int
    domain_frequency: int
    score: float  # method_freq * domain_freq


class GapSuggestion(BaseModel):
    method: str
    domain: str
    score: float
    suggestion: str  # 2-3 sentence LLM research opportunity statement
    supporting_papers: list[str]  # paper titles used as RAG context
    method_papers: list[str]      # papers that use this method
    domain_papers: list[str]      # papers that cover this domain


class GapAnalysisResponse(BaseModel):
    total_possible_pairs: int
    observed_pairs: int
    missing_pairs: int
    top_gaps: list[GapCandidate]


class GapSuggestResponse(BaseModel):
    suggestions: list[GapSuggestion]


# ── Processing state (in-memory) ─────────────────────────────────────────────

class ProcessingState(BaseModel):
    paper_id: str
    filename: str
    stage: str  # uploaded | parsing | parsed | extracting | extracted | embedding | embedded | graphing | done | error
    progress: int  # 0–100
    error: Optional[str] = None
    extraction: Optional[PaperExtraction] = None
    project: str = "default"
