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

    async def initialize_company_documents(self, db: AsyncSession) -> int:
        """
        Auto-ingest official company blueprints & SOPs from storage/company_documents into company_shared workspace.
        """
        company_dir = os.path.join(settings.STORAGE_DIR, "company_documents")
        if not os.path.exists(company_dir):
            os.makedirs(company_dir, exist_ok=True)
            return 0

        files = [f for f in os.listdir(company_dir) if os.path.isfile(os.path.join(company_dir, f))]
        ingested_count = 0

        # Ensure company_shared workspace exists in SQLite DB
        from backend.app.models.sql_models import Workspace
        ws = await db.get(Workspace, "company_shared")
        if not ws:
            ws = Workspace(
                id="company_shared",
                name="Company Official Knowledge Base",
                description="Official company SOPs, blueprints, and safety policies"
            )
            db.add(ws)
            await db.commit()

        for filename in files:
            filepath = os.path.join(company_dir, filename)
            doc_id = f"company_doc_{filename.replace('.', '_')}"
            
            # Check if document already ingested
            existing_doc = await db.get(Document, doc_id)
            if existing_doc and existing_doc.status == "indexed":
                continue

            file_ext = os.path.splitext(filename)[1].lstrip(".") or "markdown"
            
            if not existing_doc:
                doc_record = Document(
                    id=doc_id,
                    workspace_id="company_shared",
                    filename=filename,
                    filepath=filepath,
                    file_type=file_ext,
                    classification="official_company",
                    status="processing"
                )
                db.add(doc_record)
                await db.commit()

            chunks_indexed = await self.process_and_index_document(
                document_id=doc_id,
                workspace_id="company_shared",
                filepath=filepath,
                filename=filename,
                file_type=file_ext,
                db=db
            )
            ingested_count += chunks_indexed
            logger.info(f"Ingested company document '{filename}' into company_shared vector collection ({chunks_indexed} chunks).")

        return ingested_count


ingestion_service = DocumentIngestionService()
