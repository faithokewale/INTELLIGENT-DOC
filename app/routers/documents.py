import logging
import zipfile
from pathlib import Path
from uuid import uuid4

from fastapi import (
    APIRouter,
    Depends,
    File,
    HTTPException,
    Query, 
    Request,
    UploadFile,
    status,
)
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.document import Document
from app.models.conversation import Conversation
from app.models.user import User
from app.models.document_permission import DocumentPermission
from app.security import get_current_user
from app.services.search_service import search_similar_chunks
from app.services.answer_service import generate_answer
from app.services.conversation_service import (
    create_conversation,
    save_message,
    get_conversation_history,
)
from app.routers.auth import limiter


logger = logging.getLogger(__name__)

router = APIRouter(prefix="/documents", tags=["Documents"])

UPLOAD_DIR = Path("uploads")
ALLOWED_EXTENSIONS = {".pdf", ".docx"}
MAX_UPLOAD_SIZE = 100 * 1024 * 1024
CHUNK_SIZE = 1024 * 1024


class ShareDocumentRequest(BaseModel):
    email: EmailStr
    permission: str = Field(default="viewer")


def validate_file_signature(file_path: Path, extension: str) -> bool:
    """Check that the uploaded file has the expected basic file signature."""
    try:
        with file_path.open("rb") as file:
            header = file.read(8)

        if extension == ".pdf":
            return header.startswith(b"%PDF-")

        if extension == ".docx":
            if not zipfile.is_zipfile(file_path):
                return False

            with zipfile.ZipFile(file_path, "r") as archive:
                names = set(archive.namelist())

                return (
                    "[Content_Types].xml" in names
                    and "word/document.xml" in names
                )

    except (OSError, zipfile.BadZipFile):
        return False

    return False


@router.post("/upload", status_code=status.HTTP_202_ACCEPTED)
@limiter.limit("10/minute")
def upload_document(
    request: Request,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    original_filename = Path(file.filename or "").name
    file_extension = Path(original_filename).suffix.lower()

    if not original_filename or file_extension not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only PDF and DOCX files are allowed",
        )

    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

    # Generate a unique server-side filename instead of trusting the
    # supplied filename for the physical storage path.
    stored_filename = (
        f"{current_user.id}_{uuid4().hex}{file_extension}"
    )
    file_path = UPLOAD_DIR / stored_filename

    total_size = 0

    try:
        with file_path.open("wb") as buffer:
            while True:
                chunk = file.file.read(CHUNK_SIZE)

                if not chunk:
                    break

                total_size += len(chunk)

                if total_size > MAX_UPLOAD_SIZE:
                    raise HTTPException(
                        status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                        detail="File exceeds the 100 MB upload limit",
                    )

                buffer.write(chunk)

        if total_size == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Uploaded file is empty",
            )

        if not validate_file_signature(file_path, file_extension):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    "File content does not match a valid PDF or DOCX "
                    "document"
                ),
            )

        document = Document(
            filename=original_filename,
            file_type=file_extension,
            file_path=str(file_path),
            extracted_text=None,
            processing_status="pending",
            user_id=current_user.id,
        )

        db.add(document)
        db.commit()
        db.refresh(document)

        from app.tasks import process_document

        process_document.delay(document.id)

        return {
            "message": "Document uploaded and queued for processing",
            "document_id": document.id,
            "filename": document.filename,
            "processing_status": document.processing_status,
        }

    except HTTPException:
        if file_path.exists():
            file_path.unlink()
        raise

    except Exception:
        db.rollback()

        if file_path.exists():
            file_path.unlink()

        logger.exception("Failed to upload or queue document")

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not upload or queue document processing",
        )

    finally:
        file.file.close()


@router.get("/{document_id}/status")
def get_document_status(
    document_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    document = get_accessible_document(
        document_id=document_id,
        current_user=current_user,
        db=db,
    )

    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found or access denied",
        )

    return {
        "document_id": document.id,
        "filename": document.filename,
        "processing_status": document.processing_status,
    }


@router.get("/{document_id}/search")
@limiter.limit("30/minute")
def search_document(
    request: Request,
    document_id: int,
    query: str = Query(..., min_length=1, max_length=1000),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = query.strip()

    if not query:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Search query cannot be empty",
        )

    document = get_accessible_document(
        document_id=document_id,
        current_user=current_user,
        db=db,
    )

    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found or access denied",
        )

    if document.processing_status != "completed":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Document is not ready. "
                f"Current status: {document.processing_status}"
            ),
        )

    results = search_similar_chunks(
        db=db,
        query=query,
        document_id=document_id,
    )

    return {
        "document_id": document_id,
        "query": query,
        "results": results,
    }


@router.get("/{document_id}/ask")
@limiter.limit("10/minute")
def ask_document(
    request: Request,
    document_id: int,
    question: str = Query(..., min_length=1, max_length=2000),
    conversation_id: int | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    question = question.strip()

    if not question:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Question cannot be empty",
        )

    document = get_accessible_document(
        document_id=document_id,
        current_user=current_user,
        db=db,
    )

    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found or access denied",
        )

    if document.processing_status != "completed":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Document is not ready. "
                f"Current status: {document.processing_status}"
            ),
        )

    if conversation_id is None:
        conversation = create_conversation(
            db=db,
            user_id=current_user.id,
            document_id=document_id,
            title=question[:255],
        )
    else:
        conversation = db.query(Conversation).filter(
            Conversation.id == conversation_id,
            Conversation.user_id == current_user.id,
            Conversation.document_id == document_id,
        ).first()

        if not conversation:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Conversation not found",
            )

    previous_messages = get_conversation_history(
        db=db,
        conversation_id=conversation.id,
        limit=10,
    )

    conversation_history = "\n\n".join(
        f"{message.role.upper()}: {message.content}"
        for message in previous_messages
    )

    results = search_similar_chunks(
        db=db,
        query=question,
        document_id=document_id,
    )

    if not results:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No document chunks available for answering",
        )

    context = "\n\n".join(
        result["chunk_text"] for result in results
    )

    save_message(
        db=db,
        conversation_id=conversation.id,
        role="user",
        content=question,
    )

    answer = generate_answer(
        question=question,
        context=context,
        conversation_history=conversation_history,
    )

    save_message(
        db=db,
        conversation_id=conversation.id,
        role="assistant",
        content=answer,
    )

    return {
        "document_id": document_id,
        "conversation_id": conversation.id,
        "question": question,
        "answer": answer,
        "sources": results,
    }


@router.get("/conversations/{conversation_id}/history")
def get_conversation_messages(
    conversation_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    conversation = db.query(Conversation).filter(
        Conversation.id == conversation_id,
        Conversation.user_id == current_user.id,
    ).first()

    if not conversation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found",
        )

    messages = get_conversation_history(
        db=db,
        conversation_id=conversation_id,
        limit=100,
    )

    return {
        "conversation_id": conversation_id,
        "document_id": conversation.document_id,
        "messages": [
            {
                "id": message.id,
                "role": message.role,
                "content": message.content,
                "created_at": message.created_at,
            }
            for message in messages
        ],
    }


@router.post("/{document_id}/permissions")
def share_document(
    document_id: int,
    request: ShareDocumentRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if request.permission not in {"viewer", "editor"}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Permission must be 'viewer' or 'editor'",
        )

    document = db.query(Document).filter(
        Document.id == document_id,
        Document.user_id == current_user.id,
    ).first()

    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found or you are not its owner",
        )

    recipient = db.query(User).filter(
        User.email == request.email,
    ).first()

    if not recipient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Recipient user not found. They must register first.",
        )

    if recipient.id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You already own this document",
        )

    permission = db.query(DocumentPermission).filter(
        DocumentPermission.document_id == document_id,
        DocumentPermission.user_id == recipient.id,
    ).first()

    if permission:
        permission.permission = request.permission
    else:
        permission = DocumentPermission(
            document_id=document_id,
            user_id=recipient.id,
            permission=request.permission,
        )
        db.add(permission)

    db.commit()
    db.refresh(permission)

    return {
        "message": "Document access granted successfully",
        "document_id": document_id,
        "shared_with": recipient.email,
        "permission": permission.permission,
    }


def get_accessible_document(
    document_id: int,
    current_user: User,
    db: Session,
):
    document = db.query(Document).filter(
        Document.id == document_id,
    ).first()

    if not document:
        return None

    if document.user_id == current_user.id:
        return document

    permission = db.query(DocumentPermission).filter(
        DocumentPermission.document_id == document_id,
        DocumentPermission.user_id == current_user.id,
    ).first()

    if permission and permission.permission in {"viewer", "editor"}:
        return document

    return None


@router.get("")
def list_documents(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    owned = db.query(Document).filter(Document.user_id == current_user.id).all()
    shared = (
        db.query(Document, DocumentPermission.permission, User.email)
        .join(DocumentPermission, DocumentPermission.document_id == Document.id)
        .join(User, User.id == Document.user_id)
        .filter(DocumentPermission.user_id == current_user.id)
        .all()
    )
    rows = [
        {"id": d.id, "filename": d.filename, "processing_status": d.processing_status,
         "role": "owner", "owner_email": current_user.email, "created_at": None}
        for d in owned
    ]
    rows += [
        {"id": d.id, "filename": d.filename, "processing_status": d.processing_status,
         "role": perm, "owner_email": email, "created_at": None}
        for d, perm, email in shared
    ]
    rows.sort(key=lambda r: r["id"], reverse=True)
    return rows


@router.get("/{document_id}/conversations")
def list_document_conversations(
    document_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    document = get_accessible_document(document_id=document_id, current_user=current_user, db=db)
    if not document:
        raise HTTPException(status_code=404, detail="Document not found or access denied")
    convs = (
        db.query(Conversation)
        .filter(Conversation.document_id == document_id, Conversation.user_id == current_user.id)
        .order_by(Conversation.id.desc())
        .all()
    )
    return [{"id": c.id, "title": c.title, "created_at": c.created_at} for c in convs]