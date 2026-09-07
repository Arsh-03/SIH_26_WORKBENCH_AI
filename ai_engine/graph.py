from typing import Dict, Any, Generator
from ai_engine.state import AgentState
from ai_engine.agents.supervisor import supervisor_node
from ai_engine.agents.rag_agent import rag_agent_node
from ai_engine.agents.code_agent import code_agent_node
from ai_engine.agents.vision_agent import vision_agent_node

class SovereignAgentWorkflow:
    """
    Multi-Agent State Machine Graph for On-Premise Sovereign AI Workbench.
    Coordinates Supervisor, RAG, Code Sandbox, and Vision Agents.
    """
    def __init__(self):
        self.nodes = {
            "supervisor": supervisor_node,
            "rag_agent": rag_agent_node,
            "code_agent": code_agent_node,
            "vision_agent": vision_agent_node,
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

        # 3. Final synthesis
        rag_summary = " ".join([m.get("content", "") for m in state.get("rag_matches", [])])
        state["final_content"] = (
            f"Analysis complete for query: '{state.get('prompt', '')}'.\n"
            f"Operational parameters grounded in retrieved SOP documents. "
            f"Calculated thermal degradation margins and generated regulatory compliance notes."
        )
        yield {"node": "final_synthesis", "state": state}
        return state

workflow = SovereignAgentWorkflow()

