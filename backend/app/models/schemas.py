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


# ── Proposal Polish ──────────────────────────────────────────────────────────

class PolishedSection(BaseModel):
    original: str
    polished: str


class PolishedSections(BaseModel):
    problem_statement: PolishedSection
    expected_contributions: PolishedSection


class CitationFlag(BaseModel):
    sentence: str
    reason: str
    suggested_citation_or_softening: str


class TitleVariant(BaseModel):
    title: str
    rationale: str


class ProposalPolishResponse(BaseModel):
    polished_sections: PolishedSections
    citation_flags: list[CitationFlag]
    title_variants: list[TitleVariant]


class ResearchProposal(BaseModel):
    id: str
    method: str
    domain: str
    title: str
    problem_statement: str
    hypothesis: str
    methodology_blueprint: list[str]
    expected_contributions: str
    literature_justification: str
    citation_seeds: list[str]
    polish_result: Optional[ProposalPolishResponse] = None


# ── Semantic Scholar Integration ──────────────────────────────────────────────

class TimelinePaperItem(BaseModel):
    paper_id: str
    title: str
    year: int = 2024
    citation_count: int = 0
    reference_count: int = 0
    method: str = "General"
    domain: str = "General"
    authors: list[str] = Field(default_factory=list)


class TimelineResponse(BaseModel):
    papers: list[TimelinePaperItem]


class ConnectRequest(BaseModel):
    paper_id_a: str
    paper_id_b: str


class ConnectPathNode(BaseModel):
    paper_id: str = ""
    s2_id: str = ""
    title: str = "Untitled Paper"
    year: Optional[int] = None
    authors: list[str] = Field(default_factory=list)
    citation_count: int = 0
    is_corpus_paper: bool = False


class ConnectResponse(BaseModel):
    path: Optional[list[ConnectPathNode]] = None
    depth: int = 0
    message: str = ""


class AuthorNode(BaseModel):
    id: str
    name: str
    paper_count: int = 1
    affiliation: str = "Unknown Institution"
    papers: list[str] = Field(default_factory=list)


class AuthorLink(BaseModel):
    source: str
    target: str
    weight: int = 1
    paper_titles: list[str] = Field(default_factory=list)


class AuthorNetworkResponse(BaseModel):
    nodes: list[AuthorNode]
    links: list[AuthorLink]


class AuthorDetailResponse(BaseModel):
    author_name: str
    in_project_papers: list[dict] = Field(default_factory=list)
    external_top_papers: list[dict] = Field(default_factory=list)


# ── Paper Analysis, Comparison & Chat Models ──────────────────────────────────

class PaperAnalysisResult(BaseModel):
    executive_summary: str = ""
    core_innovations: list[str] = Field(default_factory=list)
    methodology_analysis: str = ""
    empirical_evaluation: str = ""
    limitations: list[str] = Field(default_factory=list)
    gap_relevance: str = ""
    suggested_followups: list[str] = Field(default_factory=list)


class PaperCompareResult(BaseModel):
    summary_comparison: str = ""
    methodology_diff: str = ""
    dataset_evaluation_diff: str = ""
    domain_applicability_diff: str = ""
    synergies_and_hybrids: str = ""
    unexplored_gap_opportunity: str = ""


class PaperChatCitation(BaseModel):
    section: str = ""
    excerpt: str = ""


class PaperChatResponse(BaseModel):
    answer: str = ""
    citations: list[PaperChatCitation] = Field(default_factory=list)
    simplified_summary: Optional[str] = None
    citation_flags: list[CitationFlag] = Field(default_factory=list)



