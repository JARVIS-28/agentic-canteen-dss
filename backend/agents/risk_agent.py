import math
import datetime
import json
from pathlib import Path

def risk_agent(state: dict):
    """
    Analyzes inventory risk using real-time operational constraints.
    - If is_perishable=True: Recommended qty is capped at a 1-day supply.
    - Workday Lockout: If current time < close_time, perishables focus only on Today's needs.
    """
    base = state.get("base_matrix", {})
    item_id = state.get("item_id", "unknown")
    item_name = state.get("item_name", "Unknown Item")
    stock_quantity = state.get("current_stock", 0)
    usual_daily_demand = state.get("usual_order_qty", 50)
    is_perishable = state.get("is_perishable", False)
    
    now_ist = datetime.datetime.now() # System local time by default
    
    # Use provided current_time from state if available
    current_time_from_state = state.get("current_time")
    if current_time_from_state:
        try:
            h, m = map(int, current_time_from_state.split(':'))
            now_ist = now_ist.replace(hour=h, minute=m)
        except: pass
    elif state.get("current_date"):
        # If date provided but not time, assume start of day
        current_time_str = "08:00"
    
    now_min = now_ist.hour * 60 + now_ist.minute
    current_time_str = now_ist.strftime("%H:%M")
    
    # Load operational settings from DB (with fallback)
    from services.settings_service import fetch_settings
    admin_id = state.get("admin_id") or state.get("user_id", "unknown")
    settings = fetch_settings(admin_id)
    
    open_time_str = settings.get("open_time", "08:00")
    close_time_str = settings.get("close_time", "17:00")
    working_days = settings.get("calendar", {}).get("working_days", []) or settings.get("working_days", ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"])

    def time_to_min(t_str):
        h, m = map(int, t_str.split(':'))
        return h * 60 + m

    open_min = time_to_min(open_time_str)
    close_min = time_to_min(close_time_str)
    
    # Check if today is a working day
    current_day_name = now_ist.strftime("%A") # Thursday
    current_day_short = now_ist.strftime("%a") # Thu
    
    # Normalize settings working days for comparison
    normalized_working_days = [d.strip().lower() for d in working_days]
    is_working_day = (current_day_name.lower() in normalized_working_days or 
                      current_day_short.lower() in normalized_working_days)
    is_before_hours = now_min < open_min
    is_after_hours = now_min > close_min
    
    horizon = state.get("horizon_days", 1)
    
    # ── WORKDAY LOCKOUT & EFFECTIVE HORIZON ──
    # Business Rule: Until the current workday is over, focus perishables on Today's needs.
    is_workday_active = is_working_day and not is_after_hours and not is_before_hours
    
    alpha = base.get("trend_modifier", 1.0)
    
    if is_perishable:
        # Perishable Plan:
        # - For Today (0) or Tomorrow (1): Stick to a single day (or rest-of-day) supply for safety.
        # - For Week (7)+: Show total cumulative demand for planning, capped at 7 days.
        if horizon <= 1:
            if is_workday_active and horizon >= 1:
                effective_horizon = 0
            else:
                effective_horizon = min(1, horizon) if horizon >= 1 else 0
            
            # Application of Trend/Holiday Multiplier
            mu_p = usual_daily_demand * alpha
            mu_effective = mu_p if effective_horizon == 0 else (mu_p * max(1, effective_horizon))
            sigma_effective = (mu_p * 0.1) * math.sqrt(max(1, effective_horizon))
            proposed_qty_gross = int(mu_effective + (1.28 * sigma_effective))
        else:
            effective_horizon = horizon
            # Calculation: Trend-adjusted Daily Demand * Capped Horizon (7 days max for perishables)
            proposed_qty_gross = int((usual_daily_demand * alpha) * min(7, horizon))
    else:
        effective_horizon = horizon
        # Non-perishables use the already-calculated proposed_quantity (which is gross from ForecastingAgent)
        proposed_qty_gross = base.get("base_prediction", usual_daily_demand * (horizon or 1))
        # Also apply alpha to it
        proposed_qty_gross = int(proposed_qty_gross * alpha)

    # ── NET DEMAND CALCULATION (CENTRALIZED) ──
    net_demand = max(0, proposed_qty_gross - stock_quantity)
    # Calculates how much of the demand window (Today) remains.
    time_left_factor = 1.0
    if effective_horizon == 0:
        if not is_working_day or is_after_hours:
            time_left_factor = 0.0 # No more sales likely today
        elif is_before_hours:
            time_left_factor = 1.0 # Entire day is ahead
        else:
            total_work_min = close_min - open_min
            remaining_min = close_min - now_min
            if total_work_min > 0:
                # Buffer 30 mins before closing
                time_left_factor = max(0, (remaining_min - 30) / total_work_min)
                time_left_factor = min(1.0, time_left_factor)

    # Decision Support Options
    if is_perishable:
        scaled_demand = int(round(net_demand * time_left_factor))
        
        # Safety: If there is still significant day left (>50% and not a holiday), 
        # ensure we don't drop to 0 if stock is extremely low (< 20% of usual).
        if time_left_factor > 0.5 and alpha > 0.5 and stock_quantity < (usual_daily_demand * 0.2):
            scaled_demand = max(scaled_demand, 5) # Minimum viable order to prevent total stockout

        options = {
            "Conservative": int(round(scaled_demand * 0.8)),
            "Moderate": int(round(scaled_demand)),
            "Aggressive": int(round(scaled_demand * 1.1))
        }
    else:
        # For non-perishables, use the forecast
        options = {
            "Conservative": int(round(net_demand * 0.9)),
            "Moderate": int(round(net_demand)),
            "Aggressive": int(round(net_demand * 1.5))
        }

    # Final Recommended Quantity
    recommended_qty = options["Moderate"]
    
    # ── REAL CASH FLOW ANALYSIS ──
    cash_on_hand = state.get("cash_on_hand", 5000.0)
    unit_price = state.get("unit_price", 0.0)
    # Use cost_price if available, otherwise assume 75% of unit_price as a proxy for procurement cost
    cost_price = state.get("cost_price") or (unit_price * 0.75)
    
    order_cost = recommended_qty * cost_price
    
    # Liquidity Ratio: How much of current cash this order consumes
    actual_liquidity_ratio = order_cost / max(1, cash_on_hand)
    
    # ── HORIZON-AWARE CASH SENSITIVITY ──
    # Business Logic: 
    # - Today/Tmrw: Strict. Don't spend more than 80% of cash on ONE item.
    # - Week: Moderate. Can project higher usage (120% of current cash) assuming sales replenishment.
    # - Month: Flexible. Can project high usage (300% of current cash) for planning.
    
    risk_status = "Safe"
    if horizon <= 1:
        if actual_liquidity_ratio > 0.8:
            risk_status = "Unsafe"
    elif horizon <= 7:
        if actual_liquidity_ratio > 1.5:
            risk_status = "Unsafe"
    else:
        if actual_liquidity_ratio > 3.0:
            risk_status = "Unsafe"

    # Also keep the existing quantity-based safety check for perishables
    if horizon <= 1 and is_perishable and (recommended_qty > (usual_daily_demand * 1.5)):
        risk_status = "Unsafe"

    # Time Reason for Explanation
    if is_perishable:
        if is_working_day and not is_after_hours and not is_before_hours:
            time_reason = f"Today ({current_day_name}) is a working day. Based on the current time ({current_time_str}), the recommendation covers the remaining workday ({int(time_left_factor*100)}% of daily demand remaining until {close_time_str} closing)."
        elif is_working_day and is_before_hours:
            time_reason = f"Today ({current_day_name}) is a working day but hasn't started yet (opens at {open_time_str}). This recommendation covers the full upcoming workday."
        elif is_working_day and is_after_hours:
            time_reason = f"Today ({current_day_name}) is a working day but canteen operations have concluded (closed at {close_time_str}). We recommend zero new perishable stock to avoid overnight waste."
        elif not is_working_day:
            time_reason = f"Today ({current_day_name}) is NOT a scheduled working day. Minimal to zero perishable stock is recommended to prevent waste on a closed day."
        else:
            time_reason = "Canteen working hours have concluded. We recommend zero new perishable stock to avoid losses."
    else:
        if is_working_day:
            if is_after_hours:
                time_reason = f"Today ({current_day_name}) is a working day but operations have concluded (closed at {close_time_str}). This non-perishable item can be safely stocked for future use."
            elif is_before_hours:
                time_reason = f"Today ({current_day_name}) is a working day (opens at {open_time_str}). This non-perishable item can be stocked ahead of operations."
            else:
                time_reason = f"Today ({current_day_name}) is an active working day (operating until {close_time_str}). This non-perishable item can be safely stocked for extended periods."
        else:
            time_reason = f"Today ({current_day_name}) is NOT a scheduled working day. This non-perishable item can still be stocked safely as it won't expire, but demand is expected to be minimal."

    return {
        "recommended_qty": recommended_qty,
        "risk_status": risk_status,
        "liquidity_ratio": round(actual_liquidity_ratio, 4),
        "mdp_action": "APPROVE" if risk_status == "Safe" else "RECALCULATE",
        "profit_impact": (recommended_qty * (unit_price - cost_price)), # More accurate profit estimate
        "options": options,
        "is_perishable": is_perishable,
        "effective_horizon": effective_horizon,
        "time_left_factor": round(time_left_factor, 2),
        "time_reason": time_reason,
        "is_working_day": is_working_day,
        "cash_on_hand": cash_on_hand
    }

