"""
Unit tests for Proposal Export service (LaTeX, BibTeX, Markdown, PDF).
"""
import pytest
from app.models.schemas import ResearchProposal
from app.services.proposal_service import (
    export_proposal_latex,
    export_proposal_bibtex,
    export_proposal_markdown,
    export_proposal_pdf,
)


@pytest.fixture
def sample_proposal():
    return ResearchProposal(
        id="prop_transformer_genomics",
        method="Transformer",
        domain="Genomics",
        title="Transformer Architectures for Genomic Variant Interpretation",
        problem_statement="Applying attention primitives to non-coding genomic sequence analysis.",
        hypothesis="Self-attention will capture long-range chromatin interaction constraints.",
        methodology_blueprint=[
            "Tokenize nucleotide sequences.",
            "Pretrain Transformer encoder on GRCh38 genomic reference.",
            "Evaluate variant effect prediction accuracy.",
        ],
        expected_contributions="1. Pretrained genomic Transformer model.\n2. State-of-the-art variant effect prediction accuracy.",
        literature_justification="Grounding builds on Vaswani et al. (2017) and recent genomic deep learning benchmarks.",
        citation_seeds=["Vaswani2017", "Genomics2024"],
    )


def test_export_proposal_latex(sample_proposal):
    latex_str = export_proposal_latex(sample_proposal)
    assert "\\documentclass" in latex_str
    assert "Transformer Architectures for Genomic Variant Interpretation" in latex_str
    assert "\\section{1. Problem Formulation \\& Gap Statement}" in latex_str
    assert "\\begin{enumerate}" in latex_str


def test_export_proposal_bibtex(sample_proposal):
    bib_str = export_proposal_bibtex(sample_proposal)
    assert "@article{" in bib_str
    assert "Transformer Architectures for Genomic Variant Interpretation" in bib_str
    assert "Vaswani2017" in bib_str


def test_export_proposal_markdown(sample_proposal):
    md_str = export_proposal_markdown(sample_proposal)
    assert "# Transformer Architectures for Genomic Variant Interpretation" in md_str
    assert "**Method**: `Transformer`" in md_str
    assert "## 1. Problem Formulation & Gap Statement" in md_str


def test_export_proposal_pdf(sample_proposal):
    pdf_bytes = export_proposal_pdf(sample_proposal)
    assert isinstance(pdf_bytes, bytes)
    assert pdf_bytes.startswith(b"%PDF")
