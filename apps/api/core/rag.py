import numpy as np
from sentence_transformers import SentenceTransformer
from core.db import get_db

# used for embeddings and retrieval. We load all chunk embeddings into memory at startup for fast retrieval.
EMBED_MODEL = "sentence-transformers/all-MiniLM-L6-v2"

_model = None
_matrix = None
_chunk_ids = None
_chunk_contents = None


def _get_model():
    global _model
    if _model is None:
        _model = SentenceTransformer(EMBED_MODEL)
    return _model


def load_index():
    #Load all chunk embeddings from the DB into memory. Call once at startup.
    global _matrix, _chunk_ids, _chunk_contents
    db = get_db()
    rows = db.execute("SELECT id, content, embedding FROM chunks").fetchall()
    db.close()
    if not rows:
        print("Warning: no chunks found in DB. Run build_index.py first.")
        return
    _chunk_ids = [r["id"] for r in rows]
    _chunk_contents = [r["content"] for r in rows]
    vecs = np.stack([np.frombuffer(r["embedding"], dtype=np.float32) for r in rows])
    norms = np.linalg.norm(vecs, axis=1, keepdims=True)
    _matrix = vecs / np.where(norms == 0, 1, norms)
    print(f"RAG index loaded: {len(rows)} chunks.")


def retrieve(query: str, k: int = 8) -> list[str]:
    #Return the top-k most relevant chunk texts for a query.
    if _matrix is None:
        return []
    model = _get_model()
    q_vec = model.encode([query], normalize_embeddings=True)[0]
    scores = _matrix @ q_vec
    top_indices = np.argsort(-scores)[:k]
    return [_chunk_contents[i] for i in top_indices]
