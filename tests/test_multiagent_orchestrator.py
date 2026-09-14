import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from ai_engine.agents.supervisor import supervisor_node
from ai_engine.agents.validator_agent import validator_agent
from ai_engine.router import dynamic_router

test_cases = [
    ("Hello good morning", []),
    ("What are the inspection intervals in SOP-401 for boiler pressure vessels?", []),
    ("Simulate thermal degradation curve at 500C in python and plot it", []),
    ("Create me a formal Word document report for MRPL boiler safety inspection based on our SOP-401", []),
    ("Calculate and plot thermal degradation at 500C and create a formal inspection report with SOP-401 standards", [])
]

print("=== TESTING DYNAMIC SUPERVISOR PLANS ===")
for prompt, doc_ids in test_cases:
    state = {
        "prompt": prompt,
        "active_document_ids": doc_ids,
        "available_models": ["llama3.1:8b", "qwen2.5-coder:7b"],
        "running_models": ["llama3.1:8b"]
    }
    res = supervisor_node(state)
    plan_str = " -> ".join(res["plan"])
    print(f"Prompt: {prompt[:65]}...")
    print(f"  Plan: {plan_str}")
    print(f"  Model: {res['selected_model']}")
    print(f"  Reason: {res['routing_reason']}")
    print("-" * 50)

print("\n=== TESTING COMPLIANCE VALIDATOR ===")
val_res = validator_agent.validate_response(
    prompt="Check boiler MAWP under SOP-401",
    response_text="According to SOP-401 [1], MAWP is 160 bar and relief valve must be set accordingly.",
    retrieved_citations=[{"document_id": "SOP-401.md", "chunk_id": "chk_1"}],
    has_code_execution=False
)
print("Validator Output:", val_res)

print("\n=== TESTING AGENT_ENGINE IMPORT ===")
from backend.app.services.agent_engine import agent_engine
print("agent_engine imported successfully!")
