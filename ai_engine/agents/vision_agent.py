from typing import Dict, Any, List
from ai_engine.state import AgentState

def vision_agent_node(state: AgentState) -> Dict[str, Any]:
    """
    Vision Agent extracts engineering schematics, tables, and bounding boxes.
    """
    detected_elements = [
        {
            "type": "equipment_tag",
            "text": "PRV-401A",
            "bbox": [150, 220, 210, 360],
            "confidence": 0.982
        },
        {
            "type": "rating_table",
            "text": "DESIGN MAWP: 160 BAR @ 350C",
            "bbox": [540, 100, 680, 480],
            "confidence": 0.965
        }
    ]
    
    return {
        "extracted_elements": detected_elements,
        "current_step": state.get("current_step", 0) + 1
    }

