import json
import unittest
from unittest.mock import AsyncMock, MagicMock, patch

from backend.app.models.schemas import (
    CVRunnerResponse,
    CVPageResult,
    CVTextBlock,
    NormalizedDocument,
    StructuredDocumentPage,
    ChunkCitation,
    ImageDimensions
)
from backend.app.services.ingestion_service import ingestion_service
from ai_engine.agents.rag_agent import rag_agent_node


class TestCVPhase2Step5Normalization(unittest.IsolatedAsyncioTestCase):
    def test_normalized_document_from_cv_runner_response(self):
        """Test 1: Verify CVRunnerResponse converts accurately into NormalizedDocument schema."""
        cv_res = CVRunnerResponse(
            status="success",
            processing_time_ms=120,
            total_pages=2,
            pages=[
                CVPageResult(
                    page_number=1,
                    width=800,
                    height=1000,
                    text_blocks=[
                        CVTextBlock(
                            block_id="b_01",
                            text="Boiler B-401 Thermal Degradation Spec",
                            confidence=0.99,
                            bounding_box_2d=[10, 20, 30, 400]
                        )
                    ],
                    tables=[
                        {
                            "table_id": "tbl_01",
                            "bounding_box_2d": [100, 200, 300, 400],
                            "markdown": "| Col1 | Col2 |\n|---|---|\n| Val1 | Val2 |",
                            "headers": ["Col1", "Col2"],
                            "rows": [["Val1", "Val2"]]
                        }
                    ]
                )
            ]
        )

        norm_doc = NormalizedDocument.from_cv_runner_response(
            cv_res=cv_res,
            document_id="doc_boiler_spec",
            filename="boiler_spec.pdf",
            file_type="pdf",
            metadata={"category": "engineering_sop"}
        )

        self.assertEqual(norm_doc.document_id, "doc_boiler_spec")
        self.assertEqual(norm_doc.filename, "boiler_spec.pdf")
        self.assertEqual(norm_doc.file_type, "pdf")
        self.assertEqual(norm_doc.total_pages, 2)
        self.assertEqual(len(norm_doc.pages), 1)

        p1 = norm_doc.pages[0]
        self.assertEqual(p1.page_number, 1)
        self.assertEqual(p1.width, 800)
        self.assertEqual(p1.height, 1000)
        self.assertEqual(len(p1.text_blocks), 1)
        self.assertEqual(p1.text_blocks[0].block_id, "b_01")
        self.assertEqual(p1.text_blocks[0].confidence, 0.99)
        self.assertEqual(p1.text_blocks[0].bounding_box_2d, [10, 20, 30, 400])

        self.assertEqual(len(p1.tables), 1)
        tbl = p1.tables[0]
        self.assertEqual(tbl["table_id"], "tbl_01")
        self.assertEqual(tbl["bounding_box_2d"], [100, 200, 300, 400])
        self.assertIn("Col1", tbl["markdown"])

    async def test_ingestion_via_normalized_document(self):
        """Test 2: Verify _process_via_cv_client normalizes CVRunnerResponse into NormalizedDocument during chunking."""
        cv_res = CVRunnerResponse(
            status="success",
            processing_time_ms=150,
            total_pages=1,
            pages=[
                CVPageResult(
                    page_number=1,
                    width=1000,
                    height=1200,
                    text_blocks=[
                        CVTextBlock(
                            block_id="blk_norm_1",
                            text="MAWP pressure rating is 160 bar under SOP-401.",
                            confidence=0.98,
                            bounding_box_2d=[50, 100, 80, 500]
                        )
                    ],
                    tables=[]
                )
            ]
        )

        with patch("backend.app.services.ingestion_service.cv_client.run_cv_runner", new_callable=AsyncMock) as mock_runner:
            mock_runner.return_value = cv_res
            chunks, total_pages = await ingestion_service._process_via_cv_client("/tmp/sample_norm.pdf")

            self.assertEqual(total_pages, 1)
            self.assertEqual(len(chunks), 1)
            chk = chunks[0]
            self.assertIn("MAWP pressure rating", chk["content"])
            self.assertTrue(chk["spatial_metadata"]["has_spatial"])
            self.assertEqual(chk["spatial_metadata"]["bounding_box_2d"], [50, 100, 80, 500])
            self.assertEqual(chk["spatial_metadata"]["block_ids"], ["blk_norm_1"])

    def test_normalized_document_preserves_coordinates(self):
        """Test 3: Explicitly verify [ymin, xmin, ymax, xmax] coordinate ordering is preserved exactly."""
        original_bbox = [123, 456, 789, 999]
        cv_res = CVRunnerResponse(
            status="success",
            processing_time_ms=50,
            total_pages=1,
            pages=[
                CVPageResult(
                    page_number=1,
                    width=2000,
                    height=3000,
                    text_blocks=[
                        CVTextBlock(
                            block_id="b_coord",
                            text="Coordinate test",
                            confidence=0.99,
                            bounding_box_2d=original_bbox
                        )
                    ],
                    tables=[]
                )
            ]
        )

        norm_doc = NormalizedDocument.from_cv_runner_response(cv_res, "doc_coords", "coord.png", "png")
        p_bbox = norm_doc.pages[0].text_blocks[0].bounding_box_2d

        self.assertEqual(p_bbox, original_bbox)
        self.assertEqual(p_bbox[0], 123)  # ymin
        self.assertEqual(p_bbox[1], 456)  # xmin
        self.assertEqual(p_bbox[2], 789)  # ymax
        self.assertEqual(p_bbox[3], 999)  # xmax

    def test_end_to_end_cv_to_citation(self):
        """Test 4: Verify complete pipeline flow from CV response -> NormalizedDocument -> ChunkCitation."""
        cv_res = CVRunnerResponse(
            status="success",
            processing_time_ms=200,
            total_pages=1,
            pages=[
                CVPageResult(
                    page_number=1,
                    width=800,
                    height=1000,
                    text_blocks=[
                        CVTextBlock(
                            block_id="blk_e2e_1",
                            text="ASME Section VIII Safety Valve PRV-102 set point 130 bar.",
                            confidence=0.99,
                            bounding_box_2d=[15, 25, 45, 600]
                        )
                    ],
                    tables=[]
                )
            ]
        )

        # 1. Normalize
        norm_doc = NormalizedDocument.from_cv_runner_response(cv_res, "doc_e2e", "e2e_spec.pdf", "pdf")

        # 2. Simulate vector store chunk match metadata
        chunk_group = norm_doc.pages[0].text_blocks
        union_bbox = chunk_group[0].bounding_box_2d

        match = {
            "chunk_id": "chk_e2e_99",
            "document_id": norm_doc.document_id,
            "page_number": norm_doc.pages[0].page_number,
            "score": 0.96,
            "content": chunk_group[0].text,
            "spatial_bbox": json.dumps(union_bbox),
            "page_width": norm_doc.pages[0].width,
            "page_height": norm_doc.pages[0].height,
            "has_spatial": True
        }

        # 3. Construct ChunkCitation
        raw_bbox = match.get("spatial_bbox")
        bbox_2d = json.loads(raw_bbox) if isinstance(raw_bbox, str) else raw_bbox
        page_dims = ImageDimensions(width=int(match["page_width"]), height=int(match["page_height"]))

        citation = ChunkCitation(
            document_id=match["document_id"],
            chunk_id=match["chunk_id"],
            page_number=match["page_number"],
            snippet=match["content"][:320].strip(),
            content=match["content"].strip(),
            bounding_box_2d=bbox_2d,
            page_dimensions=page_dims
        )

        self.assertEqual(citation.document_id, "doc_e2e")
        self.assertEqual(citation.bounding_box_2d, [15, 25, 45, 600])
        self.assertEqual(citation.page_dimensions.width, 800)
        self.assertEqual(citation.page_dimensions.height, 1000)

    def test_legacy_non_spatial_compatibility(self):
        """Test 5: Verify legacy non-spatial documents continue working through standard ingestion."""
        chunks = ingestion_service.chunk_text("Simple text file line 1\nSimple text file line 2", page_number=1)
        self.assertEqual(len(chunks), 1)
        self.assertEqual(chunks[0]["page_number"], 1)
        self.assertIn("Simple text file line 1", chunks[0]["content"])
        self.assertNotIn("spatial_metadata", chunks[0])

if __name__ == "__main__":
    unittest.main()
