from typing import Dict, Any
from ai_engine.state import AgentState
from ai_engine.router import dynamic_router

def supervisor_node(state: AgentState) -> Dict[str, Any]:
    """
    Supervisor Agent analyzes intent, dynamically routes to specialized on-premise models,
    and orchestrates graph worker nodes.
    """
    prompt = state.get("prompt", "").strip()
    prompt_low = prompt.lower()
    plan = []

    # Dynamic Model Router classification
    routing_res = dynamic_router.route_query(
        prompt=prompt,
        active_document_ids=state.get("active_document_ids", []),
        has_images=bool(state.get("extracted_elements")),
        available_models=state.get("available_models", [])
    )

    # Check for simple conversational greetings
    is_greeting = any(prompt_low.startswith(kw) for kw in ["hey", "hi", "hello", "greetings", "good morning", "good afternoon", "sup", "yo"]) or len(prompt_low) <= 4

    if is_greeting:
        plan = ["chat_agent"]
    else:
        # Technical document / SOP search
        if state.get("active_document_ids") or any(kw in prompt_low for kw in ["sop", "spec", "boiler", "mawp", "asme", "document", "manual", "procedure", "valve"]):
            plan.append("rag_agent")

        # Code execution / calculation / plotting
        if any(kw in prompt_low for kw in ["plot", "curve", "simulate", "degradation", "calculate", "python", "script", "code", "benchmark", "function", "component"]):
            plan.append("code_agent")

        # Vision / diagram / image analysis
        if any(kw in prompt_low for kw in ["image", "diagram", "schematic", "ocr", "photo"]):
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

