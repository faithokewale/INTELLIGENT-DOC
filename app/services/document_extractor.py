from pathlib import Path

import pymupdf 
from docx import Document as DocxDocument


def extract_text(file_path: str, file_type: str) -> str:
    if file_type == ".pdf":
        return extract_pdf_text(file_path)

    if file_type == ".docx":
        return extract_docx_text(file_path)

    raise ValueError("Unsupported document type")


def extract_pdf_text(file_path: str) -> str:
    text = []

    with pymupdf.open(file_path) as pdf:
        for page in pdf:
            text.append(page.get_text())

    return "\n".join(text)


def extract_docx_text(file_path: str) -> str:
    document = DocxDocument(file_path)

    paragraphs = [
        paragraph.text
        for paragraph in document.paragraphs
        if paragraph.text.strip()
    ]

    return "\n".join(paragraphs)