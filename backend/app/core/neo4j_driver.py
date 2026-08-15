from neo4j import AsyncGraphDatabase, AsyncDriver
from app.core.config import settings
import logging
import sqlite3
import json
import os
from pathlib import Path

logger = logging.getLogger(__name__)

_driver: AsyncDriver | None = None
_use_local_sqlite = False

def __getattr__(name):
    if name == "sqlite_db_path":
        from app.core.project import get_sqlite_db_path
        return get_sqlite_db_path()
    raise AttributeError(f"module {__name__} has no attribute {name}")


def init_sqlite_db(db_path=None):
    """Initialize SQLite database schema if using fallback."""
    if db_path is None:
        from app.core.project import get_sqlite_db_path
        db_path = get_sqlite_db_path()
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


async def get_driver() -> AsyncDriver:
    global _driver
    if _driver is None:
        _driver = AsyncGraphDatabase.driver(
            settings.neo4j_uri,
            auth=(settings.neo4j_user, settings.neo4j_password),
            connection_timeout=5.0,
        )
    return _driver


async def close_driver():
    global _driver
    if _driver:
        await _driver.close()
        _driver = None


async def verify_connectivity():
    global _use_local_sqlite
    try:
        driver = await get_driver()
        await driver.verify_connectivity()
        _use_local_sqlite = False
        logger.info("✅ Neo4j connection verified")
    except Exception as e:
        logger.warning(f"⚠️ Neo4j connection failed: {e}. Falling back to local SQLite graph database.")
        _use_local_sqlite = True
        # Initialize default project db
        from app.core.project import get_sqlite_db_path
        init_sqlite_db(get_sqlite_db_path())


def run_query_sqlite(query: str, parameters: dict | None = None) -> list:
    """Mock Cypher queries using a local SQLite database."""
    parameters = parameters or {}
    from app.core.project import get_sqlite_db_path
    db_path = get_sqlite_db_path()
    os.makedirs(db_path.parent, exist_ok=True)
    conn = sqlite3.connect(str(db_path), timeout=10.0)
    cursor = conn.cursor()
    try:
        # Template 1: Create Constraint (No-op)
        if "CREATE CONSTRAINT" in query:
            return []

        # Template 2: Upsert Paper node
        if "MERGE (p:Paper {id: $id})" in query:
            authors = json.dumps(parameters.get("authors", []))
            import datetime
            now_str = datetime.datetime.utcnow().isoformat()
            cursor.execute(
                """
                INSERT INTO papers (id, title, authors, year, filename, uploaded_at)
                VALUES (?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    title=excluded.title,
                    authors=excluded.authors,
                    year=excluded.year,
                    filename=excluded.filename,
                    uploaded_at=coalesce(papers.uploaded_at, excluded.uploaded_at)
                """,
                (
                    parameters.get("id"),
                    parameters.get("title"),
                    authors,
                    parameters.get("year"),
                    parameters.get("filename"),
                    now_str,
                )
            )
            conn.commit()
            return []

        # Template 3: Methods (Write)
        if "MERGE (m:Method" in query or ("MERGE" in query and ":USES_METHOD" in query):
            cursor.execute("INSERT OR IGNORE INTO methods (name) VALUES (?)", (parameters.get("name"),))
            cursor.execute(
                "INSERT OR IGNORE INTO paper_methods (paper_id, method_name) VALUES (?, ?)",
                (parameters.get("pid"), parameters.get("name")),
            )
            conn.commit()
            return []

        # Template 4: Domains (Write)
        if "MERGE (d:Domain" in query or ("MERGE" in query and ":APPLIES_TO_DOMAIN" in query):
            cursor.execute("INSERT OR IGNORE INTO domains (name) VALUES (?)", (parameters.get("name"),))
            cursor.execute(
                "INSERT OR IGNORE INTO paper_domains (paper_id, domain_name) VALUES (?, ?)",
                (parameters.get("pid"), parameters.get("name")),
            )
            conn.commit()
            return []

        # Template 5: Datasets (Write)
        if "MERGE (ds:Dataset" in query or ("MERGE" in query and ":EVALUATES_ON" in query):
            cursor.execute("INSERT OR IGNORE INTO datasets (name) VALUES (?)", (parameters.get("name"),))
            cursor.execute(
                "INSERT OR IGNORE INTO paper_datasets (paper_id, dataset_name) VALUES (?, ?)",
                (parameters.get("pid"), parameters.get("name")),
            )
            conn.commit()
            return []

        # Template 6: Results (Write)
        if "MERGE (r:Result" in query or ("MERGE" in query and ":REPORTS" in query):
            cursor.execute(
                """
                INSERT INTO results (metric, value, description)
                VALUES (?, ?, ?)
                ON CONFLICT(metric, value) DO UPDATE SET description=excluded.description
                """,
                (parameters.get("metric"), parameters.get("value"), parameters.get("description")),
            )
            cursor.execute(
                "INSERT OR IGNORE INTO paper_results (paper_id, metric, value) VALUES (?, ?, ?)",
                (parameters.get("pid"), parameters.get("metric"), parameters.get("value")),
            )
            conn.commit()
            return []

        # Template 7: Graph Stats
        if "count(p) AS papers" in query:
            cursor.execute("SELECT COUNT(*) FROM papers")
            papers_count = cursor.fetchone()[0]
            cursor.execute("SELECT COUNT(*) FROM methods")
            methods_count = cursor.fetchone()[0]
            cursor.execute("SELECT COUNT(*) FROM domains")
            domains_count = cursor.fetchone()[0]
            cursor.execute("SELECT COUNT(*) FROM datasets")
            datasets_count = cursor.fetchone()[0]
            cursor.execute("SELECT COUNT(*) FROM results")
            results_count = cursor.fetchone()[0]

            cursor.execute("SELECT COUNT(*) FROM paper_methods")
            pm_count = cursor.fetchone()[0]
            cursor.execute("SELECT COUNT(*) FROM paper_domains")
            pd_count = cursor.fetchone()[0]
            cursor.execute("SELECT COUNT(*) FROM paper_datasets")
            pds_count = cursor.fetchone()[0]
            cursor.execute("SELECT COUNT(*) FROM paper_results")
            pr_count = cursor.fetchone()[0]

            rels_count = pm_count + pd_count + pds_count + pr_count
            return [{
                "papers": papers_count,
                "methods": methods_count,
                "domains": domains_count,
                "datasets": datasets_count,
                "results": results_count,
                "rels": rels_count,
            }]

        # Template 8: Node rows
        if "UNION ALL" in query and "props" in query:
            cursor.execute("SELECT id, title, authors, year, filename FROM papers")
            papers = cursor.fetchall()
            cursor.execute("SELECT name FROM methods")
            methods = cursor.fetchall()
            cursor.execute("SELECT name FROM domains")
            domains = cursor.fetchall()
            cursor.execute("SELECT name FROM datasets")
            datasets = cursor.fetchall()

            node_rows = []
            for r in papers:
                node_rows.append({
                    "id": r[0],
                    "label": r[1],
                    "type": "Paper",
                    "props": {
                        "title": r[1],
                        "year": r[3],
                        "authors": json.loads(r[2]) if r[2] else [],
                        "filename": r[4],
                    },
                })
            for r in methods:
                node_rows.append({"id": r[0], "label": r[0], "type": "Method", "props": {}})
            for r in domains:
                node_rows.append({"id": r[0], "label": r[0], "type": "Domain", "props": {}})
            for r in datasets:
                node_rows.append({"id": r[0], "label": r[0], "type": "Dataset", "props": {}})
            return node_rows

        # Template 9: Link rows
        if "UNION ALL" in query and "rt" in query:
            cursor.execute("SELECT paper_id, method_name FROM paper_methods")
            pm = cursor.fetchall()
            cursor.execute("SELECT paper_id, domain_name FROM paper_domains")
            pd = cursor.fetchall()
            cursor.execute("SELECT paper_id, dataset_name FROM paper_datasets")
            pds = cursor.fetchall()

            link_rows = []
            for r in pm:
                link_rows.append({"s": r[0], "t": r[1], "rt": "USES_METHOD"})
            for r in pd:
                link_rows.append({"s": r[0], "t": r[1], "rt": "APPLIES_TO_DOMAIN"})
            for r in pds:
                link_rows.append({"s": r[0], "t": r[1], "rt": "EVALUATES_ON"})
            return link_rows

        # Template 10: Observed pairs
        if "DISTINCT m.name AS method, d.name AS domain" in query:
            cursor.execute(
                """
                SELECT DISTINCT pm.method_name, pd.domain_name 
                FROM paper_methods pm 
                JOIN paper_domains pd ON pm.paper_id = pd.paper_id
                """
            )
            rows = cursor.fetchall()
            return [{"method": r[0], "domain": r[1]} for r in rows]

        # Template 11: Method frequencies
        if "m.name AS method, count(p) AS freq" in query:
            cursor.execute(
                """
                SELECT method_name, COUNT(*) AS freq 
                FROM paper_methods 
                GROUP BY method_name 
                ORDER BY freq DESC
                """
            )
            rows = cursor.fetchall()
            return [{"method": r[0], "freq": r[1]} for r in rows]

        # Template 12: Domain frequencies
        if "d.name AS domain, count(p) AS freq" in query:
            cursor.execute(
                """
                SELECT domain_name, COUNT(*) AS freq 
                FROM paper_domains 
                GROUP BY domain_name 
                ORDER BY freq DESC
                """
            )
            rows = cursor.fetchall()
            return [{"domain": r[0], "freq": r[1]} for r in rows]

        # Template 13: Papers for method
        if "USES_METHOD" in query and ("method:" in query or "method = ?" or "$method" in query):
            cursor.execute(
                """
                SELECT p.title 
                FROM papers p 
                JOIN paper_methods pm ON p.id = pm.paper_id 
                WHERE pm.method_name = ?
                """,
                (parameters.get("method"),),
            )
            rows = cursor.fetchall()
            return [{"title": r[0]} for r in rows]

        # Template 14: Papers for domain
        if "APPLIES_TO_DOMAIN" in query and ("domain:" in query or "domain = ?" or "$domain" in query):
            cursor.execute(
                """
                SELECT p.title 
                FROM papers p 
                JOIN paper_domains pd ON p.id = pd.paper_id 
                WHERE pd.domain_name = ?
                """,
                (parameters.get("domain"),),
            )
            rows = cursor.fetchall()
            return [{"title": r[0]} for r in rows]

        # Template 15: Node names UNION ALL (Methods, Domains, Datasets)
        if "RETURN" in query and "name AS name" in query:
            cursor.execute("SELECT name FROM methods UNION SELECT name FROM domains UNION SELECT name FROM datasets")
            rows = cursor.fetchall()
            return [{"name": r[0]} for r in rows if r[0]]

        # Template 16: Paper count query
        if "MATCH (p:Paper) RETURN count(p)" in query:
            cursor.execute("SELECT COUNT(*) FROM papers")
            return [{"count": cursor.fetchone()[0]}]

        raise ValueError(f"Unsupported offline Cypher query: {query}")

    finally:
        conn.close()


async def run_query(query: str, parameters: dict | None = None):
    global _use_local_sqlite
    if _use_local_sqlite:
        return run_query_sqlite(query, parameters)

    try:
        driver = await get_driver()
        async with driver.session() as session:
            result = await session.run(query, parameters or {})
            return await result.data()
    except Exception as e:
        logger.warning(f"Neo4j query failed ({e}). Falling back to local SQLite database.")
        _use_local_sqlite = True
        return run_query_sqlite(query, parameters)


