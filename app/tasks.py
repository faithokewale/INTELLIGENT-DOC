import logging
from pathlib import Path

from app.celery_app import celery_app
from app.database import SessionLocal
from app.models.document import Document
from app.models.document_chunk import DocumentChunk
from app.services.document_extractor import extract_text
from app.services.chunker import chunk_text
from app.services.embedding_service import generate_embedding


logger = logging.getLogger(__name__)


@celery_app.task(name="app.tasks.process_document")
def process_document(document_id: int):
    db = SessionLocal()

    try:
        document = db.query(Document).filter(
            Document.id == document_id
        ).first()

        if not document:
            logger.error(
                "Document %s not found for processing",
                document_id,
            )
            return {
                "status": "failed",
                "error": "Document not found",
            }

        document.processing_status = "processing"
        db.commit()

        file_path = Path(document.file_path)

        extracted_text = extract_text(
            str(file_path),
            document.file_type,
        )

        chunks = chunk_text(extracted_text)

        if not chunks:
            raise ValueError(
                "No text could be extracted from the document."
            )

        document.extracted_text = extracted_text

        db.query(DocumentChunk).filter(
            DocumentChunk.document_id == document.id
        ).delete(synchronize_session=False)

        for index, chunk in enumerate(chunks):
            embedding = generate_embedding(chunk)

            db.add(
                DocumentChunk(
                    document_id=document.id,
                    chunk_text=chunk,
                    chunk_index=index,
                    embedding=embedding,
                )
            )

        document.processing_status = "completed"
        db.commit()

        logger.info(
            "Document %s processed successfully; created %s chunks",
            document.id,
            len(chunks),
        )

        return {
            "status": "completed",
            "document_id": document.id,
            "chunks_created": len(chunks),
        }

    except Exception:
        db.rollback()

        logger.exception(
            "Document processing failed for document %s",
            document_id,
        )

        try:
            document = db.query(Document).filter(
                Document.id == document_id
            ).first()

            if document:
                document.processing_status = "failed"
                db.commit()

        except Exception:
            db.rollback()
            logger.exception(
                "Could not update failure status for document %s",
                document_id,
            )

        raise

    finally:
        db.close()