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

    # 1. Upsert Paper node
    await run_query(
        """
        MERGE (p:Paper {id: $id})
        SET p.title    = $title,
            p.authors  = $authors,
            p.year     = $year,
            p.filename = $filename
        """,
        {
            "id": paper_id,
            "title": extraction.title,
            "authors": extraction.authors,
            "year": extraction.year,
            "filename": filename,
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
