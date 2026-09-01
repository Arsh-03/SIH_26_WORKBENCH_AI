import docx
import os
from typing import List, Dict, Any

def generate_approval_memo(
    title: str,
    findings: str,
    action_required: str,
    citations: List[Dict[str, Any]] = None,
    output_dir: str = "./artifacts"
) -> str:
    os.makedirs(output_dir, exist_ok=True)
    doc = docx.Document()
    doc.add_heading(f"INTERNAL MEMORANDUM: {title.upper()}", level=1)
    doc.add_heading("1. Operational Findings", level=2)
    doc.add_paragraph(findings)
    doc.add_heading("2. Mandatory Action Directive", level=2)
    doc.add_paragraph(action_required)

    if citations:
        doc.add_heading("3. Regulatory & SOP References", level=2)
        for cite in citations:
            snippet = cite.get("snippet", "N/A")
            doc_id = cite.get("document_id", "Unknown Doc")
            page = cite.get("page_number", "N/A")
            doc.add_paragraph(f"• {snippet} (Ref: {doc_id}, Page {page})")

    file_path = os.path.join(output_dir, f"{title.replace(' ', '_')}_Approval_Note.docx")
    doc.save(file_path)
    return file_path
