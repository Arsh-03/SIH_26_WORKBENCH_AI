import json
from typing import Dict, Any, List
from ai_engine.state import AgentState
from ai_engine.tools.vector_search import search_knowledge_base

def rag_agent_node(state: AgentState) -> Dict[str, Any]:
    """
    RAG Agent queries the vector store and compiles grounded citations.
    """
    workspace_id = state.get("workspace_id", "default_workspace")
    query = state.get("prompt", "")
    active_docs = state.get("active_document_ids", [])
    
    matches = search_knowledge_base(
        query=query,
        workspace_id=workspace_id,
        active_document_ids=active_docs,
        top_k=3
    )
    
    citations: List[Dict[str, Any]] = []
    for m in matches:
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
                    page_dims = {"width": p_w_int, "height": p_h_int}
            except (ValueError, TypeError):
                page_dims = None

        citations.append({
            "document_id": m["document_id"],
            "chunk_id": m["chunk_id"],
            "page_number": m["page_number"],
            "snippet": m["content"][:140],
            "bounding_box_2d": bbox_2d,
            "page_dimensions": page_dims
        })
        
    return {
        "rag_matches": matches,
        "citations": citations,
        "current_step": state.get("current_step", 0) + 1
    }

