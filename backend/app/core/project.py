from __future__ import annotations

import contextvars
import logging
import sqlite3
from pathlib import Path
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware

logger = logging.getLogger(__name__)

# Context variable to hold active project name
active_project_ctx = contextvars.ContextVar("active_project", default="default")

PROJECTS_BASE_DIR = Path("./data/projects")


def get_project_name() -> str:
    """Return the currently active project name from context."""
    return active_project_ctx.get()


def get_project_dir() -> Path:
    """Return the filesystem directory for the active project."""
    project_name = get_project_name()
    dir_path = PROJECTS_BASE_DIR / project_name
    dir_path.mkdir(parents=True, exist_ok=True)
    return dir_path


def get_raw_dir() -> Path:
    """Return the raw PDF directory for the active project."""
    raw_path = get_project_dir() / "raw"
    raw_path.mkdir(parents=True, exist_ok=True)
    return raw_path


def get_chroma_path() -> Path:
    """Return the ChromaDB vector database directory for the active project."""
    chroma_path = get_project_dir() / "chroma"
    chroma_path.mkdir(parents=True, exist_ok=True)
    return chroma_path


def get_sqlite_db_path() -> Path:
    """
    Return the SQLite database path for the active project.
    Auto-initializes the schema if the database does not exist.
    """
    db_path = get_project_dir() / "graph.db"
    if not db_path.exists():
        logger.info(f"Initializing new SQLite database for project: {get_project_name()}")
        init_project_sqlite_db(db_path)
    return db_path


def init_project_sqlite_db(db_path: Path):
    """Create SQLite schema tables for the project database."""
    db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS papers (
        id TEXT PRIMARY KEY,
        title TEXT,
        authors TEXT,
        year INTEGER,
        filename TEXT,
        uploaded_at TEXT
    )""")
    
    cursor.execute("CREATE TABLE IF NOT EXISTS methods (name TEXT PRIMARY KEY)")
    cursor.execute("CREATE TABLE IF NOT EXISTS domains (name TEXT PRIMARY KEY)")
    cursor.execute("CREATE TABLE IF NOT EXISTS datasets (name TEXT PRIMARY KEY)")
    
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS results (
        metric TEXT,
        value TEXT,
        description TEXT,
        PRIMARY KEY (metric, value)
    )""")
    
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS paper_methods (
        paper_id TEXT,
        method_name TEXT,
        PRIMARY KEY (paper_id, method_name),
        FOREIGN KEY (paper_id) REFERENCES papers(id) ON DELETE CASCADE,
        FOREIGN KEY (method_name) REFERENCES methods(name) ON DELETE CASCADE
    )""")
    
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS paper_domains (
        paper_id TEXT,
        domain_name TEXT,
        PRIMARY KEY (paper_id, domain_name),
        FOREIGN KEY (paper_id) REFERENCES papers(id) ON DELETE CASCADE,
        FOREIGN KEY (domain_name) REFERENCES domains(name) ON DELETE CASCADE
    )""")
    
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS paper_datasets (
        paper_id TEXT,
        dataset_name TEXT,
        PRIMARY KEY (paper_id, dataset_name),
        FOREIGN KEY (paper_id) REFERENCES papers(id) ON DELETE CASCADE,
        FOREIGN KEY (dataset_name) REFERENCES datasets(name) ON DELETE CASCADE
    )""")
    
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS paper_results (
        paper_id TEXT,
        metric TEXT,
        value TEXT,
        PRIMARY KEY (paper_id, metric, value),
        FOREIGN KEY (paper_id) REFERENCES papers(id) ON DELETE CASCADE,
        FOREIGN KEY (metric, value) REFERENCES results(metric, value) ON DELETE CASCADE
    )""")
    
    conn.commit()
    conn.close()


class ProjectContextMiddleware(BaseHTTPMiddleware):
    """FastAPI Middleware that extracts the X-Project header and stores it in contextvars."""
    async def dispatch(self, request, call_next):
        project_name = request.headers.get("x-project", "default")
        # Ensure name is sanitized
        project_name = "".join(c for c in project_name if c.isalnum() or c in ("-", "_")).strip()
        if not project_name:
            project_name = "default"

        token = active_project_ctx.set(project_name)
        try:
            response = await call_next(request)
            return response
        finally:
            active_project_ctx.reset(token)
