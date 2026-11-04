from sqlalchemy import text
from sqlalchemy.orm import Session

from app.services.embedding_service import generate_embedding


def search_similar_chunks(
    db: Session,
    query: str,
    document_id: int,
    limit: int = 5
):
    query_embedding = generate_embedding(query)

    sql = text("""
        SELECT
            id,
            document_id,
            chunk_text,
            chunk_index,
            1 - (embedding <=> CAST(:embedding AS vector)) AS similarity
        FROM document_chunks
        WHERE document_id = :document_id
          AND embedding IS NOT NULL
        ORDER BY embedding <=> CAST(:embedding AS vector)
        LIMIT :limit
    """)

    results = db.execute(
        sql,
        {
            "embedding": str(query_embedding),
            "document_id": document_id,
            "limit": limit
        }
    ).mappings().all()

    return [dict(row) for row in results]