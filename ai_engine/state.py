from typing import TypedDict, List, Dict, Any, Optional

class AgentState(TypedDict):
    workspace_id: str
    prompt: str
    active_document_ids: List[str]
    allowed_tools: List[str]
    temperature: float
    current_step: int
    plan: List[str]
    extracted_elements: List[Dict[str, Any]]
    rag_matches: List[Dict[str, Any]]
    sandbox_output: Optional[Dict[str, Any]]
    final_content: str
    citations: List[Dict[str, Any]]
    artifact_paths: List[str]
    selected_model: Optional[str]
    model_capability: Optional[str]
    routing_reason: Optional[str]
    fallback_chain: Optional[List[str]]

