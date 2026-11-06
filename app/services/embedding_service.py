from functools import lru_cache


@lru_cache(maxsize=1)
def get_model():
    from fastembed import TextEmbedding
    return TextEmbedding("sentence-transformers/all-MiniLM-L6-v2")


def generate_embedding(text: str) -> list[float]:
    vector = next(iter(get_model().embed([text])))
    return vector.tolist()