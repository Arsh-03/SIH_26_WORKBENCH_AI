from typing import Dict, Any
from ai_engine.state import AgentState

def chat_agent_node(state: AgentState) -> Dict[str, Any]:
    """
    Chat Agent handles general conversational queries and natural dialogue.
    """
    return {
        "current_step": state.get("current_step", 0) + 1
    }
