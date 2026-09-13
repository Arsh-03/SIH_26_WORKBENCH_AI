import os
import datetime
import asyncio
from pathlib import Path
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, BackgroundTasks, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from backend.app.config import settings
from backend.app.database import get_db, AsyncSessionLocal
from backend.app.models.sql_models import Workspace, Document, DocumentChunk
from backend.app.models.schemas import (
    DocumentUploadResponse,
    DocumentStatusResponse,
    DocumentItem,
    DocumentContentResponse,
    DocumentUpdateRequest
)
from backend.app.core.security import generate_id, sanitize_filename
from backend.app.services.ingestion_service import ingestion_service
from backend.app.services.vector_store import vector_store_service

router = APIRouter()

async def process_document_background(
    doc_id: str,
    workspace_id: str,
    saved_filepath: str,
    filename: str,
    file_type: str
):
    """Background task to run parsing, chunking, and ChromaDB vector indexing."""
    async with AsyncSessionLocal() as session:
        try:
            await ingestion_service.process_and_index_document(
                document_id=doc_id,
                workspace_id=workspace_id,
                filepath=saved_filepath,
                filename=filename,
                file_type=file_type,
                db=session
            )
        except Exception as e:
            # Mark document as failed if error occurs
            doc = await session.get(Document, doc_id)
            if doc:
                doc.status = "failed"
                await session.commit()

@router.post("/{workspace_id}/documents/upload", response_model=DocumentUploadResponse, status_code=status.HTTP_202_ACCEPTED)
async def upload_document(
    workspace_id: str,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    doc_type: str = Form(default="manual"),
    classification: str = Form(default="confidential"),
    db: AsyncSession = Depends(get_db)
):
    """Upload and schedule ingestion & indexing for an industrial document."""
    # Verify workspace exists or auto-create workspace if not exists
    workspace = await db.get(Workspace, workspace_id)
    if not workspace:
        workspace = Workspace(
            id=workspace_id,
            name=f"Workspace {workspace_id}",
            description="Auto-created workspace",
            created_at=datetime.datetime.utcnow()
        )
        db.add(workspace)
        await db.commit()

    doc_id = generate_id("doc")
    clean_filename = sanitize_filename(file.filename or "uploaded_file.bin")
    
    # Workspace upload directory
    ws_upload_dir = Path(settings.UPLOADS_DIR) / workspace_id
    ws_upload_dir.mkdir(parents=True, exist_ok=True)
    
    saved_filepath = ws_upload_dir / f"{doc_id}_{clean_filename}"

    # Read and save file content
    contents = await file.read()
    file_size = len(contents)
    with open(saved_filepath, "wb") as f:
        f.write(contents)

    file_ext = Path(clean_filename).suffix.lstrip(".") or doc_type
    estimated_chunks = max(1, file_size // 1500)
    now = datetime.datetime.utcnow()

    # Record in database as queued
    document = Document(
        id=doc_id,
        workspace_id=workspace_id,
        filename=clean_filename,
        filepath=str(saved_filepath),
        file_type=file_ext,
        classification=classification,
        chunk_count=estimated_chunks,
        status="queued",
        created_at=now
    )
    db.add(document)
    await db.commit()

    # Dispatch ingestion background task
    background_tasks.add_task(
        process_document_background,
        doc_id=doc_id,
        workspace_id=workspace_id,
        saved_filepath=str(saved_filepath),
        filename=clean_filename,
        file_type=file_ext
    )

    return DocumentUploadResponse(
        document_id=doc_id,
        workspace_id=workspace_id,
        filename=clean_filename,
        file_size_bytes=file_size,
        status="queued",
        estimated_chunks=estimated_chunks,
        created_at=now.isoformat() + "Z"
    )

@router.get("/{workspace_id}/documents/{document_id}/status", response_model=DocumentStatusResponse)
async def get_document_status(workspace_id: str, document_id: str, db: AsyncSession = Depends(get_db)):
    """Retrieve indexing status for a document."""
    doc = await db.get(Document, document_id)
    if not doc or doc.workspace_id != workspace_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found in workspace")

    # Fetch chunk count
    res = await db.execute(select(DocumentChunk).where(DocumentChunk.document_id == document_id))
    chunks = res.scalars().all()
    total_chunks = len(chunks) or doc.chunk_count

    # Max page number
    total_pages = max([c.page_number for c in chunks if c.page_number] or [1])

    completed_at = doc.created_at.isoformat() + "Z" if doc.status == "indexed" and doc.created_at else None

    return DocumentStatusResponse(
        document_id=doc.id,
        workspace_id=doc.workspace_id,
        status=doc.status,
        total_pages=total_pages,
        total_chunks=total_chunks,
        embedding_model=settings.EMBEDDING_MODEL.split(":")[0],
        vector_dimensions=settings.EMBEDDING_DIMENSIONS,
        completed_at=completed_at
    )

@router.get("/{workspace_id}/documents", response_model=List[DocumentItem])
async def list_workspace_documents(workspace_id: str, db: AsyncSession = Depends(get_db)):
    """List all indexed documents for a workspace."""
    res = await db.execute(select(Document).where(Document.workspace_id == workspace_id).order_by(Document.created_at.desc()))
    docs = res.scalars().all()
    return [
        DocumentItem(
            id=d.id,
            workspace_id=d.workspace_id,
            filename=d.filename,
            filepath=d.filepath,
            file_type=d.file_type,
            classification=d.classification,
            chunk_count=d.chunk_count,
            status=d.status,
            created_at=d.created_at.isoformat() + "Z" if d.created_at else ""
        )
        for d in docs
    ]

@router.get("/{workspace_id}/documents/{document_id}/content", response_model=DocumentContentResponse)
async def get_document_content(workspace_id: str, document_id: str, db: AsyncSession = Depends(get_db)):
    """Fetch the raw text or markdown content of a document."""
    doc = await db.get(Document, document_id)
    if not doc or doc.workspace_id != workspace_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found in workspace")

    content_str = ""
    if doc.filepath and os.path.exists(doc.filepath):
        try:
            with open(doc.filepath, "r", encoding="utf-8", errors="replace") as f:
                content_str = f.read()
        except Exception as e:
            content_str = f"[Error reading file: {str(e)}]"

    # Chunk count
    res = await db.execute(select(DocumentChunk).where(DocumentChunk.document_id == document_id))
    chunks = res.scalars().all()
    chunk_count = len(chunks) or doc.chunk_count

    return DocumentContentResponse(
        document_id=doc.id,
        workspace_id=doc.workspace_id,
        filename=doc.filename,
        file_type=doc.file_type,
        content=content_str,
        chunk_count=chunk_count,
        status=doc.status
    )

@router.put("/{workspace_id}/documents/{document_id}", response_model=DocumentStatusResponse)
async def update_document_content(
    workspace_id: str,
    document_id: str,
    payload: DocumentUpdateRequest,
    db: AsyncSession = Depends(get_db)
):
    """Update document content, overwrite file on disk, purge old vectors and re-index dynamically."""
    doc = await db.get(Document, document_id)
    if not doc or doc.workspace_id != workspace_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found in workspace")

    if payload.filename:
        doc.filename = sanitize_filename(payload.filename)
    if payload.classification:
        doc.classification = payload.classification

    # Write updated content to disk
    if doc.filepath:
        os.makedirs(os.path.dirname(doc.filepath), exist_ok=True)
        with open(doc.filepath, "w", encoding="utf-8") as f:
            f.write(payload.content)

    # 1. Purge existing chunks from ChromaDB
    await vector_store_service.delete_document_chunks(workspace_id=workspace_id, document_id=document_id)

    # 2. Purge existing chunk rows from SQL DB
    await db.execute(delete(DocumentChunk).where(DocumentChunk.document_id == document_id))
    await db.commit()

    # 3. Synchronously re-index the document content
    try:
        await ingestion_service.process_and_index_document(
            document_id=doc.id,
            workspace_id=workspace_id,
            filepath=doc.filepath,
            filename=doc.filename,
            file_type=doc.file_type,
            db=db
        )
    except Exception as e:
        doc.status = "failed"
        await db.commit()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Re-indexing failed: {str(e)}")

    # Fetch updated info
    res = await db.execute(select(DocumentChunk).where(DocumentChunk.document_id == document_id))
    chunks = res.scalars().all()
    total_chunks = len(chunks)
    total_pages = max([c.page_number for c in chunks if c.page_number] or [1])

    return DocumentStatusResponse(
        document_id=doc.id,
        workspace_id=doc.workspace_id,
        status="indexed",
        total_pages=total_pages,
        total_chunks=total_chunks,
        embedding_model=settings.EMBEDDING_MODEL.split(":")[0],
        vector_dimensions=settings.EMBEDDING_DIMENSIONS,
        completed_at=datetime.datetime.utcnow().isoformat() + "Z"
    )

@router.delete("/{workspace_id}/documents/{document_id}")
async def delete_document(workspace_id: str, document_id: str, db: AsyncSession = Depends(get_db)):
    """Delete a document from workspace, removing disk file, SQL records, and Chroma vectors."""
    doc = await db.get(Document, document_id)
    if not doc or doc.workspace_id != workspace_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found in workspace")

    # 1. Delete Chroma vectors
    await vector_store_service.delete_document_chunks(workspace_id=workspace_id, document_id=document_id)

    # 2. Delete DB chunks
    await db.execute(delete(DocumentChunk).where(DocumentChunk.document_id == document_id))

    # 3. Delete DB document record
    await db.delete(doc)
    await db.commit()

    # 4. Remove file from disk
    if doc.filepath and os.path.exists(doc.filepath):
        try:
            os.remove(doc.filepath)
        except OSError:
            pass

    return {"status": "deleted", "document_id": document_id, "workspace_id": workspace_id}

@router.post("/{workspace_id}/documents/{document_id}/reindex", response_model=DocumentStatusResponse)
async def reindex_document(workspace_id: str, document_id: str, db: AsyncSession = Depends(get_db)):
    """Manually trigger re-indexing of an existing document."""
    doc = await db.get(Document, document_id)
    if not doc or doc.workspace_id != workspace_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found in workspace")

    if not doc.filepath or not os.path.exists(doc.filepath):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Underlying document file not found on disk")

    # Purge old vectors and chunk records
    await vector_store_service.delete_document_chunks(workspace_id=workspace_id, document_id=document_id)
    await db.execute(delete(DocumentChunk).where(DocumentChunk.document_id == document_id))
    await db.commit()

    try:
        await ingestion_service.process_and_index_document(
            document_id=doc.id,
            workspace_id=workspace_id,
            filepath=doc.filepath,
            filename=doc.filename,
            file_type=doc.file_type,
            db=db
        )
    except Exception as e:
        doc.status = "failed"
        await db.commit()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Re-indexing failed: {str(e)}")

    res = await db.execute(select(DocumentChunk).where(DocumentChunk.document_id == document_id))
    chunks = res.scalars().all()
    total_chunks = len(chunks)
    total_pages = max([c.page_number for c in chunks if c.page_number] or [1])

    return DocumentStatusResponse(
        document_id=doc.id,
        workspace_id=doc.workspace_id,
        status="indexed",
        total_pages=total_pages,
        total_chunks=total_chunks,
        embedding_model=settings.EMBEDDING_MODEL.split(":")[0],
        vector_dimensions=settings.EMBEDDING_DIMENSIONS,
        completed_at=datetime.datetime.utcnow().isoformat() + "Z"
    )

