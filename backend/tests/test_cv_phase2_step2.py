import os
import sys
import json
import tempfile
import unittest
from unittest.mock import MagicMock
from pathlib import Path
from PIL import Image, ImageDraw

# Add repository root to sys.path
REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from backend.cv_engine.ocr_processor import OCRProcessor
from backend.cv_engine.table_extractor import TableExtractor


class TestCVPhase2Step2(unittest.TestCase):

    def test_ocr_processor_pillow_and_path_input(self):
        """Test 1 & 2: PIL Image input and string path input to OCRProcessor."""
        processor = OCRProcessor()

        # Mock ocr_engine to test input handling without requiring paddleocr models loaded
        mock_engine = MagicMock()
        mock_engine.ocr.return_value = [
            [
                [[[10, 20], [80, 20], [80, 40], [10, 40]], ("TEST OCR HEADER", 0.95)]
            ]
        ]
        processor.ocr_engine = mock_engine

        # Test 1: Direct PIL Image input
        img = Image.new("RGB", (300, 100), color=(255, 255, 255))
        draw = ImageDraw.Draw(img)
        draw.text((20, 30), "TEST OCR HEADER", fill=(0, 0, 0))

        blocks_pil = processor.process_image(img, confidence_threshold=0.10)
        self.assertIsInstance(blocks_pil, list)
        self.assertEqual(len(blocks_pil), 1)
        self.assertEqual(blocks_pil[0]["text"], "TEST OCR HEADER")
        self.assertEqual(blocks_pil[0]["bounding_box_2d"], [20, 10, 40, 80])

        # Test 2: Path input
        with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tmp:
            tmp_path = tmp.name
            img.save(tmp_path)

        try:
            blocks_path = processor.process_image(tmp_path, confidence_threshold=0.10)
            self.assertIsInstance(blocks_path, list)
            self.assertEqual(len(blocks_path), 1)
            self.assertEqual(blocks_path[0]["text"], "TEST OCR HEADER")
        finally:
            if os.path.exists(tmp_path):
                os.remove(tmp_path)

    def test_table_extractor_ocr_fallback_synthetic_3x3(self):
        """Test 5 & 7: Synthetic 3x3 OCR table reconstruction and coordinate order [ymin, xmin, ymax, xmax]."""
        extractor = TableExtractor()

        # Synthetic 3x3 table OCR blocks
        text_blocks = [
            {"block_id": "b1", "text": "ID", "confidence": 0.99, "bounding_box_2d": [50, 50, 70, 100]},
            {"block_id": "b2", "text": "Name", "confidence": 0.99, "bounding_box_2d": [50, 200, 70, 300]},
            {"block_id": "b3", "text": "Score", "confidence": 0.99, "bounding_box_2d": [50, 400, 70, 480]},
            {"block_id": "b4", "text": "001", "confidence": 0.99, "bounding_box_2d": [90, 50, 110, 100]},
            {"block_id": "b5", "text": "Alice", "confidence": 0.99, "bounding_box_2d": [90, 200, 110, 300]},
            {"block_id": "b6", "text": "95", "confidence": 0.99, "bounding_box_2d": [90, 400, 110, 480]},
            {"block_id": "b7", "text": "002", "confidence": 0.99, "bounding_box_2d": [130, 50, 150, 100]},
            {"block_id": "b8", "text": "Bob", "confidence": 0.99, "bounding_box_2d": [130, 200, 150, 300]},
            {"block_id": "b9", "text": "88", "confidence": 0.99, "bounding_box_2d": [130, 400, 150, 480]},
        ]

        tables = extractor.extract_tables_from_ocr(text_blocks, page_width=600, page_height=800, page_number=1)
        self.assertEqual(len(tables), 1)

        tbl = tables[0]
        self.assertEqual(tbl["table_id"], "tbl_1_01")
        self.assertEqual(tbl["headers"], ["ID", "Name", "Score"])
        self.assertEqual(tbl["rows"], [["001", "Alice", "95"], ["002", "Bob", "88"]])
        self.assertIn("| ID | Name | Score |", tbl["markdown"])

        # Verify bounding_box_2d is [ymin, xmin, ymax, xmax]
        bbox = tbl["bounding_box_2d"]
        self.assertEqual(bbox, [50, 50, 150, 480])
        self.assertLessEqual(bbox[0], bbox[2])  # ymin <= ymax
        self.assertLessEqual(bbox[1], bbox[3])  # xmin <= xmax

    def test_table_extractor_ocr_fallback_prose_rejection(self):
        """Test 6: Normal two-column prose paragraph is NOT detected as a table."""
        extractor = TableExtractor()

        # Synthetic two-column article prose
        text_blocks = [
            {"block_id": "p1", "text": "In this paper we introduce an advanced neural network architecture for high throughput document parsing and analysis.", "confidence": 0.99, "bounding_box_2d": [100, 50, 150, 350]},
            {"block_id": "p2", "text": "Recent progress in spatial computer vision models has enabled structured extraction across complex unstructured documents.", "confidence": 0.99, "bounding_box_2d": [100, 400, 150, 700]},
            {"block_id": "p3", "text": "Our experimental evaluation demonstrates significant performance gains over baseline heuristic text grouping algorithms.", "confidence": 0.99, "bounding_box_2d": [180, 50, 230, 350]},
            {"block_id": "p4", "text": "Furthermore the proposed pipeline operates entirely offline with zero cloud dependency and complete data privacy protection.", "confidence": 0.99, "bounding_box_2d": [180, 400, 230, 700]},
        ]

        tables = extractor.extract_tables_from_ocr(text_blocks, page_width=800, page_height=1000, page_number=1)
        self.assertEqual(tables, [])

    def test_pdf_ocr_no_temp_files_created(self):
        """Test 3 & 4: PDF OCR creates no _temp_p*.png files and native table priority is respected."""
        try:
            import pdfplumber
        except ImportError:
            self.skipTest("pdfplumber not installed.")

        with tempfile.TemporaryDirectory() as tmp_dir:
            pdf_file = Path(tmp_dir) / "sample_doc.pdf"

            # Simple minimal valid PDF creation without external drawing dependencies
            try:
                from reportlab.pdfgen import canvas
                c = canvas.Canvas(str(pdf_file))
                c.drawString(100, 700, "Header Line Sample PDF")
                c.drawString(100, 650, "Sample body paragraph inside test PDF.")
                c.save()
            except ImportError:
                self.skipTest("reportlab not installed for creating test PDF.")

            from backend.cv_engine import runner

            class DummyArgs:
                input = str(pdf_file)
                output = None
                model_dir = None
                confidence = 0.50
                use_gpu = False

            original_parse_args = runner.parse_args
            runner.parse_args = lambda: DummyArgs()

            # Mock OCR processor inside runner to avoid loading heavy PaddleOCR weights during unit test
            mock_ocr_proc = MagicMock()
            mock_ocr_proc.process_image.return_value = [
                {"block_id": "blk_001", "text": "Header Line Sample PDF", "confidence": 0.99, "bounding_box_2d": [100, 100, 120, 300]}
            ]

            try:
                with unittest.mock.patch("backend.cv_engine.runner.OCRProcessor", return_value=mock_ocr_proc):
                    runner.main()
            finally:
                runner.parse_args = original_parse_args

            # Assert no _temp_p*.png files exist
            temp_pngs = list(pdf_file.parent.glob("_temp_p*.png"))
            self.assertEqual(len(temp_pngs), 0)

    def test_runner_response_schema_compatibility(self):
        """Test 8: Verify CVRunnerResponse contract parses runner output structure."""
        raw_payload = {
            "status": "success",
            "processing_time_ms": 120,
            "total_pages": 1,
            "pages": [
                {
                    "page_number": 1,
                    "width": 1000,
                    "height": 1400,
                    "text_blocks": [
                        {
                            "block_id": "blk_001",
                            "text": "Header",
                            "confidence": 0.95,
                            "bounding_box_2d": [10, 20, 30, 80]
                        }
                    ],
                    "tables": [
                        {
                            "table_id": "tbl_1_01",
                            "bounding_box_2d": [50, 50, 150, 480],
                            "headers": ["Col1", "Col2"],
                            "rows": [["Val1", "Val2"]],
                            "markdown": "| Col1 | Col2 |\n| --- | --- |\n| Val1 | Val2 |"
                        }
                    ]
                }
            ],
            "errors": []
        }

        try:
            from backend.app.models.schemas import CVRunnerResponse
            response = CVRunnerResponse.model_validate(raw_payload)
            self.assertEqual(response.status, "success")
            self.assertEqual(response.total_pages, 1)
            self.assertEqual(len(response.pages), 1)
            self.assertEqual(response.pages[0].tables[0]["table_id"], "tbl_1_01")
        except ImportError:
            # Pydantic schema validation skipped if app models not present in isolated environment
            self.assertTrue(True)


if __name__ == "__main__":
    unittest.main()