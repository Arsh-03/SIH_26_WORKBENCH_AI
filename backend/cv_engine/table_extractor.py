import logging
import statistics
from pathlib import Path
from typing import List, Dict, Any, Optional

logger = logging.getLogger("table_extractor")

class TableExtractor:
    """
    Extracts structured tables from PDFs using pdfplumber (native vector/text extraction)
    with a conservative OCR-assisted fallback for scanned documents and images.
    """
    def extract_tables_from_pdf(
        self,
        pdf_path: str,
        page_number: int = 1,
        image_width: Optional[int] = None,
        image_height: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        tables_data: List[Dict[str, Any]] = []
        try:
            import pdfplumber
        except ImportError:
            logger.warning("pdfplumber is not installed. Skipping native tabular extraction.")
            return tables_data

        try:
            with pdfplumber.open(pdf_path) as pdf:
                if page_number < 1 or page_number > len(pdf.pages):
                    return tables_data

                page = pdf.pages[page_number - 1]
                pdf_w = float(page.width) if page.width else 1.0
                pdf_h = float(page.height) if page.height else 1.0

                scale_x = (float(image_width) / pdf_w) if image_width and pdf_w > 0 else 1.0
                scale_y = (float(image_height) / pdf_h) if image_height and pdf_h > 0 else 1.0

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
                        padded_row = row + [""] * (len(headers) - len(row))
                        md_lines.append("| " + " | ".join(padded_row[:len(headers)]) + " |")
                    markdown_str = "\n".join(md_lines)

                    # Estimate bounding box in scaled rendered pixel coordinates
                    default_h = int(image_height if image_height else page.height)
                    default_w = int(image_width if image_width else page.width)
                    bbox_2d = [0, 0, default_h, default_w]

                    if idx < len(page_tables):
                        t_bbox = page_tables[idx].bbox  # (x0, top, x1, bottom) in PDF points
                        ymin = int(round(t_bbox[1] * scale_y))
                        xmin = int(round(t_bbox[0] * scale_x))
                        ymax = int(round(t_bbox[3] * scale_y))
                        xmax = int(round(t_bbox[2] * scale_x))
                        bbox_2d = [ymin, xmin, ymax, xmax]

                    tables_data.append({
                        "table_id": f"tbl_{page_number}_{idx+1:02d}",
                        "bounding_box_2d": bbox_2d,
                        "headers": headers,
                        "rows": rows,
                        "markdown": markdown_str
                    })
        except Exception as e:
            logger.error(f"Error extracting native tables from PDF {pdf_path}: {e}")

        return tables_data

    def extract_tables_from_ocr(
        self,
        text_blocks: List[Dict[str, Any]],
        page_width: int,
        page_height: int,
        page_number: int = 1
    ) -> List[Dict[str, Any]]:
        """
        Conservative, deterministic OCR-assisted table extraction fallback.
        Uses center-Y row clustering and horizontal column grid alignment.
        Prefers false negatives over false positives.
        """
        if not text_blocks or len(text_blocks) < 4:
            return []

        # 1. Compute median block height for row tolerance
        heights = [
            b["bounding_box_2d"][2] - b["bounding_box_2d"][0]
            for b in text_blocks
            if (b["bounding_box_2d"][2] - b["bounding_box_2d"][0]) > 0
        ]
        if not heights:
            return []

        median_ocr_block_height = float(statistics.median(heights))
        row_tolerance = 0.5 * max(median_ocr_block_height, 1.0)

        # 2. Sort blocks vertically by Y-center
        sorted_blocks = sorted(
            text_blocks,
            key=lambda b: (b["bounding_box_2d"][0] + b["bounding_box_2d"][2]) / 2.0
        )

        # 3. Cluster blocks into rows using center_y distance
        rows_list: List[List[Dict[str, Any]]] = []
        for b in sorted_blocks:
            b_center_y = (b["bounding_box_2d"][0] + b["bounding_box_2d"][2]) / 2.0
            matched_row = None
            for row in rows_list:
                row_mean_center = sum(
                    (item["bounding_box_2d"][0] + item["bounding_box_2d"][2]) / 2.0
                    for item in row
                ) / float(len(row))
                if abs(b_center_y - row_mean_center) <= row_tolerance:
                    matched_row = row
                    break

            if matched_row is not None:
                matched_row.append(b)
            else:
                rows_list.append([b])

        # 4. Sort rows by top-to-bottom mean center_y, and blocks in each row left-to-right by xmin
        rows_list.sort(
            key=lambda row: sum((item["bounding_box_2d"][0] + item["bounding_box_2d"][2]) / 2.0 for item in row) / float(len(row))
        )
        for row in rows_list:
            row.sort(key=lambda b: b["bounding_box_2d"][1])

        # 5. Filter candidate multi-cell rows (>= 2 blocks)
        multi_cell_rows = [row for row in rows_list if len(row) >= 2]
        if len(multi_cell_rows) < 2:
            return []

        # 6. Conservative Prose / Paragraph Filter (prevent false positives for 2-column article prose)
        all_candidate_texts = [b["text"] for row in multi_cell_rows for b in row]
        avg_text_length = sum(len(t) for t in all_candidate_texts) / float(len(all_candidate_texts)) if all_candidate_texts else 0
        if avg_text_length > 60:
            # Likely prose sentences rather than tabular data cells
            return []

        block_widths = [
            (b["bounding_box_2d"][3] - b["bounding_box_2d"][1])
            for row in multi_cell_rows for b in row
        ]
        max_block_width = max(block_widths) if block_widths else 0
        if page_width > 0 and (max_block_width / float(page_width)) > 0.45:
            # Wide paragraph blocks indicate document prose, not structured tables
            return []

        # 7. Column Grid Alignment: Cluster xmin coordinates across multi-cell rows
        xmins = [b["bounding_box_2d"][1] for row in multi_cell_rows for b in row]
        if not xmins:
            return []

        xmins_sorted = sorted(xmins)
        col_tolerance = max(20.0, 0.03 * float(page_width)) if page_width > 0 else 20.0

        col_clusters: List[List[int]] = []
        for xm in xmins_sorted:
            matched_col = None
            for col in col_clusters:
                col_mean = sum(col) / float(len(col))
                if abs(xm - col_mean) <= col_tolerance:
                    matched_col = col
                    break
            if matched_col is not None:
                matched_col.append(xm)
            else:
                col_clusters.append([xm])

        col_centers = [sum(col) / float(len(col)) for col in col_clusters]
        col_centers.sort()

        if len(col_centers) < 2:
            return []

        # 8. Align row blocks to column grid and build matrix
        matrix_rows: List[List[str]] = []
        all_table_blocks: List[Dict[str, Any]] = []

        for row in multi_cell_rows:
            row_cells = [""] * len(col_centers)
            row_aligned_count = 0

            for block in row:
                bx_min = block["bounding_box_2d"][1]
                # Find closest column index
                best_col_idx = min(
                    range(len(col_centers)),
                    key=lambda idx: abs(bx_min - col_centers[idx])
                )
                if abs(bx_min - col_centers[best_col_idx]) <= col_tolerance * 1.5:
                    if row_cells[best_col_idx]:
                        row_cells[best_col_idx] += " " + block["text"]
                    else:
                        row_cells[best_col_idx] = block["text"]
                    row_aligned_count += 1
                    all_table_blocks.append(block)

            if row_aligned_count >= 2:
                matrix_rows.append(row_cells)

        # Conservative Validation: require at least 2 aligned rows and 2 columns
        if len(matrix_rows) < 2 or not all_table_blocks:
            return []

        clean_rows = [row for row in matrix_rows if any(row)]
        if len(clean_rows) < 2:
            return []

        headers = clean_rows[0]
        data_rows = clean_rows[1:]

        # 9. Markdown Table Generation
        md_lines = []
        md_lines.append("| " + " | ".join(headers) + " |")
        md_lines.append("| " + " | ".join(["---"] * len(headers)) + " |")
        for row in data_rows:
            padded_row = row + [""] * (len(headers) - len(row))
            md_lines.append("| " + " | ".join(padded_row[:len(headers)]) + " |")
        markdown_str = "\n".join(md_lines)

        # 10. Bounding Box Computation [ymin, xmin, ymax, xmax]
        ymin = min(b["bounding_box_2d"][0] for b in all_table_blocks)
        xmin = min(b["bounding_box_2d"][1] for b in all_table_blocks)
        ymax = max(b["bounding_box_2d"][2] for b in all_table_blocks)
        xmax = max(b["bounding_box_2d"][3] for b in all_table_blocks)
        bbox_2d = [ymin, xmin, ymax, xmax]

        return [{
            "table_id": f"tbl_{page_number}_01",
            "bounding_box_2d": bbox_2d,
            "headers": headers,
            "rows": data_rows,
            "markdown": markdown_str
        }]
