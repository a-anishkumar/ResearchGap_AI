"""
Projects Router.
Handles creation, listing, and deletion of research projects (corpus batches).
"""
from __future__ import annotations

import os
import shutil
import logging
import sqlite3
from pathlib import Path
from pydantic import BaseModel
from typing import Optional
from fastapi import APIRouter, HTTPException
from app.core.project import PROJECTS_BASE_DIR

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/projects", tags=["projects"])


class ProjectSummary(BaseModel):
    name: str
    paper_count: int
    uploaded_at: Optional[str] = None


@router.get("", response_model=list[ProjectSummary])
async def list_projects():
    """List all projects found in data/projects/ base folder."""
    PROJECTS_BASE_DIR.mkdir(parents=True, exist_ok=True)
    
    projects = []
    # Always ensure a default project directory exists
    default_dir = PROJECTS_BASE_DIR / "default"
    default_dir.mkdir(parents=True, exist_ok=True)

    for item in PROJECTS_BASE_DIR.iterdir():
        if item.is_dir():
            name = item.name
            db_path = item / "graph.db"
            paper_count = 0
            uploaded_at = None

            if db_path.exists():
                try:
                    conn = sqlite3.connect(db_path)
                    cursor = conn.cursor()
                    cursor.execute("SELECT COUNT(*), MIN(uploaded_at) FROM papers")
                    row = cursor.fetchone()
                    paper_count = row[0] if row else 0
                    uploaded_at = row[1] if row and len(row) > 1 else None
                    conn.close()
                except Exception as e:
                    logger.warning(f"Could not read database info for project {name}: {e}")

            # Fall back to directory modification time if no papers exist
            if not uploaded_at:
                try:
                    mtime = os.path.getmtime(item)
                    import datetime
                    uploaded_at = datetime.datetime.utcfromtimestamp(mtime).isoformat()
                except Exception:
                    pass

            projects.append(ProjectSummary(
                name=name,
                paper_count=paper_count,
                uploaded_at=uploaded_at
            ))

    # Sort projects: default first, then alphabetically
    return sorted(projects, key=lambda p: (0 if p.name == "default" else 1, p.name))


@router.delete("/{name}")
async def delete_project(name: str):
    """Delete a project folder and all its raw files, graphs, vector chunks, and memory states."""
    if name == "default":
        # Do not allow deleting the default fallback project itself, but we can clear its contents
        db_path = PROJECTS_BASE_DIR / "default" / "graph.db"
        if db_path.exists():
            try:
                conn = sqlite3.connect(db_path)
                cursor = conn.cursor()
                cursor.execute("DELETE FROM papers")
                conn.commit()
                conn.close()
            except Exception:
                pass
        
        # Clear default folders
        for folder in ["raw", "chroma"]:
            path = PROJECTS_BASE_DIR / "default" / folder
            if path.exists():
                try:
                    shutil.rmtree(path)
                except Exception:
                    pass
        
        # Clean processing memory states for 'default'
        from app.routers.upload import processing_states
        to_del = [k for k, s in list(processing_states.items()) if s.project == "default"]
        for k in to_del:
            del processing_states[k]
            
        return {"status": "ok", "message": "Default project cleared successfully"}

    project_dir = PROJECTS_BASE_DIR / name
    if not project_dir.exists():
        raise HTTPException(status_code=404, detail=f"Project '{name}' not found")

    try:
        # Delete memory processing states
        from app.routers.upload import processing_states
        to_del = [k for k, s in list(processing_states.items()) if s.project == name]
        for k in to_del:
            if k in processing_states:
                del processing_states[k]

        # Delete database, chroma index, and raw PDFs by recursively removing the directory
        shutil.rmtree(project_dir)
        logger.info(f"Project '{name}' folder deleted successfully")
        return {"status": "ok", "message": f"Project '{name}' deleted successfully"}
    except Exception as e:
        logger.exception(f"Failed to delete project '{name}': {e}")
        raise HTTPException(status_code=500, detail=f"Failed to delete project: {e}")
