from typing import Dict, Any
from ai_engine.state import AgentState
from ai_engine.router import dynamic_router

def _build_supervisor_response(routing_res: Dict[str, Any], prompt_low: str, active_doc_ids: list) -> Dict[str, Any]:
    plan = []
    is_greeting = any(prompt_low.startswith(kw) for kw in ["hey", "hi", "hello", "greetings", "good morning", "good afternoon", "sup", "yo"]) or len(prompt_low) <= 4

    if is_greeting:
        plan = ["chat_agent"]
    else:
        # Technical document / SOP / Standards search (active docs or industrial keywords)
        rag_keywords = [
            "sop", "boiler", "mawp", "asme", "valve", "inspection", "interval",
            "intervals", "pressure", "thickness", "policy", "air gap", "security",
            "hydrostatic", "ndt", "ultrasonic", "utg", "standard", "rules", "specification", "spec"
        ]
        if active_doc_ids or any(kw in prompt_low for kw in rag_keywords):
            plan.append("rag_agent")

        # Code execution / calculation / plotting (only if pure code execution requested and NOT a document request)
        if routing_res["capability"] == "coding" or any(kw in prompt_low for kw in ["plot", "curve", "simulate", "degradation", "execute", "benchmark"]):
            plan.append("code_agent")

        # Vision / diagram / image analysis
        if routing_res["capability"] == "vision_ocr" or any(kw in prompt_low for kw in ["image", "diagram", "schematic", "ocr", "photo"]):
            plan.append("vision_agent")

        if not plan:
            plan = ["chat_agent"]

    return {
        "plan": plan,
        "current_step": 0,
        "selected_model": routing_res["selected_model"],
        "model_capability": routing_res["capability"],
        "routing_reason": routing_res["routing_reason"],
        "fallback_chain": routing_res["fallback_chain"]
    }

def supervisor_node(state: AgentState) -> Dict[str, Any]:
    """Synchronous fallback supervisor node."""
    prompt = state.get("prompt", "").strip()
    prompt_low = prompt.lower()
    routing_res = dynamic_router.route_query(
        prompt=prompt,
        active_document_ids=state.get("active_document_ids", []),
        has_images=bool(state.get("extracted_elements")),
        available_models=state.get("available_models", [])
    )
    return _build_supervisor_response(routing_res, prompt_low, state.get("active_document_ids", []))

async def supervisor_node_async(state: AgentState) -> Dict[str, Any]:
    """Asynchronous supervisor node using LLM-powered dynamic model router."""
    prompt = state.get("prompt", "").strip()
    prompt_low = prompt.lower()
    routing_res = await dynamic_router.route_query_async(
        prompt=prompt,
        active_document_ids=state.get("active_document_ids", []),
        has_images=bool(state.get("extracted_elements")),
        available_models=state.get("available_models", [])
    )
    return _build_supervisor_response(routing_res, prompt_low, state.get("active_document_ids", []))

