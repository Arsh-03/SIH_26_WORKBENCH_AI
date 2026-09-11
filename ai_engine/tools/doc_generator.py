import docx
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
import os
import re
from typing import List, Dict, Any, Optional

def generate_docx_document(
    title: str,
    content: str,
    citations: Optional[List[Dict[str, Any]]] = None,
    output_dir: str = "./backend/storage/artifacts",
    author_name: str = "Lead AI Architect",
    author_title: str = "Lead Operations Engineer"
) -> Dict[str, str]:
    """
    Builds a professional, styled Microsoft Word (.docx) document from Markdown text
    and returns document filepath and download URL.
    """
    os.makedirs(output_dir, exist_ok=True)
    doc = docx.Document()

    # Pre-process placeholder brackets e.g. [Your Name], [Insert Date] with real date and user profile
    from datetime import datetime
    today_str = datetime.now().strftime("%B %d, %Y")
    content = re.sub(r'\[(?:Insert|Your)?\s*(?:Name|Author|Inspector Name)[^\]]*\]', author_name, content, flags=re.IGNORECASE)
    content = re.sub(r'\[(?:Insert|Your)?\s*(?:Title)[^\]]*\]', author_title, content, flags=re.IGNORECASE)
    content = re.sub(r'\[(?:Insert|Your)?\s*(?:Current\s+Date|Date|Today)[^\]]*\]', today_str, content, flags=re.IGNORECASE)
    content = re.sub(r'\[(?:Insert|Your)?\s*(?:Time)[^\]]*\]', "09:00 AM", content, flags=re.IGNORECASE)

    # Document Header / Title
    title_p = doc.add_paragraph()
    title_run = title_p.add_run(title.strip())
    title_run.font.name = "Arial"
    title_run.font.size = Pt(20)
    title_run.font.bold = True
    title_run.font.color.rgb = RGBColor(0x1F, 0x29, 0x37) # Dark slate
    title_p.paragraph_format.space_after = Pt(12)

    # Parse lines into styled headings, code blocks, metadata fields, bullets, and body paragraphs
    lines = content.strip().split("\n")
    in_code_block = False

    for line in lines:
        line_str = line.rstrip()
        
        # Check code fence delimiter
        if line_str.strip().startswith("```"):
            in_code_block = not in_code_block
            continue

        if in_code_block:
            p = doc.add_paragraph()
            run = p.add_run(line_str)
            run.font.name = "Consolas"
            run.font.size = Pt(9.5)
            run.font.color.rgb = RGBColor(0x1E, 0x29, 0x3B)
            p.paragraph_format.space_after = Pt(1)
            p.paragraph_format.space_before = Pt(0)
            p.paragraph_format.left_indent = Inches(0.25)
            continue

        if not line_str.strip():
            continue

        # Heading 1 (# Heading)
        if line_str.strip().startswith("# "):
            h_text = line_str.strip()[2:].strip()
            h = doc.add_heading(h_text, level=1)
            h.style.font.name = "Arial"
            h.style.font.color.rgb = RGBColor(0xD9, 0x77, 0x06) # Amber theme accent
            continue

        # Heading 2 (## Heading)
        if line_str.strip().startswith("## "):
            h_text = line_str.strip()[3:].strip()
            h = doc.add_heading(h_text, level=2)
            h.style.font.name = "Arial"
            h.style.font.color.rgb = RGBColor(0x37, 0x41, 0x51)
            continue

        # Heading 3 (### Heading)
        if line_str.strip().startswith("### "):
            h_text = line_str.strip()[4:].strip()
            h = doc.add_heading(h_text, level=3)
            h.style.font.name = "Arial"
            continue

        # Key-Value metadata lines (e.g. **Subject:** ..., **To:** ..., **From:** ...)
        if ":" in line_str and any(line_str.strip().lower().startswith(kw) for kw in ["subject", "to", "from", "date", "memo", "re:"]):
            p = doc.add_paragraph()
            parts = line_str.strip().split(":", 1)
            k_run = p.add_run(parts[0].replace("**", "").replace("*", "").strip() + ": ")
            k_run.font.bold = True
            k_run.font.size = Pt(11)
            v_run = p.add_run(parts[1].replace("**", "").replace("*", "").strip())
            v_run.font.size = Pt(11)
            p.paragraph_format.space_after = Pt(4)
            continue

        # Bullet List Items (* or - or numbered)
        bullet_match = re.match(r"^[\*\-\•\d+\.]\s+(.*)", line_str.strip())
        if bullet_match:
            item_text = bullet_match.group(1).replace("**", "").replace("*", "").strip()
            p = doc.add_paragraph(style='List Bullet')
            run = p.add_run(item_text)
            run.font.name = "Calibri"
            run.font.size = Pt(11)
            p.paragraph_format.space_after = Pt(3)
            continue

        # Standard Body Paragraph
        p = doc.add_paragraph()
        clean_text = line_str.strip().replace("**", "").replace("*", "")
        run = p.add_run(clean_text)
        run.font.name = "Calibri"
        run.font.size = Pt(11)
        p.paragraph_format.space_after = Pt(6)

    # Append Regulatory & SOP Citations Table if available
    if citations and len(citations) > 0:
        doc.add_heading("Regulatory & SOP References", level=2)
        table = doc.add_table(rows=1, cols=3)
        table.style = 'Table Grid'
        hdr_cells = table.rows[0].cells
        hdr_cells[0].text = 'Document Ref'
        hdr_cells[1].text = 'Page'
        hdr_cells[2].text = 'Citation Snippet'
        for cell in hdr_cells:
            for p in cell.paragraphs:
                for r in p.runs:
                    r.font.bold = True

        for cite in citations:
            row_cells = table.add_row().cells
            row_cells[0].text = str(cite.get("document_id", "Doc Ref"))
            row_cells[1].text = str(cite.get("page_number", "1"))
            row_cells[2].text = str(cite.get("snippet", "N/A"))

    clean_filename = re.sub(r'[^a-zA-Z0-9_\-]', '_', title.replace(" ", "_"))
    if not clean_filename.endswith(".docx"):
        filename = f"{clean_filename}_Document.docx"
    else:
        filename = clean_filename

    file_path = os.path.join(output_dir, filename)
    doc.save(file_path)

    return {
        "file_path": file_path,
        "filename": filename,
        "download_url": f"/api/v1/artifacts/download/{filename}"
    }

def generate_approval_memo(
    title: str,
    findings: str,
    action_required: str,
    citations: List[Dict[str, Any]] = None,
    output_dir: str = "./artifacts"
) -> str:
    res = generate_docx_document(
        title=title,
        content=f"## Operational Findings\n{findings}\n\n## Mandatory Action Directive\n{action_required}",
        citations=citations,
        output_dir=output_dir
    )
    return res["file_path"]
