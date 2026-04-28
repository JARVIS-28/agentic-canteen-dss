"""
Bharat-MAS Backend — Agent State Schema
Defines the shared TypedDict state passed between all LangGraph nodes.

IMPORTANT: agent_thought_log uses Annotated[list, operator.add] so that
parallel nodes (Forecasting + Trend) can both append entries without
LangGraph raising a "multiple values" conflict error.
"""

import operator
from typing import TypedDict, Optional, List, Dict, Any, Annotated


class AgentState(TypedDict):
    # ── Initialization ─────────────────────────────────────────────────────────
    session_id: str
    admin_id: Optional[str]
    user_id: str
    current_date: str                    # ISO-8601 date string
    current_time: Optional[str]           # Current time in HH:MM format

    # ── Inventory Context ────────────────────────────────────────────────────
    item_name: str
    unit_price: float
    usual_order_qty: int
    current_stock: int
    inventory_levels: Dict[str, int]     # Full inventory snapshot
    item_category: str                    # NEW: e.g., "grains", "dairy", "pulses"
    is_perishable: bool                   # NEW: True if item is short-lived
    expiry_date: Optional[str]            # NEW: ISO date
    horizon_days: int                     # NEW: 0, 1, 7, 30

    # ── Financial Context ─────────────────────────────────────────────────────
    cash_on_hand: float
    monthly_revenue: float
    monthly_expenses: float
    user_location: str                    # NEW: City/State for weather API

    # ── Forecasting Agent Outputs ─────────────────────────────────────────────
    forecast_qty_base: int               # Base demand prediction
    holding_cost: float                  # H: cost to hold excess stock
    stockout_penalty: float              # S: cost of a stockout event
    forecast_confidence: float           # 0.0–1.0

    # ── Trend Agent Outputs ─────────────────────────────────────────────────
    trend_modifier: float                # α ∈ [0.5, 3.0]
    trend_signals: List[Dict[str, Any]]  # [{event, type, impact_score}]
    trend_reason: str                    # Human-readable trend summary
    api_trend_signals: Dict[str, Any]    # NEW: Detailed signal breakdown from APIs
    trend_sources: List[str]             # NEW: ["festival", "weather", "news", "google_trends"]
    signal_confidence: float             # NEW: Confidence in the trend modifier (0.0-1.0)

    # ── Base Matrix (merged Forecast+Trend) ─────────────────────────────────
    base_matrix: Dict[str, Any]

    # ── Risk Agent Outputs ────────────────────────────────────────────────────
    risk_status: str                     # "Safe" | "Unsafe"
    risk_reason: str
    liquidity_ratio: float               # proposed_spend / cash_on_hand
    mdp_action: str                      # "APPROVE" | "RECALCULATE" | "BLOCK"
    recalculation_iterations: int        # Guard against infinite loops

    # ── Final Safe Recommendation ─────────────────────────────────────────────
    recommended_qty: int
    profit_impact: float

    # ── XAI Explanation Agent ─────────────────────────────────────────────────
    explanation_hinglish: str            # Minimal Contrastive Explanation
    explanation_english: str
    horizons: Optional[Dict[str, Any]]     # NEW: All horizons for planning

    # ── Internal Processing ──────────────────────────────────────────────────
    item_category_semantic: Optional[str]

    # ── Audit / Thought Signatures ────────────────────────────────────────────
    # Annotated with operator.add so parallel nodes can each append entries
    agent_thought_log: Annotated[List[Dict[str, Any]], operator.add]
    error_message: Optional[str]
