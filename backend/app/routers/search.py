"""
Search router — semantic vector search + RAG-grounded Q&A.
POST /api/search        → top-k similar chunks across all papers
POST /api/search/ask    → Q&A grounded in retrieved context
"""
from __future__ import annotations

import logging
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.services import rag
from app.core.claude_client import complete

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/search", tags=["search"])


class SearchRequest(BaseModel):
    query: str
    top_k: int = 8


class AskRequest(BaseModel):
    question: str
    top_k: int = 5


_ASK_SYSTEM = """You are a research assistant with access to a corpus of academic papers.
Answer the user's question based ONLY on the context provided below.
Be concise, cite the source papers when relevant, and admit if the information is not in the context.
Format your answer in clear prose — no bullet lists unless the question specifically asks for a list."""


@router.post("")
async def search_papers(req: SearchRequest):
    """Semantic vector search across all ingested paper chunks."""
    if not req.query.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty")
    try:
        results = rag.retrieve(req.query, top_k=req.top_k)
        return {
            "query": req.query,
            "results": [
                {
                    "text": r["text"],
                    "paper_id": r["paper_id"],
                    "title": r.get("title", ""),
                    "distance": r.get("distance", 0),
                    "relevance": round(max(0, 1 - r.get("distance", 0)) * 100, 1),
                }
                for r in results
            ],
        }
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Search error: {e}")


@router.post("/ask")
async def ask_question(req: AskRequest):
    """RAG-grounded Q&A: retrieve relevant chunks, then answer with Gemini."""
    if not req.question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty")
    try:
        chunks = rag.retrieve(req.question, top_k=req.top_k)
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Retrieval error: {e}")

    if not chunks:
        return {
            "question": req.question,
            "answer": "No papers have been uploaded yet. Please upload and process research papers first.",
            "sources": [],
        }

    context = "\n\n".join(
        f"[Source: {c.get('title') or c['paper_id'][:8]}]\n{c['text'][:500]}"
        for c in chunks
    )
    user_prompt = f"""Context from research papers:
---
{context}
---

Question: {req.question}

Answer based only on the context above:"""

    try:
        answer = await complete(system=_ASK_SYSTEM, user=user_prompt, max_tokens=500)
    except Exception as e:
        answer = f"(AI answer unavailable: {e})"

    sources = list({c.get("title") or c["paper_id"][:8] for c in chunks})
    return {
        "question": req.question,
        "answer": answer.strip(),
        "sources": sources,
        "chunks_used": len(chunks),
    }
def reconstruct_abstract(inverted_index: dict) -> str:
    if not inverted_index:
        return ""
    try:
        word_positions = []
        for word, positions in inverted_index.items():
            for pos in positions:
                word_positions.append((pos, word))
        word_positions.sort()
        return " ".join(word for pos, word in word_positions)
    except Exception:
        return ""


async def fetch_openalex(query: str, max_results: int) -> list[dict]:
    import urllib.request
    import urllib.parse
    import json
    import asyncio

    try:
        url = f"https://api.openalex.org/works?search={urllib.parse.quote(query)}&per-page={max_results}"
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (mailto:admin@researchgap.ai)'})
        
        loop = asyncio.get_event_loop()
        def _fetch():
            with urllib.request.urlopen(req, timeout=8) as r:
                return r.read()
                
        raw = await loop.run_in_executor(None, _fetch)
        data = json.loads(raw)
        
        results = []
        for work in data.get("results", []):
            title = work.get("title") or "Unknown Title"
            abstract = reconstruct_abstract(work.get("abstract_inverted_index"))
            if not abstract:
                abstract = "No abstract summary available."
                
            published = work.get("publication_date") or str(work.get("publication_year", ""))
            
            authors = []
            for auth in work.get("authorships", []):
                author_name = auth.get("author", {}).get("display_name")
                if author_name:
                    authors.append(author_name)
                    
            pdf_url = ""
            source_name = "Academic Publisher"
            
            prim_loc = work.get("primary_location") or {}
            if prim_loc:
                pdf_url = prim_loc.get("pdf_url") or prim_loc.get("landing_page_url") or ""
                source = prim_loc.get("source") or {}
                if source:
                    source_name = source.get("display_name") or source_name
                    
            if not pdf_url:
                pdf_url = work.get("doi") or work.get("id") or ""
                
            if "arxiv" in source_name.lower():
                source_name = "arXiv"
                
            results.append({
                "title": title,
                "summary": abstract,
                "published": published[:10] if published else "",
                "authors": authors,
                "url": pdf_url,
                "source": source_name
            })
        return results
    except Exception as e:
        logger.warning(f"OpenAlex fetch failed: {e}")
        return []


async def fetch_arxiv(query: str, max_results: int) -> list[dict]:
    import urllib.request
    import urllib.parse
    import xml.etree.ElementTree as ET
    import asyncio

    try:
        url = f"http://export.arxiv.org/api/query?search_query=all:{urllib.parse.quote(query)}&max_results={max_results}"
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        
        loop = asyncio.get_event_loop()
        def _fetch():
            with urllib.request.urlopen(req, timeout=8) as r:
                return r.read()

        xml_data = await loop.run_in_executor(None, _fetch)
        root = ET.fromstring(xml_data)
        
        ns = {
            'atom': 'http://www.w3.org/2005/Atom',
            'arxiv': 'http://arxiv.org/schemas/atom'
        }
        
        results = []
        for entry in root.findall('atom:entry', ns):
            title = entry.find('atom:title', ns)
            title_text = title.text.strip() if title is not None else "Unknown Title"
            title_text = " ".join(title_text.split())

            summary = entry.find('atom:summary', ns)
            summary_text = summary.text.strip() if summary is not None else ""
            summary_text = " ".join(summary_text.split())

            published = entry.find('atom:published', ns)
            published_text = published.text[:10] if published is not None else ""

            authors = []
            for author in entry.findall('atom:author', ns):
                name = author.find('atom:name', ns)
                if name is not None:
                    authors.append(name.text.strip())

            pdf_url = ""
            for link in entry.findall('atom:link', ns):
                if link.attrib.get('title') == 'pdf' or link.attrib.get('type') == 'application/pdf':
                    pdf_url = link.attrib.get('href', '')
                elif link.attrib.get('rel') == 'alternate' and not pdf_url:
                    pdf_url = link.attrib.get('href', '')

            results.append({
                "title": title_text,
                "summary": summary_text,
                "published": published_text,
                "authors": authors,
                "url": pdf_url or entry.find('atom:id', ns).text.strip(),
                "source": "arXiv"
            })
        return results
    except Exception as e:
        logger.warning(f"arXiv fetch failed: {e}")
        return []


@router.get("/online")
async def search_online(query: str, max_results: int = 30):
    """Query external academic APIs (OpenAlex & arXiv) in parallel and merge results."""
    import asyncio
    if not query.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty")
        
    try:
        # Run queries in parallel, fetching slightly more to accommodate deduplication
        fetch_limit = max_results + 10
        openalex_task = asyncio.create_task(fetch_openalex(query, fetch_limit))
        arxiv_task = asyncio.create_task(fetch_arxiv(query, fetch_limit))
        
        results = await asyncio.gather(openalex_task, arxiv_task, return_exceptions=True)
        
        openalex_res = results[0] if not isinstance(results[0], Exception) else []
        arxiv_res = results[1] if not isinstance(results[1], Exception) else []
        
        # Merge & deduplicate based on normalized title alphanumeric chars
        merged = []
        seen_titles = set()
        
        for paper in openalex_res + arxiv_res:
            title_norm = "".join(c for c in paper["title"].lower() if c.isalnum())
            if not title_norm:
                continue
            if title_norm not in seen_titles:
                seen_titles.add(title_norm)
                merged.append(paper)
                
        return {"query": query, "results": merged[:max_results]}
    except Exception as e:
        logger.exception("Failed to run online search")
        raise HTTPException(status_code=503, detail=f"Failed to query online papers: {e}")
