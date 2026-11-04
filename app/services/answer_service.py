from google import genai
from app.config import settings
client = genai.Client(api_key=settings.gemini_api_key)
def generate_answer(
    question: str,
    context: str,
    conversation_history: str = "",
) -> str:
    prompt = f"""
You are an AI assistant that answers questions about uploaded documents.
RULES:
1. Base factual answers on the provided document context.
2. Use conversation history only to understand follow-up questions and references.
3. Never invent facts, statistics, names, dates, or details.
4. If the context does not contain enough information to answer,
   clearly state what information is missing.
5. If only part of the question can be answered, answer that part
   and explain what cannot be determined from the context.
6. If the context does not support an answer, say:
   "The provided document does not contain enough information to answer this question."
7. Do not present assumptions or outside knowledge as facts from the document.
8. Answer clearly and directly. Avoid unnecessary repetition.
PREVIOUS CONVERSATION:
{conversation_history if conversation_history else "No previous messages."}
DOCUMENT CONTEXT:
{context}
CURRENT QUESTION:
{question}
ANSWER:
"""
    response = client.models.generate_content(
        model="gemini-3.5-flash-lite",
        contents=prompt,
    )
    if not response.text or not response.text.strip():
        raise RuntimeError("The AI model returned an empty response.")
    return response.text.strip()