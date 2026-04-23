from sentence_transformers import SentenceTransformer
from config import EMBED_MODEL

_model = None

#locally run embedding function using sentence-transformers, with the specified model, and return a list of embedding vectors
def embed(texts: list[str]) -> list[list[float]]:
    global _model
    if _model is None:
        _model = SentenceTransformer(EMBED_MODEL)
    return _model.encode(texts, normalize_embeddings=True).tolist()