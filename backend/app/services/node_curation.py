"""
Node Curation & Taxonomy Management Service.
Provides human-in-the-loop controls for node merging, node splitting, and synonym resolution.
"""
from __future__ import annotations

import logging
from typing import Dict, List, Any
import sqlite3

from app.core.neo4j_driver import run_query, _use_local_sqlite

logger = logging.getLogger(__name__)


async def merge_nodes(target_name: str, source_name: str, entity_type: str = "Method") -> dict:
    """
    Merge `source_name` into `target_name` for entity_type (Method, Domain, Dataset).
    All incoming/outgoing relationships are re-pointed to target_name, and source_name is removed.
    """
    target_clean = target_name.strip()
    source_clean = source_name.strip()

    if target_clean.lower() == source_clean.lower():
        return {
            "success": False,
            "message": "Target and source node names must be distinct.",
            "merged_edges": 0,
        }

    global _use_local_sqlite
    from app.core.neo4j_driver import _use_local_sqlite

    if _use_local_sqlite:
        import os
        from app.core.project import get_sqlite_db_path, init_project_sqlite_db
        db_path = get_sqlite_db_path()
        os.makedirs(str(db_path.parent), exist_ok=True)
        if not db_path.exists():
            init_project_sqlite_db(db_path)
        try:
            conn = sqlite3.connect(str(db_path), timeout=15.0)
        except Exception:
            init_project_sqlite_db(db_path)
            conn = sqlite3.connect(str(db_path), timeout=15.0)

        cursor = conn.cursor()
        merged_count = 0
        try:
            if entity_type.lower() == "method":
                # Ensure target exists in methods table
                cursor.execute("INSERT OR IGNORE INTO methods (name) VALUES (?)", (target_clean,))
                # Re-point paper_methods
                cursor.execute("SELECT paper_id FROM paper_methods WHERE method_name = ?", (source_clean,))
                papers = cursor.fetchall()
                for (pid,) in papers:
                    cursor.execute(
                        "INSERT OR IGNORE INTO paper_methods (paper_id, method_name) VALUES (?, ?)",
                        (pid, target_clean),
                    )
                cursor.execute("DELETE FROM paper_methods WHERE method_name = ?", (source_clean,))
                cursor.execute("DELETE FROM methods WHERE name = ?", (source_clean,))
                merged_count = len(papers)

            elif entity_type.lower() == "domain":
                cursor.execute("INSERT OR IGNORE INTO domains (name) VALUES (?)", (target_clean,))
                cursor.execute("SELECT paper_id FROM paper_domains WHERE domain_name = ?", (source_clean,))
                papers = cursor.fetchall()
                for (pid,) in papers:
                    cursor.execute(
                        "INSERT OR IGNORE INTO paper_domains (paper_id, domain_name) VALUES (?, ?)",
                        (pid, target_clean),
                    )
                cursor.execute("DELETE FROM paper_domains WHERE domain_name = ?", (source_clean,))
                cursor.execute("DELETE FROM domains WHERE name = ?", (source_clean,))
                merged_count = len(papers)

            elif entity_type.lower() == "dataset":
                cursor.execute("INSERT OR IGNORE INTO datasets (name) VALUES (?)", (target_clean,))
                cursor.execute("SELECT paper_id FROM paper_datasets WHERE dataset_name = ?", (source_clean,))
                papers = cursor.fetchall()
                for (pid,) in papers:
                    cursor.execute(
                        "INSERT OR IGNORE INTO paper_datasets (paper_id, dataset_name) VALUES (?, ?)",
                        (pid, target_clean),
                    )
                cursor.execute("DELETE FROM paper_datasets WHERE dataset_name = ?", (source_clean,))
                cursor.execute("DELETE FROM datasets WHERE name = ?", (source_clean,))
                merged_count = len(papers)

            conn.commit()
            return {
                "success": True,
                "message": f"Merged {entity_type} '{source_clean}' into '{target_clean}'.",
                "merged_edges": merged_count,
                "target_node": target_clean,
                "deleted_node": source_clean,
            }
        except Exception as e:
            conn.rollback()
            logger.error(f"Error merging nodes in SQLite: {e}")
            return {"success": False, "message": str(e), "merged_edges": 0}
        finally:
            conn.close()
    else:
        # Neo4j Cypher Merge Execution
        rel_type = "USES_METHOD" if entity_type.lower() == "method" else ("APPLIES_TO_DOMAIN" if entity_type.lower() == "domain" else "EVALUATES_ON")
        label = entity_type.capitalize()
        query = f"""
        MATCH (target:{label} {{name: $target}}), (source:{label} {{name: $source}})
        OPTIONAL MATCH (p:Paper)-[r:{rel_type}]->(source)
        MERGE (p)-[:{rel_type}]->(target)
        DETACH DELETE source
        RETURN count(r) AS merged_count
        """
        try:
            res = await run_query(query, {"target": target_clean, "source": source_clean})
            merged_count = res[0]["merged_count"] if res else 0
            return {
                "success": True,
                "message": f"Merged {label} '{source_clean}' into '{target_clean}'.",
                "merged_edges": merged_count,
                "target_node": target_clean,
                "deleted_node": source_clean,
            }
        except Exception as e:
            logger.error(f"Error merging nodes in Neo4j: {e}")
            return {"success": False, "message": str(e), "merged_edges": 0}


async def find_taxonomy_synonym_candidates() -> list[dict]:
    """
    Find candidate duplicate nodes (synonyms or acronyms) that should be reviewed for merging.
    Example: 'XAI' and 'Explainable AI', 'BERT' and 'Bert'.
    """
    method_rows = await run_query(
        "MATCH (m:Method) RETURN m.name AS name UNION ALL MATCH (m:Method) RETURN m.name AS name"
    )
    methods = sorted(list({r["name"] for r in method_rows if r and "name" in r}))

    domain_rows = await run_query(
        "MATCH (d:Domain) RETURN d.name AS name UNION ALL MATCH (d:Domain) RETURN d.name AS name"
    )
    domains = sorted(list({r["name"] for r in domain_rows if r and "name" in r}))

    candidates = []

    def check_pair(items: list[str], type_label: str):
        for i in range(len(items)):
            for j in range(i + 1, len(items)):
                a, b = items[i], items[j]
                if a.lower() == b.lower() and a != b:
                    candidates.append({
                        "node_a": a,
                        "node_b": b,
                        "entity_type": type_label,
                        "reason": "Case Inconsistency",
                        "recommended_target": b if b[0].isupper() else a,
                    })
                elif len(a) > 2 and len(b) > 2 and (a in b or b in a) and abs(len(a) - len(b)) <= 4:
                    candidates.append({
                        "node_a": a,
                        "node_b": b,
                        "entity_type": type_label,
                        "reason": "Substring / Alias Similarity",
                        "recommended_target": a if len(a) > len(b) else b,
                    })

    check_pair(methods, "Method")
    check_pair(domains, "Domain")

    return candidates
