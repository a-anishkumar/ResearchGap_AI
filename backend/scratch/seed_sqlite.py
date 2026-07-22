import asyncio
import os
import sys
import json
import sqlite3
from pathlib import Path

# Add backend to python path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.core import neo4j_driver
from app.services import graph_builder
from app.models.schemas import PaperExtraction, ResultItem

mock_data = [
    {
        "id": "paper_gnn_finance",
        "filename": "gnn_finance.pdf",
        "extraction": PaperExtraction(
            title="Graph Neural Networks for Financial Fraud Detection",
            authors=["Alice Smith", "Bob Jones"],
            year=2024,
            methods=["Graph Neural Networks", "Graph Convolutional Networks"],
            domains=["Financial Fraud Detection", "Anomaly Detection"],
            datasets=["Elliptic Data Set"],
            results=[ResultItem(metric="F1-score", value="0.92", description="Improved fraud detection performance")]
        )
    },
    {
        "id": "paper_contrastive_climate",
        "filename": "contrastive_climate.pdf",
        "extraction": PaperExtraction(
            title="Contrastive Learning for Climate Downscaling",
            authors=["Carol Vance", "Dan Miller"],
            year=2023,
            methods=["Contrastive Learning", "Self-Supervised Learning"],
            domains=["Climate Science", "Super-Resolution"],
            datasets=["ERA5 Reanalysis"],
            results=[ResultItem(metric="RMSE", value="0.15", description="Lower error in temperature downscaling")]
        )
    },
    {
        "id": "paper_active_nmt",
        "filename": "active_nmt.pdf",
        "extraction": PaperExtraction(
            title="Active Learning for Low-Resource Neural Machine Translation",
            authors=["Eva Green", "Frank Wright"],
            year=2024,
            methods=["Active Learning", "Transformer"],
            domains=["Neural Machine Translation", "Low-Resource Languages"],
            datasets=["WMT20"],
            results=[ResultItem(metric="BLEU", value="24.5", description="Higher BLEU score on low-resource pairs")]
        )
    },
    {
        "id": "paper_transformer_climate",
        "filename": "transformer_climate.pdf",
        "extraction": PaperExtraction(
            title="Transformer-based Sequence Modeling for Climate Forecasting",
            authors=["Grace Hopper", "Henry Ford"],
            year=2024,
            methods=["Transformer", "Self-Attention"],
            domains=["Climate Science", "Weather Forecasting"],
            datasets=["ERA5 Reanalysis"],
            results=[ResultItem(metric="MSE", value="0.08", description="Better long-term temporal prediction")]
        )
    },
    {
        "id": "paper_rl_drone",
        "filename": "rl_drone.pdf",
        "extraction": PaperExtraction(
            title="Reinforcement Learning for Autonomous Drone Navigation",
            authors=["Irene Adler", "John Watson"],
            year=2023,
            methods=["Reinforcement Learning", "Proximal Policy Optimization"],
            domains=["Autonomous Navigation", "Robotics"],
            datasets=["AirSim Corridor"],
            results=[ResultItem(metric="Success Rate", value="95%", description="Higher collision-avoidance rate")]
        )
    },
    {
        "id": "paper_gnn_drug",
        "filename": "gnn_drug.pdf",
        "extraction": PaperExtraction(
            title="GNNs for Molecule Property Prediction in Drug Discovery",
            authors=["Kevin Bacon", "Lisa Kudrow"],
            year=2024,
            methods=["Graph Neural Networks", "Graph Attention Networks"],
            domains=["Drug Discovery", "Bioinformatics"],
            datasets=["Tox21"],
            results=[ResultItem(metric="ROC-AUC", value="0.85", description="Strong classification accuracy on toxicity")]
        )
    }
]

async def main():
    print("Initializing SQLite database...")
    # Force SQLite fallback for this seed script
    neo4j_driver._use_local_sqlite = True
    neo4j_driver.init_sqlite_db()

    db_path = neo4j_driver.sqlite_db_path
    print(f"Connecting to database at {db_path}...")
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # Clear old tables
    tables = [
        "paper_methods", "paper_domains", "paper_datasets", "paper_results",
        "papers", "methods", "domains", "datasets", "results"
    ]
    print("Clearing old tables...")
    for t in tables:
        cursor.execute(f"DELETE FROM {t}")
    conn.commit()
    conn.close()

    # Write mock data using the service methods
    print("Inserting rich seed data...")
    for item in mock_data:
        print(f"Writing: {item['extraction'].title}")
        await graph_builder.write_paper(item["id"], item["filename"], item["extraction"])

    print("\nDatabase seeded successfully!")

    # Verify query output
    stats = await graph_builder.get_graph_stats()
    print("\nGraph Statistics:")
    print(stats)

    data = await graph_builder.get_graph_data()
    print(f"\nNodes count: {len(data['nodes'])}")
    print(f"Links count: {len(data['links'])}")

if __name__ == "__main__":
    asyncio.run(main())
