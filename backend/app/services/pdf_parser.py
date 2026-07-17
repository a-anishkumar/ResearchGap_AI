"""
PDF text extraction service.
Primary:  PyMuPDF (fitz)
Fallback: pdfplumber
Handles scanned/image-only PDFs gracefully.
"""
from __future__ import annotations

import re
import logging
from pathlib import Path
from dataclasses import dataclass, field
from typing import Optional

logger = logging.getLogger(__name__)

# Section heading patterns (case-insensitive)
_SECTION_PATTERNS = {
    "abstract": re.compile(r"^\s*abstract\s*$", re.IGNORECASE | re.MULTILINE),
    "introduction": re.compile(r"^\s*(1\.?\s*)?introduction\s*$", re.IGNORECASE | re.MULTILINE),
    "methods": re.compile(
        r"^\s*(\d+\.?\s*)?(method(s|ology)?|approach|proposed method|framework|model)\s*$",
        re.IGNORECASE | re.MULTILINE,
    ),
    "results": re.compile(
        r"^\s*(\d+\.?\s*)?(result(s)?|experiment(s)?|evaluation|performance)\s*$",
        re.IGNORECASE | re.MULTILINE,
    ),
    "conclusion": re.compile(
        r"^\s*(\d+\.?\s*)?(conclusion(s)?|summary|future work)\s*$",
        re.IGNORECASE | re.MULTILINE,
    ),
}


@dataclass
class ParsedPaper:
    raw_text: str
    sections: dict[str, str] = field(default_factory=dict)
    page_count: int = 0
    is_scanned: bool = False
    error: Optional[str] = None

    @property
    def extraction_text(self) -> str:
        """Best text to send to the LLM — abstract + methods + results."""
        parts = []
        for key in ("abstract", "methods", "results"):
            if self.sections.get(key):
                parts.append(f"=== {key.upper()} ===\n{self.sections[key]}")
        if not parts:
            # Fallback: first 3000 chars of raw text
            return self.raw_text[:3000]
        return "\n\n".join(parts)


def _split_sections(text: str) -> dict[str, str]:
    """Naive section splitter using heading regex matches."""
    # Find all section positions
    hits: list[tuple[str, int]] = []
    for section_name, pattern in _SECTION_PATTERNS.items():
        for m in pattern.finditer(text):
            hits.append((section_name, m.start()))

    if not hits:
        return {"full": text}

    hits.sort(key=lambda x: x[1])
    sections: dict[str, str] = {}
    for idx, (name, start) in enumerate(hits):
        end = hits[idx + 1][1] if idx + 1 < len(hits) else len(text)
        content = text[start:end].strip()
        # Remove the heading line itself
        lines = content.split("\n")
        sections[name] = "\n".join(lines[1:]).strip() if len(lines) > 1 else content

    return sections


def _extract_with_fitz(pdf_path: Path) -> ParsedPaper:
    import fitz  # PyMuPDF

    doc = fitz.open(str(pdf_path))
    page_count = len(doc)
    pages_text: list[str] = []
    image_only_pages = 0

    for page in doc:
        text = page.get_text("text")
        if text.strip():
            pages_text.append(text)
        else:
            image_only_pages += 1

    doc.close()
    is_scanned = image_only_pages == page_count
    if is_scanned:
        logger.warning(f"PDF appears to be image-only (scanned): {pdf_path.name}")
        return ParsedPaper(
            raw_text="",
            page_count=page_count,
            is_scanned=True,
            error="Scanned/image-only PDF — OCR not available in this version.",
        )

    raw_text = "\n".join(pages_text)
    sections = _split_sections(raw_text)
    return ParsedPaper(raw_text=raw_text, sections=sections, page_count=page_count)


def _extract_with_pdfplumber(pdf_path: Path) -> ParsedPaper:
    import pdfplumber

    pages_text: list[str] = []
    with pdfplumber.open(str(pdf_path)) as pdf:
        page_count = len(pdf.pages)
        for page in pdf.pages:
            text = page.extract_text() or ""
            pages_text.append(text)

    raw_text = "\n".join(pages_text)
    if not raw_text.strip():
        return ParsedPaper(
            raw_text="",
            page_count=page_count,
            is_scanned=True,
            error="pdfplumber also returned empty text — likely scanned PDF.",
        )
    sections = _split_sections(raw_text)
    return ParsedPaper(raw_text=raw_text, sections=sections, page_count=page_count)


def parse_pdf(pdf_path: str | Path) -> ParsedPaper:
    """
    Extract text from a PDF file.
    Tries PyMuPDF first; falls back to pdfplumber on failure.
    Never raises — returns a ParsedPaper with error field set on failure.
    """
    path = Path(pdf_path)

    try:
        result = _extract_with_fitz(path)
        if result.is_scanned or not result.raw_text.strip():
            raise ValueError("Empty text from fitz — trying pdfplumber")
        logger.info(f"Parsed with fitz: {path.name} ({result.page_count} pages)")
        return result
    except Exception as e:
        logger.warning(f"fitz failed for {path.name}: {e}. Trying pdfplumber.")

    try:
        result = _extract_with_pdfplumber(path)
        logger.info(f"Parsed with pdfplumber: {path.name} ({result.page_count} pages)")
        return result
    except Exception as e:
        logger.error(f"Both parsers failed for {path.name}: {e}")
        return ParsedPaper(
            raw_text="",
            page_count=0,
            is_scanned=False,
            error=f"Extraction failed: {e}",
        )


def chunk_text(text: str, chunk_size: int = 512, overlap: int = 64) -> list[str]:
    """Split text into overlapping word-chunks for embedding."""
    words = text.split()
    chunks = []
    i = 0
    while i < len(words):
        chunk = " ".join(words[i : i + chunk_size])
        chunks.append(chunk)
        i += chunk_size - overlap
    return chunks
