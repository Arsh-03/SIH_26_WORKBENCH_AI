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
        citations.append({
            "document_id": m["document_id"],
            "chunk_id": m["chunk_id"],
            "page_number": m["page_number"],
            "snippet": m["content"][:140]
        })
        
    return {
        "rag_matches": matches,
        "citations": citations,
        "current_step": state.get("current_step", 0) + 1
    }

