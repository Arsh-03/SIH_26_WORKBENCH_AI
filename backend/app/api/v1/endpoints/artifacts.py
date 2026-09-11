import os
from pathlib import Path
from typing import Optional
from fastapi import APIRouter, HTTPException, status, Query
from fastapi.responses import FileResponse
from backend.app.config import settings
from backend.app.core.security import sanitize_filename
from backend.app.models.schemas import (
    DocumentCompileRequest,
    DocumentCompileResponse,
    SessionBundleResponse
)
from ai_engine.tools.multi_format_doc_generator import (
    generate_pdf_document,
    generate_docx_document,
    generate_latex_document,
    generate_html_document,
    compile_document_all_formats
)
from ai_engine.templates.presets import list_presets, get_preset_template
from backend.app.services.project_bundler import export_session_bundle

router = APIRouter()

@router.get("/presets")
async def get_document_presets():
    """
    Returns available formal technical document presets (IEEE-830, Post-Mortem RCA, SOP, Executive Brief).
    """
    return {
        "presets": list_presets()
    }

@router.post("/compile", response_model=DocumentCompileResponse)
async def compile_document(payload: DocumentCompileRequest):
    """
    Compiles markdown content or technical specifications into PDF, DOCX, LaTeX (.tex), or standalone HTML.
    """
    target_format = payload.format.lower().strip()
    out_dir = settings.ARTIFACTS_DIR

    try:
        if target_format == "pdf":
            res = generate_pdf_document(
                title=payload.title,
                markdown_content=payload.content,
                author_name=payload.author_name or "Lead AI Architect",
                author_title=payload.author_title or "Lead Operations Engineer",
                output_dir=out_dir,
                citations=payload.citations
            )
            return DocumentCompileResponse(
                title=payload.title,
                format="pdf",
                filename=res["filename"],
                download_url=res["download_url"],
                file_path=res["file_path"]
            )
        elif target_format in ["docx", "doc", "word"]:
            res = generate_docx_document(
                title=payload.title,
                content=payload.content,
                citations=payload.citations,
                output_dir=out_dir,
                author_name=payload.author_name or "Lead AI Architect",
                author_title=payload.author_title or "Lead Operations Engineer"
            )
            return DocumentCompileResponse(
                title=payload.title,
                format="docx",
                filename=res["filename"],
                download_url=res["download_url"],
                file_path=res["file_path"]
            )
        elif target_format in ["latex", "tex"]:
            res = generate_latex_document(
                title=payload.title,
                markdown_content=payload.content,
                author_name=payload.author_name or "Lead AI Architect",
                author_title=payload.author_title or "Lead Operations Engineer",
                output_dir=out_dir,
                citations=payload.citations
            )
            return DocumentCompileResponse(
                title=payload.title,
                format="latex",
                filename=res["filename"],
                download_url=res["download_url"],
                file_path=res["file_path"]
            )
        elif target_format in ["html", "web"]:
            res = generate_html_document(
                title=payload.title,
                markdown_content=payload.content,
                author_name=payload.author_name or "Lead AI Architect",
                author_title=payload.author_title or "Lead Operations Engineer",
                output_dir=out_dir,
                citations=payload.citations
            )
            return DocumentCompileResponse(
                title=payload.title,
                format="html",
                filename=res["filename"],
                download_url=res["download_url"],
                file_path=res["file_path"]
            )
        elif target_format == "all":
            all_res = compile_document_all_formats(
                title=payload.title,
                markdown_content=payload.content,
                author_name=payload.author_name or "Lead AI Architect",
                author_title=payload.author_title or "Lead Operations Engineer",
                output_dir=out_dir,
                citations=payload.citations
            )
            return DocumentCompileResponse(
                title=payload.title,
                format="all",
                formats=all_res["formats"]
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported document format '{payload.format}'. Supported: pdf, docx, latex, html, all."
            )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Document compilation failed: {str(e)}"
        )

@router.get("/export-bundle/{session_id}")
async def export_bundle(
    session_id: str,
    direct_download: bool = Query(True, description="Stream .zip file directly as attachment")
):
    """
    Creates an air-gapped cryptographic .zip archive containing all code, documents,
    PDFs, and SHA-256 integrity manifest for a session.
    """
    try:
        zip_path = await export_session_bundle(session_id=session_id, output_dir=settings.ARTIFACTS_DIR)
        zip_filename = os.path.basename(zip_path)

        if direct_download:
            return FileResponse(
                path=zip_path,
                media_type="application/zip",
                filename=zip_filename
            )

        return SessionBundleResponse(
            session_id=session_id,
            zip_filename=zip_filename,
            download_url=f"/api/v1/artifacts/download/{zip_filename}",
            file_path=zip_path
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Session bundle export failed: {str(e)}"
        )

@router.get("/download/{filename}")
async def download_artifact(filename: str):
    """
    Download generated sandbox artifacts, compiled documents (.pdf, .docx, .tex, .html), and session archives (.zip).
    """
    clean_name = sanitize_filename(filename)
    filepath = Path(settings.ARTIFACTS_DIR) / clean_name

    if not filepath.exists() or not filepath.is_file():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Artifact '{clean_name}' not found."
        )

    # Determine media type
    media_type = "application/octet-stream"
    if clean_name.endswith(".png"):
        media_type = "image/png"
    elif clean_name.endswith(".jpg") or clean_name.endswith(".jpeg"):
        media_type = "image/jpeg"
    elif clean_name.endswith(".csv"):
        media_type = "text/csv"
    elif clean_name.endswith(".pdf"):
        media_type = "application/pdf"
    elif clean_name.endswith(".docx"):
        media_type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    elif clean_name.endswith(".tex"):
        media_type = "application/x-latex"
    elif clean_name.endswith(".html"):
        media_type = "text/html"
    elif clean_name.endswith(".zip"):
        media_type = "application/zip"
    elif clean_name.endswith(".json"):
        media_type = "application/json"

    return FileResponse(
        path=str(filepath),
        media_type=media_type,
        filename=clean_name
    )
