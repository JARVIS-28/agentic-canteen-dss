"""
Bharat-MAS — LangGraph Orchestrator

Defines the full deterministic StateGraph:

  START
    ↓
  [start_dispatch]
   ↙           ↘   (parallel)
[forecasting] [trend]
   ↘           ↙
  [build_matrix]
       ↓
    [risk]
    ↙   ↘  (conditional)
[recalc] [explanation] ── if Safe
    ↓
  [risk]   ← loops back until Safe or iteration limit
       ↓
  [explanation]
       ↓
     END
"""

from langgraph.graph import StateGraph, END
from agents.state import AgentState
from agents.forecasting_agent import forecasting_agent
from agents.trend_agent import trend_agent
from agents.merge_node import build_base_matrix
from agents.risk_agent import risk_agent
from agents.explanation_agent import explanation_agent


# ── Recalculation node (after Risk blocks) ───────────────────────────────────
def recalculate_node(state: AgentState) -> dict:
    """
    Dampens the recommendation to fit liquidity constraints.
    """
    prev_recommended = state.get("recommended_qty", 1)
    ratio = state.get("liquidity_ratio", 1.0)
    
    # Adaptive scaling: Reduce more aggressively if the liquidity violation is high
    scale_factor = 0.75 # Default 25% reduction
    if ratio > 2.0: scale_factor = 0.5
    if ratio > 5.0: scale_factor = 0.3
    
    safe_qty = max(1, int(prev_recommended * scale_factor))
    
    base = state.get("base_matrix", {}).copy()
    # Synchronize across prediction fields for agent awareness
    base["proposed_quantity"] = safe_qty
    base["base_prediction"] = safe_qty
    
    current_iter = state.get("recalculation_iterations", 0) + 1
    
    return {
        "base_matrix": base,
        "recalculation_iterations": current_iter
    }


# ── Conditional router ────────────────────────────────────────────────────────
def risk_router(state: AgentState) -> str:
    action = state.get("mdp_action", "APPROVE")
    iters = state.get("recalculation_iterations", 0)
    
    # Cap recalculation at 3 cycles to avoid recursion depth errors
    if action == "RECALCULATE" and iters < 3:
        return "recalculate"
        
    return "explanation"


# ── Graph factory ─────────────────────────────────────────────────────────────
def create_mas_graph():
    """Builds and compiles the full CanteenMAS StateGraph."""
    workflow = StateGraph(AgentState)

    # Nodes
    workflow.add_node("dispatch",     lambda s: s)
    workflow.add_node("trend",       trend_agent)
    workflow.add_node("forecasting", forecasting_agent)
    workflow.add_node("build_matrix", build_base_matrix)
    workflow.add_node("risk",         risk_agent)
    workflow.add_node("recalculate",  recalculate_node)
    workflow.add_node("explanation",  explanation_agent)

    # Entry
    workflow.set_entry_point("dispatch")

    # Context Gathering (now we just have one context gathering node or we can run things sequentially)
    # The new pipeline: dispatch -> trend -> forecasting -> build_matrix -> risk -> explanation
    # Let's parallelize trend and dispatch -> forecasting directly if we want, but trend_agent provides trend_multiplier 
    # which forecasting_agent uses!
    # So the flow must be: dispatch -> trend -> forecasting
    
    workflow.add_edge("dispatch", "trend")
    workflow.add_edge("trend", "forecasting")

    # Standard Flow
    workflow.add_edge("forecasting", "build_matrix")
    workflow.add_edge("build_matrix", "risk")

    # Conditional: Safe → Explanation | Unsafe → Recalculate
    workflow.add_conditional_edges(
        "risk",
        risk_router,
        {
            "recalculate": "recalculate",
            "explanation": "explanation",
        }
    )

    # After recalculation, return to Risk Gate for re-evaluation
    workflow.add_edge("recalculate", "risk")

    # Terminal
    workflow.add_edge("explanation", END)

    return workflow.compile()


# NOTE: Do NOT cache the graph as a module-level singleton.
# This allows uvicorn --reload to properly re-import agents when they change.
# The graph creation overhead is negligible for our use case.

def get_graph():
    """Creates a fresh compiled MAS graph. Called once per request via module-level import."""
    return create_mas_graph()
