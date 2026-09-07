from typing import Dict, Any
from ai_engine.state import AgentState
from ai_engine.prompts.supervisor_prompt import SUPERVISOR_SYSTEM_PROMPT

def supervisor_node(state: AgentState) -> Dict[str, Any]:
    """
    Supervisor Agent analyzes the prompt and orchestrates worker nodes.
    """
    prompt = state.get("prompt", "").lower()
    plan = []

    # Determine execution steps based on prompt intent and allowed tools
    allowed = state.get("allowed_tools", [])
    
    if "rag_search" in allowed or state.get("active_document_ids") or "sop" in prompt or "spec" in prompt or "pressure" in prompt:
        plan.append("rag_agent")
    
    if "sandbox_execute" in allowed or "plot" in prompt or "calculate" in prompt or "code" in prompt:
        plan.append("code_agent")
        
    if "vision_analyze" in allowed or "image" in prompt or "diagram" in prompt:
        plan.append("vision_agent")

    if not plan:
        plan = ["rag_agent"]

    return {
        "plan": plan,
        "current_step": 0
    }

