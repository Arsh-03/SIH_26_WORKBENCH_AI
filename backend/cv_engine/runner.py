import os
import sys
import json
import time
import argparse
import logging
from pathlib import Path
from typing import Dict, Any, List

# Ensure repository root is in sys.path when running standalone or as a script
_REPO_ROOT = Path(__file__).resolve().parents[2]
if str(_REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(_REPO_ROOT))

try:
    from backend.cv_engine.ocr_processor import OCRProcessor
    from backend.cv_engine.table_extractor import TableExtractor
except ModuleNotFoundError:
    from ocr_processor import OCRProcessor  # type: ignore
    from table_extractor import TableExtractor  # type: ignore


logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("cv_runner")

def parse_args():
    parser = argparse.ArgumentParser(description="SIH26117 Computer Vision & Document Processing Runner")
    parser.add_argument("--input", required=True, help="Path to input image or PDF document")
    parser.add_argument("--output", help="Optional path to write output JSON response")
    parser.add_argument("--model-dir", help="Path to offline PaddleOCR model weights directory")
    parser.add_argument("--confidence", type=float, default=0.50, help="Confidence threshold (default: 0.50)")
    parser.add_argument("--use-gpu", action="store_true", help="Enable GPU acceleration if available")
    return parser.parse_args()

def get_image_dimensions(image_path: str) -> tuple[int, int]:
    """Get (width, height) of an image file."""
    try:
        from PIL import Image
        with Image.open(image_path) as img:
            return img.width, img.height
    except Exception:
        return 1920, 1080

def main():
    start_time = time.perf_counter()
    args = parse_args()

    input_path = Path(args.input).resolve()
    errors: List[str] = []

    if not input_path.exists():
        payload = {
            "status": "error",
            "processing_time_ms": int((time.perf_counter() - start_time) * 1000),
            "total_pages": 0,
            "pages": [],
            "errors": [f"Input file not found: {args.input}"]
        }
        print(json.dumps(payload, indent=2))
        sys.exit(1)

    ocr_processor = OCRProcessor(model_dir=args.model_dir, use_gpu=args.use_gpu)
    table_extractor = TableExtractor()

    file_ext = input_path.suffix.lower()
    pages_output: List[Dict[str, Any]] = []

    try:
        if file_ext == ".pdf":
            # PDF Processing
            try:
                import pdfplumber
                with pdfplumber.open(str(input_path)) as pdf:
                    total_pages = len(pdf.pages)
                    for page_idx, page in enumerate(pdf.pages):
                        p_num = page_idx + 1

                        # Render page image in memory for PaddleOCR
                        page_img_obj = page.to_image(resolution=150)
                        pil_img = page_img_obj.original.convert("RGB")
                        p_w, p_h = pil_img.width, pil_img.height

                        text_blocks = ocr_processor.process_image(
                            pil_img,
                            confidence_threshold=args.confidence
                        )

                        # Native pdfplumber table extraction with pixel scaling
                        tables = table_extractor.extract_tables_from_pdf(
                            str(input_path),
                            page_number=p_num,
                            image_width=p_w,
                            image_height=p_h
                        )

                        # Fallback to conservative OCR table reconstruction if zero native tables found
                        if not tables and text_blocks:
                            tables = table_extractor.extract_tables_from_ocr(
                                text_blocks=text_blocks,
                                page_width=p_w,
                                page_height=p_h,
                                page_number=p_num
                            )

                        pages_output.append({
                            "page_number": p_num,
                            "width": p_w,
                            "height": p_h,
                            "text_blocks": text_blocks,
                            "tables": tables
                        })
            except Exception as e:
                errors.append(f"PDF processing error: {str(e)}")
                total_pages = 1
        else:
            # Single Image Processing
            total_pages = 1
            width, height = get_image_dimensions(str(input_path))
            text_blocks = ocr_processor.process_image(
                str(input_path),
                confidence_threshold=args.confidence
            )

            # OCR table reconstruction for image inputs
            tables = table_extractor.extract_tables_from_ocr(
                text_blocks=text_blocks,
                page_width=width,
                page_height=height,
                page_number=1
            )

            pages_output.append({
                "page_number": 1,
                "width": width,
                "height": height,
                "text_blocks": text_blocks,
                "tables": tables
            })

    except Exception as e:
        errors.append(f"Execution error: {str(e)}")

    processing_time_ms = int((time.perf_counter() - start_time) * 1000)
    status = "error" if errors and not pages_output else "success"

    output_payload = {
        "status": status,
        "processing_time_ms": processing_time_ms,
        "total_pages": total_pages if 'total_pages' in locals() else len(pages_output),
        "pages": pages_output,
        "errors": errors
    }

    json_str = json.dumps(output_payload, indent=2)

    if args.output:
        out_path = Path(args.output).resolve()
        out_path.parent.mkdir(parents=True, exist_ok=True)
        with open(out_path, "w", encoding="utf-8") as f:
            f.write(json_str)
        logger.info(f"Wrote CV analysis payload to {out_path}")

    # Also output to stdout for direct capture
    print(json_str)

if __name__ == "__main__":
    main()
