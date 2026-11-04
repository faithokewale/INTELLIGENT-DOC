
from sqlalchemy.orm import Session

from app.models.conversation import Conversation, ConversationMessage


def create_conversation(
    db: Session,
    user_id: int,
    document_id: int,
    title: str | None = None,
) -> Conversation:
    conversation = Conversation(
        user_id=user_id,
        document_id=document_id,
        title=title,
    )

    db.add(conversation)
    db.commit()
    db.refresh(conversation)

    return conversation


def save_message(
    db: Session,
    conversation_id: int,
    role: str,
    content: str,
) -> ConversationMessage:
    message = ConversationMessage(
        conversation_id=conversation_id,
        role=role,
        content=content,
    )

    db.add(message)
    db.commit()
    db.refresh(message)

    return message


def get_conversation_history(
    db: Session,
    conversation_id: int,
    limit: int = 10,
) -> list[ConversationMessage]:
    messages = (
        db.query(ConversationMessage)
        .filter(
            ConversationMessage.conversation_id == conversation_id
        )
        .order_by(ConversationMessage.created_at.desc(),
                  ConversationMessage.id.desc())
        .limit(limit)
        .all()
    )

    return list(reversed(messages))