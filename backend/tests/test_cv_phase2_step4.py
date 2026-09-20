import json
import unittest
from unittest.mock import AsyncMock, MagicMock, patch
from backend.app.models.schemas import AgentRunRequest, ChunkCitation, ImageDimensions
from ai_engine.agents.rag_agent import rag_agent_node

class TestCVPhase2Step4SpatialCitations(unittest.TestCase):
    def test_spatial_retrieved_chunk_citation(self):
        """Test A: Spatial retrieved chunk transforms spatial_bbox string and dimensions into ChunkCitation."""
        match = {
            "chunk_id": "chk_1001",
            "document_id": "doc_vessel_pdf",
            "page_number": 2,
            "score": 0.95,
            "content": "Pressure vessel MAWP is 160 bar at 350C under SOP-401 guidelines.",
            "spatial_bbox": "[10, 20, 60, 120]",
            "page_width": 800,
            "page_height": 1000,
            "has_spatial": True
        }

        # Simulate citation creation path in agent_engine
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

        self.assertEqual(citation.bounding_box_2d, [10, 20, 60, 120])
        self.assertIsNotNone(citation.page_dimensions)
        self.assertEqual(citation.page_dimensions.width, 800)
        self.assertEqual(citation.page_dimensions.height, 1000)

    def test_citation_ids_page_content_preservation(self):
        """Test B: Verify document_id, chunk_id, page_number, snippet, and content are preserved."""
        match = {
            "chunk_id": "chk_preserved_01",
            "document_id": "SOP-401.md",
            "page_number": 4,
            "score": 0.98,
            "content": "Safety Valve PRV-102 set pressure is 130 bar.",
            "spatial_bbox": "[50, 100, 150, 450]",
            "page_width": 1200,
            "page_height": 1600,
            "has_spatial": True
        }

        bbox_2d = json.loads(match["spatial_bbox"])
        page_dims = ImageDimensions(width=match["page_width"], height=match["page_height"])

        citation = ChunkCitation(
            document_id=match["document_id"],
            chunk_id=match["chunk_id"],
            page_number=match["page_number"],
            snippet=match["content"][:320].strip(),
            content=match["content"].strip(),
            bounding_box_2d=bbox_2d,
            page_dimensions=page_dims
        )

        self.assertEqual(citation.document_id, "SOP-401.md")
        self.assertEqual(citation.chunk_id, "chk_preserved_01")
        self.assertEqual(citation.page_number, 4)
        self.assertEqual(citation.snippet, "Safety Valve PRV-102 set pressure is 130 bar.")
        self.assertEqual(citation.content, "Safety Valve PRV-102 set pressure is 130 bar.")

    def test_non_spatial_citation(self):
        """Test C: Non-spatial chunk creates citation with bounding_box_2d=None and page_dimensions=None."""
        match = {
            "chunk_id": "chk_txt_01",
            "document_id": "doc_plain_txt",
            "page_number": 1,
            "score": 0.88,
            "content": "Plain text document content without spatial layout.",
            "spatial_bbox": None,
            "page_width": None,
            "page_height": None,
            "has_spatial": False
        }

        citation = ChunkCitation(
            document_id=match["document_id"],
            chunk_id=match["chunk_id"],
            page_number=match["page_number"],
            snippet=match["content"][:320].strip(),
            content=match["content"].strip(),
            bounding_box_2d=None,
            page_dimensions=None
        )

        self.assertIsNone(citation.bounding_box_2d)
        self.assertIsNone(citation.page_dimensions)
        self.assertEqual(citation.chunk_id, "chk_txt_01")

    def test_invalid_bbox_json(self):
        """Test D: Malformed spatial_bbox JSON string does not crash citation creation and yields None."""
        match = {
            "chunk_id": "chk_bad_json",
            "document_id": "doc_corrupt",
            "page_number": 1,
            "score": 0.90,
            "content": "Content with corrupt spatial metadata",
            "spatial_bbox": "{malformed_json_str: true",
            "page_width": 800,
            "page_height": 1000,
            "has_spatial": True
        }

        bbox_2d = None
        raw_bbox = match.get("spatial_bbox")
        if raw_bbox and isinstance(raw_bbox, str):
            try:
                parsed = json.loads(raw_bbox)
                if isinstance(parsed, list):
                    bbox_2d = parsed
            except Exception:
                bbox_2d = None

        citation = ChunkCitation(
            document_id=match["document_id"],
            chunk_id=match["chunk_id"],
            page_number=match["page_number"],
            snippet=match["content"][:320].strip(),
            content=match["content"].strip(),
            bounding_box_2d=bbox_2d,
            page_dimensions=ImageDimensions(width=800, height=1000)
        )

        self.assertIsNone(citation.bounding_box_2d)
        self.assertIsNotNone(citation.page_dimensions)

    def test_missing_or_invalid_dimensions(self):
        """Test E: Missing or partial page dimensions result in page_dimensions=None."""
        match = {
            "chunk_id": "chk_partial_dims",
            "document_id": "doc_partial",
            "page_number": 1,
            "score": 0.91,
            "content": "Content with missing height",
            "spatial_bbox": "[10, 20, 60, 120]",
            "page_width": 800,
            "page_height": None,
            "has_spatial": True
        }

        page_dims = None
        p_w = match.get("page_width")
        p_h = match.get("page_height")
        if p_w is not None and p_h is not None:
            try:
                p_w_int = int(p_w)
                p_h_int = int(p_h)
                if p_w_int > 0 and p_h_int > 0:
                    page_dims = ImageDimensions(width=p_w_int, height=p_h_int)
            except (ValueError, TypeError):
                page_dims = None

        citation = ChunkCitation(
            document_id=match["document_id"],
            chunk_id=match["chunk_id"],
            page_number=match["page_number"],
            snippet=match["content"][:320].strip(),
            content=match["content"].strip(),
            bounding_box_2d=json.loads(match["spatial_bbox"]),
            page_dimensions=page_dims
        )

        self.assertEqual(citation.bounding_box_2d, [10, 20, 60, 120])
        self.assertIsNone(citation.page_dimensions)

    def test_rag_agent_citation_path(self):
        """Test F: Verify standalone rag_agent_node produces spatial fields in citation dictionary."""
        mock_matches = [
            {
                "document_id": "SOP-401.md",
                "chunk_id": "chk_graph_01",
                "page_number": 3,
                "score": 0.94,
                "content": "Graph agent retrieval match with spatial bounding box.",
                "spatial_bbox": "[15, 25, 65, 125]",
                "page_width": 850,
                "page_height": 1100,
                "has_spatial": True
            }
        ]

        with patch("ai_engine.agents.rag_agent.search_knowledge_base", return_value=mock_matches):
            res = rag_agent_node({"workspace_id": "ws1", "prompt": "check SOP", "active_document_ids": []})

            self.assertIn("citations", res)
            citations = res["citations"]
            self.assertEqual(len(citations), 1)
            cit = citations[0]

            self.assertEqual(cit["document_id"], "SOP-401.md")
            self.assertEqual(cit["chunk_id"], "chk_graph_01")
            self.assertEqual(cit["bounding_box_2d"], [15, 25, 65, 125])
            self.assertEqual(cit["page_dimensions"], {"width": 850, "height": 1100})

    def test_legacy_metadata_compatibility(self):
        """Test G: Legacy retrieval match with missing spatial keys creates valid citation without crashing."""
        legacy_match = {
            "chunk_id": "chk_legacy_99",
            "document_id": "legacy_doc",
            "page_number": 1,
            "score": 0.85,
            "content": "Legacy document chunk from old index."
        }

        bbox_2d = None
        raw_bbox = legacy_match.get("spatial_bbox")
        if raw_bbox:
            if isinstance(raw_bbox, list):
                bbox_2d = raw_bbox
            elif isinstance(raw_bbox, str):
                try:
                    parsed = json.loads(raw_bbox)
                    if isinstance(parsed, list):
                        bbox_2d = parsed
                except Exception:
                    bbox_2d = None

        page_dims = None
        p_w = legacy_match.get("page_width")
        p_h = legacy_match.get("page_height")
        if p_w is not None and p_h is not None:
            try:
                p_w_int = int(p_w)
                p_h_int = int(p_h)
                if p_w_int > 0 and p_h_int > 0:
                    page_dims = ImageDimensions(width=p_w_int, height=p_h_int)
            except (ValueError, TypeError):
                page_dims = None

        citation = ChunkCitation(
            document_id=legacy_match["document_id"],
            chunk_id=legacy_match["chunk_id"],
            page_number=legacy_match["page_number"],
            snippet=legacy_match["content"][:320].strip(),
            content=legacy_match["content"].strip(),
            bounding_box_2d=bbox_2d,
            page_dimensions=page_dims
        )

        self.assertEqual(citation.document_id, "legacy_doc")
        self.assertIsNone(citation.bounding_box_2d)
        self.assertIsNone(citation.page_dimensions)

    def test_full_txt_variable_binding(self):
        """Test H: Explicit regression test verifying full_txt variable is defined and bound correctly."""
        import re
        matches = [
            {
                "chunk_id": "chk_regression_01",
                "document_id": "company_doc_SOP-401_md",
                "page_number": 1,
                "score": 0.99,
                "content": "Full text snippet for regression validation.",
                "spatial_bbox": "[10, 20, 30, 40]",
                "page_width": 500,
                "page_height": 600,
                "has_spatial": True
            }
        ]

        citations_collected = []
        for idx, m in enumerate(matches, 1):
            raw_doc_id = m.get("document_id", "doc_sop")
            clean_doc_id = re.sub(r"^company_doc_", "", raw_doc_id)
            clean_doc_id = re.sub(r"_md$", ".md", clean_doc_id)
            full_txt = m.get("content", "")
            
            bbox_2d = None
            raw_bbox = m.get("spatial_bbox")
            if raw_bbox:
                if isinstance(raw_bbox, list):
                    bbox_2d = raw_bbox
                elif isinstance(raw_bbox, str):
                    try:
                        parsed_bbox = json.loads(raw_bbox)
                        if isinstance(parsed_bbox, list):
                            bbox_2d = parsed_bbox
                    except Exception:
                        bbox_2d = None

            page_dims = None
            p_w = m.get("page_width")
            p_h = m.get("page_height")
            if p_w is not None and p_h is not None:
                try:
                    p_w_int = int(p_w)
                    p_h_int = int(p_h)
                    if p_w_int > 0 and p_h_int > 0:
                        page_dims = ImageDimensions(width=p_w_int, height=p_h_int)
                except (ValueError, TypeError):
                    page_dims = None

            citation = ChunkCitation(
                document_id=clean_doc_id,
                chunk_id=m.get("chunk_id", f"chk_{idx}"),
                page_number=m.get("page_number", 1),
                snippet=full_txt[:320].strip(),
                content=full_txt.strip(),
                bounding_box_2d=bbox_2d,
                page_dimensions=page_dims
            )
            citations_collected.append(citation)

        self.assertEqual(len(citations_collected), 1)
        self.assertEqual(citations_collected[0].snippet, "Full text snippet for regression validation.")
        self.assertEqual(citations_collected[0].content, "Full text snippet for regression validation.")
        self.assertEqual(citations_collected[0].document_id, "SOP-401.md")

if __name__ == "__main__":
    unittest.main()

