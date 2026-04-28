"""
Bharat-MAS — Merge / Base-Matrix Builder node
Runs after the parallel Forecasting+Trend agents to combine their outputs.
"""

import datetime
from typing import Any, Dict


def build_base_matrix(state: Dict[str, Any]) -> Dict[str, Any]:
    """LangGraph Node: Combines Forecasting and Trend outputs with perishable constraints."""
    base_prediction = state.get("forecast_qty_base", state.get("usual_order_qty", 50))
    usual_order_qty = state.get("usual_order_qty", 50)
    is_perishable = state.get("is_perishable", False)
    
    alpha = state.get("trend_modifier")
    if alpha is None:
        alpha = 1.0

    # Base calculation
    proposed_qty = max(1, int(round(base_prediction * alpha)))
    current_stock = state.get("current_stock", 0)
    
    # PERISHABLE OVERRIDE: 
    # Items that are perishable can ONLY be stored for the day.
    if is_perishable:
        net_demand = max(0, int(round(usual_order_qty * alpha)) - current_stock)
        
        if alpha <= 1.2:
            proposed_qty = min(net_demand, usual_order_qty)
        else:
            proposed_qty = net_demand

    base_matrix = {
        "proposed_quantity": proposed_qty,
        "base_prediction": base_prediction,
        "trend_modifier": alpha,
        "holding_cost": state.get("holding_cost", 0.0),
        "stockout_penalty": state.get("stockout_penalty", 0.0),
        "trend_reason": state.get("trend_reason", ""),
        "forecast_confidence": state.get("forecast_confidence", 0.0),
        "is_perishable": is_perishable,
        "current_stock": current_stock
    }

    log_entry = {
        "agent": "MatrixBuilder",
        "timestamp": datetime.datetime.utcnow().isoformat(),
        "thought": (
            f"[Merge] Prediction={base_prediction} × α={alpha} -> proposed_qty={proposed_qty} (Perish_Cap={is_perishable})."
        ),
        "output": {"proposed_qty": proposed_qty}
    }

    existing_log = state.get("agent_thought_log", [])
    return {
        "base_matrix": base_matrix,
        "agent_thought_log": existing_log + [log_entry],
    }
