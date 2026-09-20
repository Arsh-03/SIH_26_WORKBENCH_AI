import os
import json
import logging
from typing import List, Dict, Any, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.config import settings
from backend.app.core.security import generate_id
from backend.app.models.schemas import NormalizedDocument
from backend.app.models.sql_models import Document, DocumentChunk
from backend.app.services.ollama_client import ollama_client
from backend.app.services.vector_store import vector_store_service
from backend.app.services.cv_client import cv_client

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

    async def _process_via_cv_client(self, filepath: str) -> Tuple[List[Dict[str, Any]], int]:
        """
        Helper method to invoke CVClient worker and format page OCR/tables into chunk dictionaries
        with preserved spatial metadata (bounding boxes, page dimensions, block/table IDs).
        Now normalizes CVRunnerResponse into NormalizedDocument before generating spatial chunks.
        """
        all_chunks: List[Dict[str, Any]] = []
        cv_res = await cv_client.run_cv_runner(input_path=filepath, confidence=0.40)

        if cv_res.status != "success" or not cv_res.pages:
            raise RuntimeError(f"CVClient runner failed or returned empty payload: {cv_res.errors}")

        # Normalize raw CVRunnerResponse into NormalizedDocument runtime model
        doc_filename = os.path.basename(filepath)
        ext_type = os.path.splitext(doc_filename)[1].lstrip(".") or "pdf"
        normalized_doc = NormalizedDocument.from_cv_runner_response(
            cv_res=cv_res,
            document_id=f"doc_{os.path.splitext(doc_filename)[0]}",
            filename=doc_filename,
            file_type=ext_type
        )

        for page_info in normalized_doc.pages:
            p_num = page_info.page_number
            p_w = page_info.width
            p_h = page_info.height


            # 1. Process OCR text blocks into spatial text chunks
            valid_blocks = [b for b in page_info.text_blocks if b.text and b.text.strip()]
            if valid_blocks:
                chunk_block_groups: List[List[Any]] = []
                current_group: List[Any] = []
                current_word_count = 0

                for b in valid_blocks:
                    words_in_b = len(b.text.split())
                    if current_group and (current_word_count + words_in_b > 400):
                        chunk_block_groups.append(current_group)
                        current_group = [b]
                        current_word_count = words_in_b
                    else:
                        current_group.append(b)
                        current_word_count += words_in_b

                if current_group:
                    chunk_block_groups.append(current_group)

                for group in chunk_block_groups:
                    group_content = " ".join(b.text.strip() for b in group)
                    ymins = [b.bounding_box_2d[0] for b in group if len(b.bounding_box_2d) >= 4]
                    xmins = [b.bounding_box_2d[1] for b in group if len(b.bounding_box_2d) >= 4]
                    ymaxs = [b.bounding_box_2d[2] for b in group if len(b.bounding_box_2d) >= 4]
                    xmaxs = [b.bounding_box_2d[3] for b in group if len(b.bounding_box_2d) >= 4]

                    union_bbox = [
                        min(ymins) if ymins else 0,
                        min(xmins) if xmins else 0,
                        max(ymaxs) if ymaxs else p_h,
                        max(xmaxs) if xmaxs else p_w,
                    ]

                    block_ids = [b.block_id for b in group if hasattr(b, "block_id")]

                    all_chunks.append({
                        "page_number": p_num,
                        "content": group_content,
                        "spatial_metadata": {
                            "bounding_box_2d": union_bbox,
                            "page_width": p_w,
                            "page_height": p_h,
                            "block_ids": block_ids,
                            "table_ids": [],
                            "has_spatial": True
                        }
                    })

            # 2. Process Extracted Tables into spatial table chunks
            if page_info.tables:
                for tbl in page_info.tables:
                    md_str = tbl.get("markdown", "")
                    t_bbox = tbl.get("bounding_box_2d", [0, 0, p_h, p_w])
                    t_id = tbl.get("table_id", f"tbl_{p_num}_01")

                    if md_str:
                        table_content = f"### Extracted Table ({t_id})\n{md_str}"
                        all_chunks.append({
                            "page_number": p_num,
                            "content": table_content,
                            "spatial_metadata": {
                                "bounding_box_2d": t_bbox,
                                "page_width": p_w,
                                "page_height": p_h,
                                "block_ids": [],
                                "table_ids": [t_id],
                                "has_spatial": True
                            }
                        })

        return all_chunks, normalized_doc.total_pages

    async def extract_text_and_chunks_from_file(self, filepath: str, file_type: str) -> Tuple[List[Dict[str, Any]], int]:
        """
        Extract text from file using PyMuPDF for PDFs (fast path), CVClient OCR for scanned/image PDFs & image files,
        or native parsers for plain text/CSV/code.
        Returns a list of chunk dictionaries and total page count.
        """
        all_chunks: List[Dict[str, Any]] = []
        total_pages = 1
        clean_ext = file_type.lower().lstrip(".")

        image_extensions = {"png", "jpg", "jpeg", "tiff", "bmp", "webp", "image/png", "image/jpeg"}

        # 1. IMAGE FILES: Always use CVClient OCR & spatial layout extraction
        if clean_ext in image_extensions or file_type.lower() in image_extensions:
            try:
                logger.info(f"Triggering CVClient OCR path for image document: {filepath}")
                return await self._process_via_cv_client(filepath)
            except Exception as e:
                logger.warning(f"CVClient image OCR failed for {filepath}: {e}. Returning empty text fallback for image.")
                return [], 1


        # 2. PDF FILES: Evaluate PyMuPDF fast path vs CVClient OCR path
        if clean_ext in ["pdf", "application/pdf"] or file_type.lower() in ["pdf", ".pdf", "application/pdf"]:
            fitz = None
            try:
                import pymupdf as fitz
            except ImportError:
                try:
                    import fitz
                except ImportError:
                    pass

            native_chunks: List[Dict[str, Any]] = []
            total_extracted_chars = 0
            has_tables_detected = False

            if fitz:
                try:
                    doc = fitz.open(filepath)
                    total_pages = len(doc)
                    for page_num in range(total_pages):
                        page = doc[page_num]
                        text = page.get_text("text")
                        if text.strip():
                            total_extracted_chars += len(text.strip())
                            page_chunks = self.chunk_text(text, page_number=page_num + 1)
                            native_chunks.extend(page_chunks)

                        # Quick check for table vector graphics or table bounding structures
                        if hasattr(page, "find_tables"):
                            try:
                                tabs = page.find_tables()
                                if tabs and len(tabs.tables) > 0:
                                    has_tables_detected = True
                            except Exception:
                                pass
                    doc.close()
                except Exception as e:
                    logger.error(f"Error extracting PDF text from {filepath}: {e}")

            # DETERMINISTIC TRIGGER CONDITION:
            # Trigger CVClient if:
            # a) Total native extracted text is extremely low (< 50 chars) -> Scanned / Image PDF
            # b) Average chars per page < 20
            # c) PDF contains complex tables where structured pdfplumber table extraction is beneficial
            avg_chars = total_extracted_chars / max(1, total_pages)
            should_trigger_cv = (total_extracted_chars < 50) or (avg_chars < 20) or has_tables_detected

            if should_trigger_cv:
                trigger_reason = (
                    "scanned/image PDF (total_chars < 50)" if total_extracted_chars < 50
                    else f"low text density (avg_chars={avg_chars:.1f})" if avg_chars < 20
                    else "structured tables detected"
                )
                logger.info(f"Triggering CVClient path for PDF ({trigger_reason}): {filepath}")
                try:
                    cv_chunks, cv_pages = await self._process_via_cv_client(filepath)
                    if cv_chunks:
                        return cv_chunks, cv_pages
                    logger.warning(f"CVClient returned no chunks for {filepath}. Falling back to PyMuPDF native chunks.")
                except Exception as e:
                    logger.warning(f"CVClient processing failed for PDF {filepath}: {e}. Falling back to PyMuPDF native chunks.")

            # Fast path or fallback: Return PyMuPDF native chunks if available
            if native_chunks:
                return native_chunks, total_pages

            # Final fallback for PDF
            try:
                with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
                    text = f.read()
                return self.chunk_text(text, page_number=1), total_pages
            except Exception:
                return [], total_pages

        # 3. PLAIN TEXT / MARKDOWN / CODE / CSV FILES
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
        chunks_data, total_pages = await self.extract_text_and_chunks_from_file(filepath, file_type)
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
            spatial_meta = chunk_info.get("spatial_metadata")

            # Compute embedding
            emb = await ollama_client.get_embedding(content)

            chunk_ids.append(vector_id)
            documents_text.append(content)
            embeddings.append(emb)

            meta_dict = {
                "document_id": document_id,
                "chunk_id": chunk_id,
                "workspace_id": workspace_id,
                "filename": filename,
                "page_number": page_no,
                "chunk_index": idx,
                "has_spatial": bool(spatial_meta and spatial_meta.get("has_spatial"))
            }

            if spatial_meta and spatial_meta.get("has_spatial"):
                meta_dict["spatial_bbox"] = json.dumps(spatial_meta.get("bounding_box_2d", [0, 0, 0, 0]))
                meta_dict["page_width"] = int(spatial_meta.get("page_width", 0))
                meta_dict["page_height"] = int(spatial_meta.get("page_height", 0))

            metadatas.append(meta_dict)

            db_chunk = DocumentChunk(
                id=chunk_id,
                document_id=document_id,
                chunk_index=idx,
                page_number=page_no,
                raw_content=content,
                vector_id=vector_id,
                spatial_metadata=json.dumps(spatial_meta) if spatial_meta else None
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
