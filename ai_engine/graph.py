from typing import Dict, Any, Generator
from ai_engine.state import AgentState
from ai_engine.agents.supervisor import supervisor_node
from ai_engine.agents.chat_agent import chat_agent_node
from ai_engine.agents.rag_agent import rag_agent_node
from ai_engine.agents.code_agent import code_agent_node
from ai_engine.agents.vision_agent import vision_agent_node
from ai_engine.agents.doc_agent import doc_agent_node
from ai_engine.agents.validator_agent import validator_agent_node

class SovereignAgentWorkflow:
    """
    Multi-Agent State Machine Graph for On-Premise Sovereign AI Workbench.
    Coordinates Supervisor, Chat, RAG, Code Sandbox, Doc Generation, and Validator Agents.
    """
    def __init__(self):
        self.nodes = {
            "supervisor": supervisor_node,
            "chat_agent": chat_agent_node,
            "rag_agent": rag_agent_node,
            "code_agent": code_agent_node,
            "vision_agent": vision_agent_node,
            "doc_agent": doc_agent_node,
            "validator_agent": validator_agent_node,
        }

    def execute_stream(self, initial_state: AgentState) -> Generator[Dict[str, Any], None, AgentState]:
        """
        Stream state updates step-by-step as each agent node executes.
        """
        state = dict(initial_state)
        
        # 1. Supervisor step
        sup_update = self.nodes["supervisor"](state)
        state.update(sup_update)
        yield {"node": "supervisor", "state": state}

        # 2. Worker nodes execution
        plan = state.get("plan", [])
        for node_name in plan:
            if node_name in self.nodes:
                update = self.nodes[node_name](state)
                state.update(update)
                yield {"node": node_name, "state": state}

        return state

workflow = SovereignAgentWorkflow()
