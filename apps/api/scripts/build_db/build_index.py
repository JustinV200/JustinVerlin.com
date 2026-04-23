import os
import sys
import numpy as np

# Add scripts/build_db/ to path so config/chunker/embed can be imported
sys.path.insert(0, os.path.dirname(__file__))
# Add apps/api/ to path so db.py can be imported
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from config import KNOWLEDGE_DIR
from chunker import chunk_file
from embed import embed
from core.db import init_db, get_db


"""
build_index.py
Run this script whenever the knowledge/ folder is updated.
It walks all .md files, splits them into chunks by ## headings,
embeds each chunk via the HuggingFace Inference API, and upserts
everything into the SQLite database.

Usage:
    cd apps/api
    python scripts/build_index.py
"""


# knowledge/ is in the same directory as this script
KNOWLEDGE_DIR = os.path.join(os.path.dirname(__file__), KNOWLEDGE_DIR)

def build_index():

    init_db()
    db = get_db()
    for root, dirs, files in os.walk(KNOWLEDGE_DIR):
        for file in sorted(files):
            if not file.endswith(".md"):
                continue

            source = os.path.relpath(os.path.join(root, file), KNOWLEDGE_DIR)
            category = os.path.dirname(source) or "general"

            with open(os.path.join(root, file), encoding="utf-8") as f:
                content = f.read()

            chunks = chunk_file(content)
            if not chunks:
                continue

            print(f"Indexing {source} ({len(chunks)} chunks)...")

            # Embed all chunks in one batch
            texts = [text for _, text in chunks]
            vectors = embed(texts)

            # Upsert document row
            db.execute(
                "INSERT INTO documents (source, category) VALUES (?, ?)"
                " ON CONFLICT(source) DO UPDATE SET category=excluded.category",
                (source, category),
            )
            doc_id = db.execute(
                "SELECT id FROM documents WHERE source = ?", (source,)
            ).fetchone()["id"]

            # Replace all chunks for this document
            db.execute("DELETE FROM chunks WHERE document_id = ?", (doc_id,))
            for (section, text), vector in zip(chunks, vectors):
                blob = np.array(vector, dtype=np.float32).tobytes()
                db.execute(
                    "INSERT INTO chunks (document_id, content, section, embedding)"
                    " VALUES (?, ?, ?, ?)",
                    (doc_id, text, section, blob),
                )

            db.commit()
            print(f"  Done.")

    db.close()
    print("Index build complete.")


if __name__ == "__main__":
    build_index()
