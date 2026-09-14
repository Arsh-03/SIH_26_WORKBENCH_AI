import re
from typing import Dict, Any, List
from ai_engine.state import AgentState
from ai_engine.router import dynamic_router

def _build_supervisor_response(routing_res: Dict[str, Any], prompt: str, active_doc_ids: list) -> Dict[str, Any]:
    prompt_low = prompt.strip().lower()
    plan: List[str] = []

    # Check for simple greeting / casual dialogue
    is_greeting = any(prompt_low.startswith(kw) for kw in ["hey", "hi", "hello", "greetings", "good morning", "good afternoon", "sup", "yo"]) or (len(prompt_low) <= 4 and not prompt_low.isdigit())

    if is_greeting:
        # Fast path: instant conversational response, zero tool overhead
        plan = ["chat_agent"]
    else:
        # 1. RAG Retrieval Agent Detection (MRPL Knowledge Base, Standards & Active Docs)
        rag_keywords = [
            "sop", "boiler", "mawp", "asme", "valve", "inspection", "interval",
            "intervals", "pressure", "thickness", "policy", "air gap", "security",
            "hydrostatic", "ndt", "ultrasonic", "utg", "standard", "rules", "specification", "spec",
            "mrpl", "refinery", "cdu", "crude", "hydrocracker", "guideline", "document", "docs",
            "company", "manual", "operating procedure", "limit", "safety"
        ]
        
        doc_create_verbs = ["create", "generate", "draft", "compile", "build", "write", "export", "save as", "produce", "make a"]
        doc_create_nouns = ["doc", "document", "docx", "word doc", "report", "formal report", "written memo", "memo", "full sop", "specification"]
        is_doc_request = (
            (any(v in prompt_low for v in doc_create_verbs) and any(n in prompt_low for n in doc_create_nouns)) or
            any(phrase in prompt_low for phrase in ["save as doc", "save the output", "save in doc", "generate doc", "create doc", "draft report", "export to docx", "save as word"])
        )

        has_rag_triggers = bool(active_doc_ids) or any(kw in prompt_low for kw in rag_keywords)
        # If the user asks for a document or technical report, ensure RAG context is pulled if refinery/SOP topics are involved
        if has_rag_triggers or (is_doc_request and not any(kw in prompt_low for kw in ["code only", "pure python", "simple text"])):
            plan.append("rag_agent")

        # 2. Code Execution & Physics Simulation Agent (Sandbox)
        code_keywords = ["simulate", "simulation", "degradation", "execute", "benchmark", "python script", "calculate and plot", "formula execution"]
        has_code_intent = (
            routing_res.get("capability") == "coding" or 
            any(kw in prompt_low for kw in code_keywords)
        )
        if has_code_intent:
            plan.append("code_agent")

        # 3. Industrial Visual Analytics & Dynamic Charts Agent
        analytics_keywords = [
            "chart", "bar chart", "line chart", "pie chart", "area chart",
            "plot", "graph", "trend", "breakdown", "distribution", "visualize",
            "analytics", "visual analytics", "comparison chart", "time series"
        ]
        if any(kw in prompt_low for kw in analytics_keywords):
            plan.append("analytics_agent")

        # 4. Operational Economics & Refinery Financial Impact Agent
        economics_keywords = [
            "cost", "economics", "revenue", "loss", "margin", "grm", "opex",
            "downtime cost", "steam cost", "financial", "payback", "roi", "profit",
            "penalty", "monetary", "curtailment"
        ]
        if any(kw in prompt_low for kw in economics_keywords):
            plan.append("economics_agent")

        # 5. Engineering Physics & First-Principles Simulation Agent
        physics_keywords = [
            "asme", "wall thickness", "stress", "creep", "larson-miller", "darcy",
            "lmtd", "hydraulics", "mawp", "rupture life", "hoop stress", "burst pressure",
            "safety factor", "ug-27", "heat duty", "corrosion allowance"
        ]
        if any(kw in prompt_low for kw in physics_keywords):
            plan.append("physics_agent")

        # 6. Interactive P&ID & Process Canvas Agent
        pid_keywords = [
            "p&id", "pid", "schematic", "flow diagram", "pfd", "piping diagram",
            "process canvas", "process flow", "equipment layout", "piping and instrumentation"
        ]
        if any(kw in prompt_low for kw in pid_keywords):
            plan.append("pid_agent")

        # 7. Vision & Multimodal OCR Agent
        if routing_res.get("capability") == "vision_ocr" or any(kw in prompt_low for kw in ["image", "ocr", "photo", "blueprint"]):
            plan.append("vision_agent")

        # 8. Synthesis Agent (Document Generator vs. Interactive Chat Agent)
        if is_doc_request:
            plan.append("doc_agent")
        else:
            plan.append("chat_agent")

        # 9. Validator & Compliance Evaluator Agent
        # Run compliance & citation validation for any technical standard, document creation, or calculation
        if any(a in plan for a in ["rag_agent", "doc_agent", "code_agent", "analytics_agent", "economics_agent", "physics_agent", "pid_agent"]):
            plan.append("validator_agent")

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
    """Synchronous fallback supervisor node with warm model affinity."""
    prompt = state.get("prompt", "").strip()
    routing_res = dynamic_router.route_query(
        prompt=prompt,
        active_document_ids=state.get("active_document_ids", []),
        has_images=bool(state.get("extracted_elements")),
        available_models=state.get("available_models", []),
        running_models=state.get("running_models", [])
    )
    return _build_supervisor_response(routing_res, prompt, state.get("active_document_ids", []))

async def supervisor_node_async(state: AgentState) -> Dict[str, Any]:
    """Asynchronous supervisor node using dynamic router with warm model affinity."""
    prompt = state.get("prompt", "").strip()
    routing_res = await dynamic_router.route_query_async(
        prompt=prompt,
        active_document_ids=state.get("active_document_ids", []),
        has_images=bool(state.get("extracted_elements")),
        available_models=state.get("available_models", []),
        running_models=state.get("running_models", [])
    )
    return _build_supervisor_response(routing_res, prompt, state.get("active_document_ids", []))

