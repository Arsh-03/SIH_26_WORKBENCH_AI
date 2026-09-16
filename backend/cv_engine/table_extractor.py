import logging
from pathlib import Path
from typing import List, Dict, Any, Optional

logger = logging.getLogger("table_extractor")

class TableExtractor:
    """
    Extracts structured tables from PDFs using pdfplumber,
    formatting headers, rows, markdown table representations, and bounding boxes.
    """
    def extract_tables_from_pdf(
        self,
        pdf_path: str,
        page_number: int = 1
    ) -> List[Dict[str, Any]]:
        tables_data: List[Dict[str, Any]] = []
        try:
            import pdfplumber
        except ImportError:
            logger.warning("pdfplumber is not installed. Skipping tabular extraction.")
            return tables_data

        try:
            with pdfplumber.open(pdf_path) as pdf:
                if page_number < 1 or page_number > len(pdf.pages):
                    return tables_data

                page = pdf.pages[page_number - 1]
                extracted_tables = page.extract_tables()
                page_tables = page.find_tables()

                for idx, table_content in enumerate(extracted_tables):
                    if not table_content:
                        continue

                    # Filter out empty rows/cols
                    clean_rows = [[cell.strip() if cell else "" for cell in row] for row in table_content]
                    clean_rows = [row for row in clean_rows if any(row)]

                    if not clean_rows:
                        continue

                    headers = clean_rows[0]
                    rows = clean_rows[1:] if len(clean_rows) > 1 else []

                    # Build Markdown Table representation
                    md_lines = []
                    md_lines.append("| " + " | ".join(headers) + " |")
                    md_lines.append("| " + " | ".join(["---"] * len(headers)) + " |")
                    for row in rows:
                        # Ensure row length matches headers
                        padded_row = row + [""] * (len(headers) - len(row))
                        md_lines.append("| " + " | ".join(padded_row[:len(headers)]) + " |")
                    markdown_str = "\n".join(md_lines)

                    # Estimate bounding box if page table metadata available
                    bbox_2d = [0, 0, int(page.height), int(page.width)]
                    if idx < len(page_tables):
                        t_bbox = page_tables[idx].bbox  # (x0, top, x1, bottom)
                        bbox_2d = [int(t_bbox[1]), int(t_bbox[0]), int(t_bbox[3]), int(t_bbox[2])]

                    tables_data.append({
                        "table_id": f"tbl_{page_number}_{idx+1:02d}",
                        "bounding_box_2d": bbox_2d,
                        "headers": headers,
                        "rows": rows,
                        "markdown": markdown_str
                    })
        except Exception as e:
            logger.error(f"Error extracting tables from PDF {pdf_path}: {e}")

        return tables_data
