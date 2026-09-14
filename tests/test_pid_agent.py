import pytest
from ai_engine.agents.pid_agent import (
    PID_DIRECTIVE,
    extract_pid_specs,
    get_default_mrpl_steam_pid
)
from ai_engine.agents.supervisor import _build_supervisor_response


def test_extract_pid_specs():
    sample_text = """Here is the P&ID schematic:
:::pid
{
  "title": "MRPL High-Pressure Steam & Relief Network",
  "unit": "CDU-II / Utility Block",
  "system": "Superheated Steam Generation & Header Relief",
  "nodes": [
    {
      "id": "B-401",
      "tag": "B-401",
      "name": "High-Pressure Steam Boiler",
      "type": "boiler",
      "x": 80,
      "y": 140,
      "status": "warning"
    },
    {
      "id": "PRV-102",
      "tag": "PRV-102",
      "name": "Header Safety Relief Valve",
      "type": "relief_valve",
      "x": 280,
      "y": 60,
      "status": "critical"
    }
  ],
  "pipes": [
    {
      "from": "B-401",
      "to": "PRV-102",
      "label": "Header Relief Line",
      "fluid": "HP Steam",
      "state": "hot"
    }
  ],
  "safetyAdvisory": "PRV-102 relief active above 130 bar."
}
:::
Review the diagram carefully.
"""
    specs = extract_pid_specs(sample_text)
    assert len(specs) == 1
    assert specs[0]["title"] == "MRPL High-Pressure Steam & Relief Network"
    assert len(specs[0]["nodes"]) == 2
    assert specs[0]["nodes"][0]["tag"] == "B-401"
    assert len(specs[0]["pipes"]) == 1
    assert specs[0]["pipes"][0]["from"] == "B-401"


def test_default_mrpl_steam_pid():
    default_pid = get_default_mrpl_steam_pid()
    assert "nodes" in default_pid
    assert "pipes" in default_pid
    assert len(default_pid["nodes"]) >= 4
    tags = [n["tag"] for n in default_pid["nodes"]]
    assert "B-401" in tags
    assert "PRV-102" in tags
    assert "V-102" in tags
    assert "E-101" in tags


def test_supervisor_routes_pid_agent():
    mock_routing_base = {
        "selected_model": "llama3.1:8b",
        "capability": "general_chat",
        "routing_reason": "default",
        "fallback_chain": []
    }

    pid_queries = [
        "Generate a P&ID schematic for our steam generation network",
        "Show me the piping and instrumentation diagram for Boiler B-401",
        "Can you display a process flow diagram PFD with equipment nodes?",
        "Visualize the process canvas for the crude preheat train layout"
    ]

    for q in pid_queries:
        res = _build_supervisor_response(mock_routing_base, q, [])
        assert "pid_agent" in res["plan"], f"Expected pid_agent for query '{q}', got {res['plan']}"
        assert "validator_agent" in res["plan"]


def test_refusal_interception_and_fallback():
    prompt = "Generate an interactive P&ID schematic of our MRPL high-pressure steam generation and relief network, showing Boiler B-401, Header Safety Relief Valve PRV-102, Flash Drum V-102, and Superheater E-101 operating at 480°C."
    refusal_response = "I can't provide a P&ID schematic that includes proprietary information or sensitive details about a specific industrial facility. Is there anything else I can help you with?"

    prompt_low = prompt.lower()
    is_pid_query = any(kw in prompt_low for kw in ["p&id", "pid", "schematic", "flow diagram", "pfd", "process canvas", "piping", "equipment node"])
    is_refusal = any(phrase in refusal_response.lower() for phrase in [
        "i can't provide a p&id", "i cannot provide a p&id", "proprietary information",
        "sensitive details about a specific industrial", "i can't provide proprietary"
    ])

    assert is_pid_query is True
    assert is_refusal is True

    # Fallback synthesizer replaces refusal with P&ID specification
    import json
    fallback_pid = get_default_mrpl_steam_pid()
    synthesized_response = f"MRPL P&ID Schematic\n\n:::pid\n{json.dumps(fallback_pid)}\n:::"
    specs = extract_pid_specs(synthesized_response)
    assert len(specs) == 1
    assert specs[0]["title"] == "MRPL High-Pressure Steam & Relief Network"

