import os
import logging
from typing import List, Dict, Any, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.config import settings
from backend.app.core.security import generate_id
from backend.app.models.sql_models import Document, DocumentChunk
from backend.app.services.ollama_client import ollama_client
from backend.app.services.vector_store import vector_store_service

logger = logging.getLogger("ingestion_service")

class DocumentIngestionService:
    def chunk_text(self, text: str, page_number: int = 1, chunk_size: int = 512, overlap: int = 50) -> List[Dict[str, Any]]:
        """
        Split text into overlapping chunks of approx chunk_size characters/tokens.
        """
        if not text or not text.strip():
            return []

        words = text.split()
        if not words:
            return []

        chunks = []
        start_idx = 0
        while start_idx < len(words):
            end_idx = min(start_idx + chunk_size, len(words))
            chunk_words = words[start_idx:end_idx]
            chunk_content = " ".join(chunk_words)

            chunks.append({
                "page_number": page_number,
                "content": chunk_content
            })

            if end_idx >= len(words):
                break
            start_idx += max(1, chunk_size - overlap)

        return chunks

    def extract_text_and_chunks_from_file(self, filepath: str, file_type: str) -> Tuple[List[Dict[str, Any]], int]:
        """
        Extract text from file using PyMuPDF for PDFs or native parsers for text/CSV/code.
        Returns a list of chunk dictionaries and total page count.
        """
        all_chunks: List[Dict[str, Any]] = []
        total_pages = 1

        if file_type.lower() in ["pdf", ".pdf", "application/pdf"]:
            fitz = None
            try:
                import pymupdf as fitz
            except ImportError:
                try:
                    import fitz
                except ImportError:
                    pass

            if fitz:
                try:
                    doc = fitz.open(filepath)
                    total_pages = len(doc)
                    for page_num in range(total_pages):
                        page = doc[page_num]
                        text = page.get_text("text")
                        if text.strip():
                            page_chunks = self.chunk_text(text, page_number=page_num + 1)
                            all_chunks.extend(page_chunks)
                    doc.close()
                except Exception as e:
                    logger.error(f"Error extracting PDF text from {filepath}: {e}")
            else:
                logger.warning("PyMuPDF (fitz) not installed. Using raw text parser fallback for PDF.")
                try:
                    with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
                        text = f.read()
                    all_chunks = self.chunk_text(text, page_number=1)
                except Exception as e:
                    logger.error(f"Error extracting PDF fallback: {e}")
        else:

            # For plain text, markdown, CSV, logs, etc.
            try:
                with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
                    text = f.read()
                all_chunks = self.chunk_text(text, page_number=1)
                total_pages = 1
            except Exception as e:
                logger.error(f"Error extracting text from {filepath}: {e}")

        return all_chunks, total_pages

    async def process_and_index_document(
        self,
        document_id: str,
        workspace_id: str,
        filepath: str,
        filename: str,
        file_type: str,
        db: AsyncSession
    ) -> int:
        """
        Extract, chunk, embed, and store document in ChromaDB/Vector store and SQLite.
        """
        chunks_data, total_pages = self.extract_text_and_chunks_from_file(filepath, file_type)
        if not chunks_data:
            chunks_data = [{
                "page_number": 1,
                "content": f"Document: {filename} (Binary or empty document)"
            }]

        chunk_ids = []
        documents_text = []
        embeddings = []
        metadatas = []

        db_chunks = []
        for idx, chunk_info in enumerate(chunks_data):
            chunk_id = generate_id("chk")
            vector_id = f"{document_id}_{chunk_id}"
            content = chunk_info["content"]
            page_no = chunk_info["page_number"]

            # Compute embedding
            emb = await ollama_client.get_embedding(content)

            chunk_ids.append(vector_id)
            documents_text.append(content)
            embeddings.append(emb)
            metadatas.append({
                "document_id": document_id,
                "chunk_id": chunk_id,
                "workspace_id": workspace_id,
                "filename": filename,
                "page_number": page_no,
                "chunk_index": idx
            })

            db_chunk = DocumentChunk(
                id=chunk_id,
                document_id=document_id,
                chunk_index=idx,
                page_number=page_no,
                raw_content=content,
                vector_id=vector_id
            )
            db_chunks.append(db_chunk)

        # Store in Vector Store
        vector_store_service.add_chunks(
            workspace_id=workspace_id,
            chunk_ids=chunk_ids,
            documents=documents_text,
            embeddings=embeddings,
            metadatas=metadatas
        )

        # Store in SQLite
        for chunk in db_chunks:
            db.add(chunk)

        # Update document status
        doc_record = await db.get(Document, document_id)
        if doc_record:
            doc_record.chunk_count = len(chunks_data)
            doc_record.status = "indexed"
            db.add(doc_record)

        await db.commit()
        return len(chunks_data)


ingestion_service = DocumentIngestionService()
