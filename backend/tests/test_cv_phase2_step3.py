import os
import sys
import json
import asyncio
import tempfile
import unittest
from unittest.mock import MagicMock, AsyncMock, patch
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from backend.cv_engine.ocr_processor import OCRProcessor
from backend.cv_engine.table_extractor import TableExtractor
from backend.app.services.ingestion_service import DocumentIngestionService
from backend.app.services.vector_store import VectorStoreService
from backend.app.models.sql_models import DocumentChunk
from backend.app.models.schemas import CVRunnerResponse, CVPageResult, CVTextBlock


class TestCVPhase2Step3(unittest.TestCase):

    def test_multi_block_union_bbox_calculation(self):
        """Test B: Multi-block union bbox envelope min/max calculation."""
        # Block 1: [100, 50, 120, 200]
        # Block 2: [130, 80, 160, 350]
        # Block 3: [90, 40, 110, 180]
        # Expected union bbox: min ymin=90, min xmin=40, max ymax=160, max xmax=350 -> [90, 40, 160, 350]
        blocks = [
            CVTextBlock(block_id="b1", text="Line 1 text", confidence=0.95, bounding_box_2d=[100, 50, 120, 200]),
            CVTextBlock(block_id="b2", text="Line 2 text", confidence=0.98, bounding_box_2d=[130, 80, 160, 350]),
            CVTextBlock(block_id="b3", text="Header text", confidence=0.99, bounding_box_2d=[90, 40, 110, 180]),
        ]

        ymins = [b.bounding_box_2d[0] for b in blocks]
        xmins = [b.bounding_box_2d[1] for b in blocks]
        ymaxs = [b.bounding_box_2d[2] for b in blocks]
        xmaxs = [b.bounding_box_2d[3] for b in blocks]

        union_bbox = [min(ymins), min(xmins), max(ymaxs), max(xmaxs)]
        self.assertEqual(union_bbox, [90, 40, 160, 350])

    def test_cv_ingestion_preserves_spatial_metadata(self):
        """Test A & C: CV ingestion preserves OCR block and table spatial metadata."""
        service = DocumentIngestionService()

        # Mock CV runner response
        mock_cv_response = CVRunnerResponse(
            status="success",
            processing_time_ms=100,
            total_pages=1,
            pages=[
                CVPageResult(
                    page_number=1,
                    width=1200,
                    height=1600,
                    text_blocks=[
                        CVTextBlock(block_id="blk_001", text="Pressure Vessel Specification", confidence=0.99, bounding_box_2d=[50, 100, 80, 500]),
                        CVTextBlock(block_id="blk_002", text="MAWP: 160 bar at 350C", confidence=0.97, bounding_box_2d=[100, 100, 120, 400]),
                    ],
                    tables=[
                        {
                            "table_id": "tbl_1_01",
                            "bounding_box_2d": [200, 100, 400, 800],
                            "headers": ["Param", "Value"],
                            "rows": [["MAWP", "160 bar"]],
                            "markdown": "| Param | Value |\n| --- | --- |\n| MAWP | 160 bar |"
                        }
                    ]
                )
            ],
            errors=[]
        )

        with patch("backend.app.services.ingestion_service.cv_client.run_cv_runner", new=AsyncMock(return_value=mock_cv_response)):
            chunks, total_pages = asyncio.run(service._process_via_cv_client("dummy_image.png"))

        self.assertEqual(total_pages, 1)
        self.assertEqual(len(chunks), 2)  # 1 text chunk + 1 table chunk

        # Verify text chunk spatial metadata
        text_chunk = chunks[0]
        self.assertEqual(text_chunk["page_number"], 1)
        self.assertIn("Pressure Vessel Specification", text_chunk["content"])
        self.assertTrue(text_chunk["spatial_metadata"]["has_spatial"])
        self.assertEqual(text_chunk["spatial_metadata"]["bounding_box_2d"], [50, 100, 120, 500])
        self.assertEqual(text_chunk["spatial_metadata"]["page_width"], 1200)
        self.assertEqual(text_chunk["spatial_metadata"]["page_height"], 1600)
        self.assertEqual(text_chunk["spatial_metadata"]["block_ids"], ["blk_001", "blk_002"])

        # Verify table chunk spatial metadata
        table_chunk = chunks[1]
        self.assertEqual(table_chunk["page_number"], 1)
        self.assertIn("### Extracted Table (tbl_1_01)", table_chunk["content"])
        self.assertTrue(table_chunk["spatial_metadata"]["has_spatial"])
        self.assertEqual(table_chunk["spatial_metadata"]["bounding_box_2d"], [200, 100, 400, 800])
        self.assertEqual(table_chunk["spatial_metadata"]["table_ids"], ["tbl_1_01"])

    def test_chromadb_and_sqlite_spatial_serialization(self):
        """Test D: ChromaDB receives primitive metadata and SQLite receives spatial_metadata JSON."""
        service = DocumentIngestionService()

        # Mock dependencies for process_and_index_document
        mock_chunks = [
            {
                "page_number": 1,
                "content": "Sample OCR spatially-aware text",
                "spatial_metadata": {
                    "bounding_box_2d": [50, 100, 120, 500],
                    "page_width": 1200,
                    "page_height": 1600,
                    "block_ids": ["blk_001"],
                    "table_ids": [],
                    "has_spatial": True
                }
            }
        ]

        mock_db = MagicMock()
        mock_db.commit = AsyncMock()
        mock_db.get = AsyncMock(return_value=MagicMock())

        with patch.object(service, "extract_text_and_chunks_from_file", new=AsyncMock(return_value=(mock_chunks, 1))), \
             patch("backend.app.services.ingestion_service.ollama_client.get_embedding", new=AsyncMock(return_value=[0.1] * 768)), \
             patch("backend.app.services.ingestion_service.vector_store_service.add_chunks") as mock_add_chunks:

            count = asyncio.run(service.process_and_index_document(
                document_id="doc_test_01",
                workspace_id="ws_test_01",
                filepath="dummy_path.png",
                filename="dummy_path.png",
                file_type="png",
                db=mock_db
            ))

        self.assertEqual(count, 1)

        # Verify ChromaDB metadata arguments
        mock_add_chunks.assert_called_once()
        call_kwargs = mock_add_chunks.call_args[1]
        chroma_metadata = call_kwargs["metadatas"][0]

        self.assertTrue(chroma_metadata["has_spatial"])
        self.assertEqual(chroma_metadata["spatial_bbox"], "[50, 100, 120, 500]")
        self.assertEqual(chroma_metadata["page_width"], 1200)
        self.assertEqual(chroma_metadata["page_height"], 1600)

        # Verify SQLite DocumentChunk serialization
        added_chunk = mock_db.add.call_args_list[0][0][0]
        self.assertIsInstance(added_chunk, DocumentChunk)
        self.assertIsNotNone(added_chunk.spatial_metadata)
        parsed_spatial = json.loads(added_chunk.spatial_metadata)
        self.assertEqual(parsed_spatial["bounding_box_2d"], [50, 100, 120, 500])

    def test_text_only_ingestion_unaffected(self):
        """Test E: Plain text/MD ingestion leaves spatial_metadata NULL and has_spatial False."""
        service = DocumentIngestionService()
        chunks = service.chunk_text("Section 1: MAWP rating is 160 bar.", page_number=1)

        self.assertEqual(len(chunks), 1)
        self.assertNotIn("spatial_metadata", chunks[0])

        mock_db = MagicMock()
        mock_db.commit = AsyncMock()
        mock_db.get = AsyncMock(return_value=MagicMock())

        with patch.object(service, "extract_text_and_chunks_from_file", new=AsyncMock(return_value=(chunks, 1))), \
             patch("backend.app.services.ingestion_service.ollama_client.get_embedding", new=AsyncMock(return_value=[0.1] * 768)), \
             patch("backend.app.services.ingestion_service.vector_store_service.add_chunks") as mock_add_chunks:

            count = asyncio.run(service.process_and_index_document(
                document_id="doc_txt_01",
                workspace_id="ws_txt_01",
                filepath="plain.txt",
                filename="plain.txt",
                file_type="txt",
                db=mock_db
            ))

        self.assertEqual(count, 1)

        # Verify ChromaDB metadata has_spatial is False
        chroma_meta = mock_add_chunks.call_args[1]["metadatas"][0]
        self.assertFalse(chroma_meta["has_spatial"])
        self.assertNotIn("spatial_bbox", chroma_meta)

        # Verify SQLite DocumentChunk spatial_metadata is None
        added_chunk = mock_db.add.call_args_list[0][0][0]
        self.assertIsNone(added_chunk.spatial_metadata)

    def test_cv_fallback_graceful_degradation(self):
        """Test F: CV failure gracefully falls back to native PDF text extraction without crashing."""
        service = DocumentIngestionService()

        # Mock PyMuPDF to return native chunks
        mock_fitz_doc = MagicMock()
        mock_fitz_page = MagicMock()
        mock_fitz_page.get_text.return_value = "PyMuPDF Native Text Content for Fallback PDF"
        mock_fitz_doc.__len__.return_value = 1
        mock_fitz_doc.__getitem__.return_value = mock_fitz_page

        with patch("backend.app.services.ingestion_service.cv_client.run_cv_runner", new=AsyncMock(side_effect=RuntimeError("CV worker offline"))):
            with patch("pymupdf.open", return_value=mock_fitz_doc), patch("fitz.open", return_value=mock_fitz_doc):
                chunks, total_pages = asyncio.run(service.extract_text_and_chunks_from_file("scanned_sample.pdf", "pdf"))

        self.assertEqual(total_pages, 1)
        self.assertGreaterEqual(len(chunks), 1)
        self.assertIn("PyMuPDF Native Text Content", chunks[0]["content"])
        self.assertNotIn("spatial_metadata", chunks[0])


if __name__ == "__main__":
    unittest.main()
