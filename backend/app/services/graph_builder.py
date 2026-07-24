"""
Neo4j graph builder.
Uses MERGE for dedup — safe to call multiple times for the same paper.
All writes are idempotent.
"""
from __future__ import annotations

import logging
from app.core.neo4j_driver import run_query
from app.models.schemas import PaperExtraction

logger = logging.getLogger(__name__)


async def ensure_constraints():
    """Create uniqueness constraints (run once at startup)."""
    constraints = [
        "CREATE CONSTRAINT paper_id IF NOT EXISTS FOR (p:Paper) REQUIRE p.id IS UNIQUE",
        "CREATE CONSTRAINT method_name IF NOT EXISTS FOR (m:Method) REQUIRE m.name IS UNIQUE",
        "CREATE CONSTRAINT domain_name IF NOT EXISTS FOR (d:Domain) REQUIRE d.name IS UNIQUE",
        "CREATE CONSTRAINT dataset_name IF NOT EXISTS FOR (ds:Dataset) REQUIRE ds.name IS UNIQUE",
    ]
    for cypher in constraints:
        try:
            await run_query(cypher)
        except Exception as e:
            # Constraints may already exist
            logger.debug(f"Constraint note: {e}")


async def write_paper(paper_id: str, filename: str, extraction: PaperExtraction):
    """Write a paper and all its extracted entities + relationships into Neo4j."""
    import datetime
    now_str = datetime.datetime.utcnow().isoformat()

    # 1. Upsert Paper node
    await run_query(
        """
        MERGE (p:Paper {id: $id})
        SET p.title       = $title,
            p.authors     = $authors,
            p.year        = $year,
            p.filename    = $filename,
            p.uploaded_at = coalesce(p.uploaded_at, $uploaded_at)
        """,
        {
            "id": paper_id,
            "title": extraction.title,
            "authors": extraction.authors,
            "year": extraction.year,
            "filename": filename,
            "uploaded_at": now_str,
        },
    )

    # 2. Methods
    for method in extraction.methods:
        await run_query(
            """
            MERGE (m:Method {name: $name})
            WITH m
            MATCH (p:Paper {id: $pid})
            MERGE (p)-[:USES_METHOD]->(m)
            """,
            {"name": method, "pid": paper_id},
        )

    # 3. Domains
    for domain in extraction.domains:
        await run_query(
            """
            MERGE (d:Domain {name: $name})
            WITH d
            MATCH (p:Paper {id: $pid})
            MERGE (p)-[:APPLIES_TO_DOMAIN]->(d)
            """,
            {"name": domain, "pid": paper_id},
        )

    # 4. Datasets
    for dataset in extraction.datasets:
        await run_query(
            """
            MERGE (ds:Dataset {name: $name})
            WITH ds
            MATCH (p:Paper {id: $pid})
            MERGE (p)-[:EVALUATES_ON]->(ds)
            """,
            {"name": dataset, "pid": paper_id},
        )

    # 5. Results
    for res in extraction.results:
        await run_query(
            """
            MERGE (r:Result {metric: $metric, value: $value})
            SET r.description = $description
            WITH r
            MATCH (p:Paper {id: $pid})
            MERGE (p)-[:REPORTS]->(r)
            """,
            {
                "metric": res.metric,
                "value": res.value,
                "description": res.description,
                "pid": paper_id,
            },
        )

    logger.info(
        f"Graph written for paper '{paper_id}': "
        f"{len(extraction.methods)}M / {len(extraction.domains)}D / "
        f"{len(extraction.datasets)}DS / {len(extraction.results)}R"
    )


async def get_graph_stats() -> dict:
    rows = await run_query(
        """
        MATCH (p:Paper) WITH count(p) AS papers
        MATCH (m:Method) WITH papers, count(m) AS methods
        MATCH (d:Domain) WITH papers, methods, count(d) AS domains
        MATCH (ds:Dataset) WITH papers, methods, domains, count(ds) AS datasets
        MATCH (r:Result) WITH papers, methods, domains, datasets, count(r) AS results
        MATCH ()-[rel]->() WITH papers, methods, domains, datasets, results, count(rel) AS rels
        RETURN papers, methods, domains, datasets, results, rels
        """
    )
    if not rows:
        return {"papers": 0, "methods": 0, "domains": 0, "datasets": 0, "results": 0, "relationships": 0}
    row = rows[0]
    return {
        "papers": row.get("papers", 0),
        "methods": row.get("methods", 0),
        "domains": row.get("domains", 0),
        "datasets": row.get("datasets", 0),
        "results": row.get("results", 0),
        "relationships": row.get("rels", 0),
    }


async def get_graph_data() -> dict:
    """Return full graph as {nodes, links} for frontend visualization."""
    node_rows = await run_query(
        """
        CALL {
          MATCH (p:Paper)   RETURN p.id   AS id, p.title    AS label, 'Paper'   AS type, {title: p.title, year: p.year, authors: p.authors, filename: p.filename} AS props
          UNION ALL
          MATCH (m:Method)  RETURN m.name AS id, m.name     AS label, 'Method'  AS type, {} AS props
          UNION ALL
          MATCH (d:Domain)  RETURN d.name AS id, d.name     AS label, 'Domain'  AS type, {} AS props
          UNION ALL
          MATCH (ds:Dataset) RETURN ds.name AS id, ds.name  AS label, 'Dataset' AS type, {} AS props
        }
        RETURN id, label, type, props
        """
    )

    link_rows = await run_query(
        """
        CALL {
          MATCH (p:Paper)-[r:USES_METHOD]->(m:Method)      RETURN p.id AS s, m.name AS t, 'USES_METHOD' AS rt
          UNION ALL
          MATCH (p:Paper)-[r:APPLIES_TO_DOMAIN]->(d:Domain) RETURN p.id AS s, d.name AS t, 'APPLIES_TO_DOMAIN' AS rt
          UNION ALL
          MATCH (p:Paper)-[r:EVALUATES_ON]->(ds:Dataset)   RETURN p.id AS s, ds.name AS t, 'EVALUATES_ON' AS rt
        }
        RETURN s, t, rt
        """
    )

    nodes = [{"id": r["id"], "label": r["label"], "type": r["type"], "properties": r.get("props", {})} for r in node_rows]
    links = [{"source": r["s"], "target": r["t"], "type": r["rt"]} for r in link_rows]
    return {"nodes": nodes, "links": links}


import sqlite3
import json
import app.core.neo4j_driver as neo4j_driver

async def get_entities() -> dict:
    """
    Return full lists of methods, domains, datasets, results, and papers
    each with paper associations and frequencies.
    """
    if neo4j_driver._use_local_sqlite:
        conn = sqlite3.connect(neo4j_driver.sqlite_db_path)
        cursor = conn.cursor()
        try:
            # Methods with paper info
            cursor.execute("""
                SELECT m.name, p.title, p.id, p.filename
                FROM paper_methods pm
                JOIN methods m ON pm.method_name = m.name
                JOIN papers p ON pm.paper_id = p.id
                ORDER BY m.name
            """)
            method_rows = cursor.fetchall()
            methods_map: dict = {}
            for name, title, pid, filename in method_rows:
                methods_map.setdefault(name, []).append({"paper_id": pid, "title": title or filename or pid[:8]})

            # Domains with paper info
            cursor.execute("""
                SELECT d.name, p.title, p.id, p.filename
                FROM paper_domains pd
                JOIN domains d ON pd.domain_name = d.name
                JOIN papers p ON pd.paper_id = p.id
                ORDER BY d.name
            """)
            domain_rows = cursor.fetchall()
            domains_map: dict = {}
            for name, title, pid, filename in domain_rows:
                domains_map.setdefault(name, []).append({"paper_id": pid, "title": title or filename or pid[:8]})

            # Datasets with paper info
            cursor.execute("""
                SELECT ds.name, p.title, p.id, p.filename
                FROM paper_datasets pds
                JOIN datasets ds ON pds.dataset_name = ds.name
                JOIN papers p ON pds.paper_id = p.id
                ORDER BY ds.name
            """)
            dataset_rows = cursor.fetchall()
            datasets_map: dict = {}
            for name, title, pid, filename in dataset_rows:
                datasets_map.setdefault(name, []).append({"paper_id": pid, "title": title or filename or pid[:8]})

            # Results with paper info
            cursor.execute("""
                SELECT r.metric, r.value, r.description, p.title, p.id, p.filename
                FROM paper_results pr
                JOIN results r ON pr.metric = r.metric AND pr.value = r.value
                JOIN papers p ON pr.paper_id = p.id
                ORDER BY r.metric
            """)
            result_rows = cursor.fetchall()
            results_map: dict = {}
            for metric, value, desc, title, pid, filename in result_rows:
                key = f"{metric}: {value}"
                results_map.setdefault(key, {"metric": metric, "value": value, "description": desc, "papers": []})
                results_map[key]["papers"].append({"paper_id": pid, "title": title or filename or pid[:8]})

            # All papers
            cursor.execute("SELECT id, title, authors, year, filename FROM papers ORDER BY title")
            paper_rows = cursor.fetchall()
            papers_list = []
            for pid, title, authors_json, year, filename in paper_rows:
                cursor.execute("SELECT COUNT(*) FROM paper_methods WHERE paper_id = ?", (pid,))
                m_count = cursor.fetchone()[0]
                cursor.execute("SELECT COUNT(*) FROM paper_domains WHERE paper_id = ?", (pid,))
                d_count = cursor.fetchone()[0]
                try:
                    authors = json.loads(authors_json) if authors_json else []
                except Exception:
                    authors = []
                papers_list.append({
                    "paper_id": pid,
                    "title": title or filename or pid[:8],
                    "authors": authors,
                    "year": year,
                    "filename": filename,
                    "method_count": m_count,
                    "domain_count": d_count,
                })

            return {
                "methods":  [{"name": k, "papers": v, "count": len(v)} for k, v in sorted(methods_map.items(), key=lambda x: -len(x[1]))],
                "domains":  [{"name": k, "papers": v, "count": len(v)} for k, v in sorted(domains_map.items(), key=lambda x: -len(x[1]))],
                "datasets": [{"name": k, "papers": v, "count": len(v)} for k, v in sorted(datasets_map.items(), key=lambda x: -len(x[1]))],
                "results":  [v for v in results_map.values()],
                "papers":   papers_list,
            }
        finally:
            conn.close()
    else:
        # Neo4j path
        methods = await run_query("""
            MATCH (p:Paper)-[:USES_METHOD]->(m:Method)
            RETURN m.name AS name, collect({paper_id: p.id, title: coalesce(p.title, p.filename, p.id)}) AS papers, count(p) AS count
            ORDER BY count DESC
        """)
        domains = await run_query("""
            MATCH (p:Paper)-[:APPLIES_TO_DOMAIN]->(d:Domain)
            RETURN d.name AS name, collect({paper_id: p.id, title: coalesce(p.title, p.filename, p.id)}) AS papers, count(p) AS count
            ORDER BY count DESC
        """)
        datasets = await run_query("""
            MATCH (p:Paper)-[:EVALUATES_ON]->(ds:Dataset)
            RETURN ds.name AS name, collect({paper_id: p.id, title: coalesce(p.title, p.filename, p.id)}) AS papers, count(p) AS count
            ORDER BY count DESC
        """)
        results = await run_query("""
            MATCH (p:Paper)-[:REPORTS]->(r:Result)
            RETURN r.metric AS metric, r.value AS value, r.description AS description,
                   collect({paper_id: p.id, title: coalesce(p.title, p.filename, p.id)}) AS papers
        """)
        papers = await run_query("""
            MATCH (p:Paper)
            OPTIONAL MATCH (p)-[:USES_METHOD]->(m:Method)
            OPTIONAL MATCH (p)-[:APPLIES_TO_DOMAIN]->(d:Domain)
            RETURN p.id AS paper_id, p.title AS title, p.year AS year,
                   p.authors AS authors, p.filename AS filename,
                   count(DISTINCT m) AS method_count, count(DISTINCT d) AS domain_count
            ORDER BY p.title
        """)
        def _authors(a):
            if isinstance(a, list): return a
            try: return json.loads(a)
            except: return []
        return {
            "methods":  [{"name": r["name"], "papers": r["papers"], "count": r["count"]} for r in methods],
            "domains":  [{"name": r["name"], "papers": r["papers"], "count": r["count"]} for r in domains],
            "datasets": [{"name": r["name"], "papers": r["papers"], "count": r["count"]} for r in datasets],
            "results":  [{"metric": r["metric"], "value": r["value"], "description": r.get("description"), "papers": r["papers"]} for r in results],
            "papers":   [{"paper_id": r["paper_id"], "title": r.get("title") or r.get("filename") or r["paper_id"][:8], "authors": _authors(r.get("authors")), "year": r.get("year"), "filename": r.get("filename"), "method_count": r["method_count"], "domain_count": r["domain_count"]} for r in papers],
        }



async def get_all_papers() -> list[dict]:
    """Retrieve all papers and their properties/entities from Neo4j or SQLite fallback."""
    if neo4j_driver._use_local_sqlite:
        from app.core.project import get_sqlite_db_path
        db_path = get_sqlite_db_path()
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        try:
            cursor.execute("SELECT id, title, authors, year, filename FROM papers")
            papers = cursor.fetchall()
            result = []
            for row in papers:
                pid, title, authors_json, year, filename = row
                
                # Fetch methods
                cursor.execute("SELECT method_name FROM paper_methods WHERE paper_id = ?", (pid,))
                methods = [r[0] for r in cursor.fetchall()]
                
                # Fetch domains
                cursor.execute("SELECT domain_name FROM paper_domains WHERE paper_id = ?", (pid,))
                domains = [r[0] for r in cursor.fetchall()]
                
                # Fetch datasets
                cursor.execute("SELECT dataset_name FROM paper_datasets WHERE paper_id = ?", (pid,))
                datasets = [r[0] for r in cursor.fetchall()]
                
                try:
                    authors = json.loads(authors_json) if authors_json else []
                except Exception:
                    authors = []
                    
                result.append({
                    "paper_id": pid,
                    "filename": filename or f"{pid}.pdf",
                    "title": title or filename.replace(".pdf", ""),
                    "authors": authors,
                    "year": year,
                    "methods": methods,
                    "domains": domains,
                    "datasets": datasets
                })
            return result
        finally:
            conn.close()
    else:
        # Neo4j query
        rows = await run_query(
            """
            MATCH (p:Paper)
            OPTIONAL MATCH (p)-[:USES_METHOD]->(m:Method)
            OPTIONAL MATCH (p)-[:APPLIES_TO_DOMAIN]->(d:Domain)
            OPTIONAL MATCH (p)-[:EVALUATES_ON]->(ds:Dataset)
            RETURN p.id AS id, p.filename AS filename, p.title AS title, p.year AS year, p.authors AS authors,
                   collect(DISTINCT m.name) AS methods,
                   collect(DISTINCT d.name) AS domains,
                   collect(DISTINCT ds.name) AS datasets
            """
        )
        result = []
        for row in rows:
            pid = row["id"]
            authors = row.get("authors", [])
            if isinstance(authors, str):
                try:
                    authors = json.loads(authors)
                except Exception:
                    authors = []
            result.append({
                "paper_id": pid,
                "filename": row.get("filename") or f"{pid}.pdf",
                "title": row.get("title") or "",
                "authors": authors,
                "year": row.get("year"),
                "methods": row.get("methods", []),
                "domains": row.get("domains", []),
                "datasets": row.get("datasets", [])
            })
        return result


async def get_node_detail(node_id: str, node_type: str) -> dict:
    """
    Return rich detail for a single clicked node.
    Supports Paper, Method, Domain, Dataset node types.
    Works for both SQLite (local fallback) and Neo4j backends.
    """
    if neo4j_driver._use_local_sqlite:
        conn = sqlite3.connect(neo4j_driver.sqlite_db_path)
        cursor = conn.cursor()
        try:
            if node_type == "Paper":
                # Paper detail: full props + connected entities
                cursor.execute(
                    "SELECT id, title, authors, year, filename FROM papers WHERE id = ?",
                    (node_id,)
                )
                row = cursor.fetchone()
                if not row:
                    return {}
                pid, title, authors_json, year, filename = row
                try:
                    authors = json.loads(authors_json) if authors_json else []
                except Exception:
                    authors = []
                cursor.execute("SELECT method_name FROM paper_methods WHERE paper_id = ?", (pid,))
                methods = [r[0] for r in cursor.fetchall()]
                cursor.execute("SELECT domain_name FROM paper_domains WHERE paper_id = ?", (pid,))
                domains = [r[0] for r in cursor.fetchall()]
                cursor.execute("SELECT dataset_name FROM paper_datasets WHERE paper_id = ?", (pid,))
                datasets = [r[0] for r in cursor.fetchall()]
                cursor.execute(
                    "SELECT r.metric, r.value, r.description FROM paper_results pr "
                    "JOIN results r ON pr.metric = r.metric AND pr.value = r.value "
                    "WHERE pr.paper_id = ?",
                    (pid,)
                )
                results = [{"metric": r[0], "value": r[1], "description": r[2]} for r in cursor.fetchall()]
                return {
                    "type": "Paper",
                    "id": pid,
                    "title": title or filename or pid[:8],
                    "authors": authors,
                    "year": year,
                    "filename": filename,
                    "methods": methods,
                    "domains": domains,
                    "datasets": datasets,
                    "results": results,
                    "method_count": len(methods),
                    "domain_count": len(domains),
                }

            elif node_type == "Method":
                # Method detail: all papers using it + co-occurring domains
                cursor.execute(
                    "SELECT p.id, p.title, p.year, p.authors FROM paper_methods pm "
                    "JOIN papers p ON pm.paper_id = p.id WHERE pm.method_name = ?",
                    (node_id,)
                )
                paper_rows = cursor.fetchall()
                papers = []
                for pid, title, year, authors_json in paper_rows:
                    try:
                        authors = json.loads(authors_json) if authors_json else []
                    except Exception:
                        authors = []
                    papers.append({"id": pid, "title": title or pid[:8], "year": year, "authors": authors})
                # Co-occurring domains across those papers
                paper_ids = [p["id"] for p in papers]
                co_domains: dict = {}
                for pid in paper_ids:
                    cursor.execute("SELECT domain_name FROM paper_domains WHERE paper_id = ?", (pid,))
                    for (d,) in cursor.fetchall():
                        co_domains[d] = co_domains.get(d, 0) + 1
                co_domains_list = sorted(
                    [{"name": k, "count": v} for k, v in co_domains.items()],
                    key=lambda x: -x["count"]
                )
                return {
                    "type": "Method",
                    "id": node_id,
                    "name": node_id,
                    "paper_count": len(papers),
                    "papers": papers,
                    "co_domains": co_domains_list,
                }

            elif node_type == "Domain":
                # Domain detail: all papers targeting it + co-occurring methods
                cursor.execute(
                    "SELECT p.id, p.title, p.year, p.authors FROM paper_domains pd "
                    "JOIN papers p ON pd.paper_id = p.id WHERE pd.domain_name = ?",
                    (node_id,)
                )
                paper_rows = cursor.fetchall()
                papers = []
                for pid, title, year, authors_json in paper_rows:
                    try:
                        authors = json.loads(authors_json) if authors_json else []
                    except Exception:
                        authors = []
                    papers.append({"id": pid, "title": title or pid[:8], "year": year, "authors": authors})
                paper_ids = [p["id"] for p in papers]
                co_methods: dict = {}
                for pid in paper_ids:
                    cursor.execute("SELECT method_name FROM paper_methods WHERE paper_id = ?", (pid,))
                    for (m,) in cursor.fetchall():
                        co_methods[m] = co_methods.get(m, 0) + 1
                co_methods_list = sorted(
                    [{"name": k, "count": v} for k, v in co_methods.items()],
                    key=lambda x: -x["count"]
                )
                return {
                    "type": "Domain",
                    "id": node_id,
                    "name": node_id,
                    "paper_count": len(papers),
                    "papers": papers,
                    "co_methods": co_methods_list,
                }

            elif node_type == "Dataset":
                # Dataset detail: all papers evaluating on it
                cursor.execute(
                    "SELECT p.id, p.title, p.year, p.authors FROM paper_datasets pds "
                    "JOIN papers p ON pds.paper_id = p.id WHERE pds.dataset_name = ?",
                    (node_id,)
                )
                paper_rows = cursor.fetchall()
                papers = []
                for pid, title, year, authors_json in paper_rows:
                    try:
                        authors = json.loads(authors_json) if authors_json else []
                    except Exception:
                        authors = []
                    papers.append({"id": pid, "title": title or pid[:8], "year": year, "authors": authors})
                return {
                    "type": "Dataset",
                    "id": node_id,
                    "name": node_id,
                    "paper_count": len(papers),
                    "papers": papers,
                }
            return {}
        finally:
            conn.close()
    else:
        # Neo4j path
        if node_type == "Paper":
            rows = await run_query("""
                MATCH (p:Paper {id: $id})
                OPTIONAL MATCH (p)-[:USES_METHOD]->(m:Method)
                OPTIONAL MATCH (p)-[:APPLIES_TO_DOMAIN]->(d:Domain)
                OPTIONAL MATCH (p)-[:EVALUATES_ON]->(ds:Dataset)
                OPTIONAL MATCH (p)-[:REPORTS]->(r:Result)
                RETURN p.id AS id, p.title AS title, p.authors AS authors,
                       p.year AS year, p.filename AS filename,
                       collect(DISTINCT m.name) AS methods,
                       collect(DISTINCT d.name) AS domains,
                       collect(DISTINCT ds.name) AS datasets,
                       collect(DISTINCT {metric: r.metric, value: r.value, description: r.description}) AS results
            """, {"id": node_id})
            if not rows:
                return {}
            row = rows[0]
            authors = row.get("authors", [])
            if isinstance(authors, str):
                try: authors = json.loads(authors)
                except: authors = []
            return {
                "type": "Paper",
                "id": row["id"],
                "title": row.get("title") or "",
                "authors": authors,
                "year": row.get("year"),
                "filename": row.get("filename"),
                "methods": row.get("methods", []),
                "domains": row.get("domains", []),
                "datasets": row.get("datasets", []),
                "results": row.get("results", []),
                "method_count": len(row.get("methods", [])),
                "domain_count": len(row.get("domains", [])),
            }
        elif node_type == "Method":
            rows = await run_query("""
                MATCH (p:Paper)-[:USES_METHOD]->(m:Method {name: $name})
                RETURN m.name AS name, collect({id: p.id, title: p.title, year: p.year, authors: p.authors}) AS papers
            """, {"name": node_id})
            papers = []
            if rows:
                for pr in rows[0].get("papers", []):
                    a = pr.get("authors", [])
                    if isinstance(a, str):
                        try: a = json.loads(a)
                        except: a = []
                    papers.append({"id": pr["id"], "title": pr.get("title") or pr["id"][:8], "year": pr.get("year"), "authors": a})
            co_domain_rows = await run_query("""
                MATCH (p:Paper)-[:USES_METHOD]->(m:Method {name: $name})
                MATCH (p)-[:APPLIES_TO_DOMAIN]->(d:Domain)
                RETURN d.name AS name, count(p) AS count ORDER BY count DESC
            """, {"name": node_id})
            co_domains = [{"name": r["name"], "count": r["count"]} for r in co_domain_rows]
            return {"type": "Method", "id": node_id, "name": node_id, "paper_count": len(papers), "papers": papers, "co_domains": co_domains}
        elif node_type == "Domain":
            rows = await run_query("""
                MATCH (p:Paper)-[:APPLIES_TO_DOMAIN]->(d:Domain {name: $name})
                RETURN d.name AS name, collect({id: p.id, title: p.title, year: p.year, authors: p.authors}) AS papers
            """, {"name": node_id})
            papers = []
            if rows:
                for pr in rows[0].get("papers", []):
                    a = pr.get("authors", [])
                    if isinstance(a, str):
                        try: a = json.loads(a)
                        except: a = []
                    papers.append({"id": pr["id"], "title": pr.get("title") or pr["id"][:8], "year": pr.get("year"), "authors": a})
            co_method_rows = await run_query("""
                MATCH (p:Paper)-[:APPLIES_TO_DOMAIN]->(d:Domain {name: $name})
                MATCH (p)-[:USES_METHOD]->(m:Method)
                RETURN m.name AS name, count(p) AS count ORDER BY count DESC
            """, {"name": node_id})
            co_methods = [{"name": r["name"], "count": r["count"]} for r in co_method_rows]
            return {"type": "Domain", "id": node_id, "name": node_id, "paper_count": len(papers), "papers": papers, "co_methods": co_methods}
        elif node_type == "Dataset":
            rows = await run_query("""
                MATCH (p:Paper)-[:EVALUATES_ON]->(ds:Dataset {name: $name})
                RETURN ds.name AS name, collect({id: p.id, title: p.title, year: p.year, authors: p.authors}) AS papers
            """, {"name": node_id})
            papers = []
            if rows:
                for pr in rows[0].get("papers", []):
                    a = pr.get("authors", [])
                    if isinstance(a, str):
                        try: a = json.loads(a)
                        except: a = []
                    papers.append({"id": pr["id"], "title": pr.get("title") or pr["id"][:8], "year": pr.get("year"), "authors": a})
            return {"type": "Dataset", "id": node_id, "name": node_id, "paper_count": len(papers), "papers": papers}
        return {}


async def delete_paper(paper_id: str):

    """Delete a paper node, relationships, and clean up orphaned entities."""
    if neo4j_driver._use_local_sqlite:
        conn = sqlite3.connect(neo4j_driver.sqlite_db_path)
        cursor = conn.cursor()
        try:
            # Delete relationship records explicitly to bypass default SQLite FK constraints behavior
            cursor.execute("DELETE FROM paper_methods WHERE paper_id = ?", (paper_id,))
            cursor.execute("DELETE FROM paper_domains WHERE paper_id = ?", (paper_id,))
            cursor.execute("DELETE FROM paper_datasets WHERE paper_id = ?", (paper_id,))
            cursor.execute("DELETE FROM paper_results WHERE paper_id = ?", (paper_id,))
            
            # Delete paper record
            cursor.execute("DELETE FROM papers WHERE id = ?", (paper_id,))
            
            # Clean up orphaned entities
            cursor.execute("DELETE FROM methods WHERE name NOT IN (SELECT DISTINCT method_name FROM paper_methods)")
            cursor.execute("DELETE FROM domains WHERE name NOT IN (SELECT DISTINCT domain_name FROM paper_domains)")
            cursor.execute("DELETE FROM datasets WHERE name NOT IN (SELECT DISTINCT dataset_name FROM paper_datasets)")
            
            conn.commit()
            logger.info(f"Paper {paper_id} and orphaned entities deleted from SQLite")
        finally:
            conn.close()
    else:
        # 1. Delete paper node and its relationships in Neo4j
        await run_query(
            """
            MATCH (p:Paper {id: $id})
            DETACH DELETE p
            """,
            {"id": paper_id}
        )
        # 2. Delete orphaned entity nodes
        await run_query("MATCH (m:Method) WHERE not (m)<-[:USES_METHOD]-() DELETE m")
        await run_query("MATCH (d:Domain) WHERE not (d)<-[:APPLIES_TO_DOMAIN]-() DELETE d")
        await run_query("MATCH (ds:Dataset) WHERE not (ds)<-[:EVALUATES_ON]-() DELETE ds")
        logger.info(f"Paper {paper_id} and orphaned nodes deleted from Neo4j")


async def merge_nodes(source_name: str, target_name: str, entity_type: str = "Method") -> dict:
    """
    Merge a source entity node into a target canonical node for HITL curation.
    Re-points all relationships from source_name to target_name and removes source_name.
    """
    if not source_name or not target_name or source_name == target_name:
        return {"status": "error", "message": "Source and target names must be distinct."}

    if neo4j_driver._use_local_sqlite:
        conn = sqlite3.connect(neo4j_driver.sqlite_db_path)
        cursor = conn.cursor()
        try:
            if entity_type == "Method":
                # Ensure target exists
                cursor.execute("INSERT OR IGNORE INTO methods (name, category, description) VALUES (?, ?, ?)", (target_name, "General Method", ""))
                # Re-point relationships
                cursor.execute("UPDATE OR IGNORE paper_methods SET method_name = ? WHERE method_name = ?", (target_name, source_name))
                cursor.execute("DELETE FROM paper_methods WHERE method_name = ?", (source_name,))
                cursor.execute("DELETE FROM methods WHERE name = ?", (source_name,))
            elif entity_type == "Domain":
                cursor.execute("INSERT OR IGNORE INTO domains (name, subfield, description) VALUES (?, ?, ?)", (target_name, "General Domain", ""))
                cursor.execute("UPDATE OR IGNORE paper_domains SET domain_name = ? WHERE domain_name = ?", (target_name, source_name))
                cursor.execute("DELETE FROM paper_domains WHERE domain_name = ?", (source_name,))
                cursor.execute("DELETE FROM domains WHERE name = ?", (source_name,))
            elif entity_type == "Dataset":
                cursor.execute("INSERT OR IGNORE INTO datasets (name, domain) VALUES (?, ?)", (target_name, "General"))
                cursor.execute("UPDATE OR IGNORE paper_datasets SET dataset_name = ? WHERE dataset_name = ?", (target_name, source_name))
                cursor.execute("DELETE FROM paper_datasets WHERE dataset_name = ?", (source_name,))
                cursor.execute("DELETE FROM datasets WHERE name = ?", (source_name,))
            conn.commit()
            logger.info(f"Merged {entity_type} node '{source_name}' into '{target_name}' in SQLite")
        finally:
            conn.close()
    else:
        if entity_type == "Method":
            await run_query("MERGE (t:Method {name: $target})", {"target": target_name})
            await run_query("""
                MATCH (p:Paper)-[r:USES_METHOD]->(s:Method {name: $source})
                MATCH (t:Method {name: $target})
                MERGE (p)-[:USES_METHOD]->(t)
                DELETE r
            """, {"source": source_name, "target": target_name})
            await run_query("MATCH (s:Method {name: $source}) DETACH DELETE s", {"source": source_name})
        elif entity_type == "Domain":
            await run_query("MERGE (t:Domain {name: $target})", {"target": target_name})
            await run_query("""
                MATCH (p:Paper)-[r:APPLIES_TO_DOMAIN]->(s:Domain {name: $source})
                MATCH (t:Domain {name: $target})
                MERGE (p)-[:APPLIES_TO_DOMAIN]->(t)
                DELETE r
            """, {"source": source_name, "target": target_name})
            await run_query("MATCH (s:Domain {name: $source}) DETACH DELETE s", {"source": source_name})
        elif entity_type == "Dataset":
            await run_query("MERGE (t:Dataset {name: $target})", {"target": target_name})
            await run_query("""
                MATCH (p:Paper)-[r:EVALUATES_ON]->(s:Dataset {name: $source})
                MATCH (t:Dataset {name: $target})
                MERGE (p)-[:EVALUATES_ON]->(t)
                DELETE r
            """, {"source": source_name, "target": target_name})
            await run_query("MATCH (s:Dataset {name: $source}) DETACH DELETE s", {"source": source_name})

    return {"status": "ok", "source": source_name, "target": target_name, "entity_type": entity_type}


