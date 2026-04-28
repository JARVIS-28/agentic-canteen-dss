"""
Portfolio Analysis Service

Aggregates individual item analyses into category-level and portfolio-level insights,
generates priority reorder lists, and provides business intelligence recommendations.
"""

from typing import List, Dict, Any
from services.inventory_store import InventoryStore, InventoryItem
from services.category_service import PREDEFINED_CATEGORIES


def get_category_display_name(category: str) -> str:
    """Get display name for a category"""
    for cat in PREDEFINED_CATEGORIES:
        if cat["name"].lower() == category.lower():
            return cat["display_name"]
    return category.title()


def analyze_category_items(
    items: List[InventoryItem],
    category: str
) -> Dict[str, Any]:
    """
    Analyze all items in a specific category.

    Returns aggregated metrics like:
    - Total current stock
    - Total recommended stock
    - Average trend modifier
    - Risk status for category
    - All items in category with their analyses
    """
    category_items = [i for i in items if i.item_category.lower() == category.lower()]

    if not category_items:
        return {
            "category": category,
            "display_name": get_category_display_name(category),
            "total_items": 0,
            "total_current_stock": 0,
            "total_recommended_stock": 0,
            "total_spend_required": 0.0,
            "category_trend_modifier": 1.0,
            "category_risk_status": "Safe",
            "items": [],
            "avg_confidence": 0.0,
        }

    total_current = sum(i.current_stock for i in category_items)
    total_recommended = 0
    total_spend = 0.0
    trend_modifiers = []
    risk_statuses = []
    confidences = []

    items_with_analysis = []

    for item in category_items:
        analysis = item.analysis or {}

        recommended_qty = analysis.get("recommended_qty", item.usual_order_qty)
        total_recommended += recommended_qty

        spend = recommended_qty * item.unit_price
        total_spend += spend

        trend_mod = analysis.get("trend_modifier", 1.0)
        trend_modifiers.append(trend_mod)

        risk = analysis.get("risk_status", "Unknown")
        risk_statuses.append(risk)

        conf = analysis.get("forecast_confidence", 0.0)
        confidences.append(conf)

        items_with_analysis.append({
            "item_id": item.item_id,
            "item_name": item.item_name,
            "current_stock": item.current_stock,
            "recommended_qty": recommended_qty,
            "spend_required": spend,
            "unit_price": item.unit_price,
            "trend_modifier": trend_mod,
            "risk_status": risk,
            "forecast_confidence": conf,
            "profit_impact": analysis.get("profit_impact", 0.0),
        })

    # Determine category risk status
    critical_items = sum(1 for r in risk_statuses if r == "Critical")
    warning_items = sum(1 for r in risk_statuses if r == "Warning")

    if critical_items > 0:
        category_risk = "Critical"
    elif warning_items >= len(category_items) * 0.5:  # More than 50% warning
        category_risk = "Warning"
    else:
        category_risk = "Safe"

    # Average trend modifier
    avg_trend = sum(trend_modifiers) / len(trend_modifiers) if trend_modifiers else 1.0
    avg_confidence = sum(confidences) / len(confidences) if confidences else 0.0

    return {
        "category": category,
        "display_name": get_category_display_name(category),
        "total_items": len(category_items),
        "total_current_stock": total_current,
        "total_recommended_stock": total_recommended,
        "total_spend_required": total_spend,
        "category_trend_modifier": round(avg_trend, 2),
        "category_risk_status": category_risk,
        "avg_confidence": round(avg_confidence, 2),
        "items": items_with_analysis,
    }


def generate_priority_reorder_list(
    items: List[InventoryItem],
    cash_available: float
) -> List[Dict[str, Any]]:
    """
    Generate a priority reorder list based on:
    1. Risk status (Critical > Warning > Safe)
    2. Trend modifier (higher = more urgent)
    3. Stock depletion timeline
    4. Available cash (Cumulative budget allocation up to cash_available)

    Returns items sorted by urgency, capped strictly at cash_available spent sum.
    """
    reorder_candidates = []

    for item in items:
        analysis = item.analysis or {}

        recommended_qty = analysis.get("recommended_qty", item.usual_order_qty)
        spend_required = recommended_qty * item.unit_price

        risk_status = analysis.get("risk_status", "Safe")
        trend_modifier = analysis.get("trend_modifier", 1.0)
        forecast_confidence = analysis.get("forecast_confidence", 0.0)
        profit_impact = analysis.get("profit_impact", 0.0)

        # Calculate urgency score (0-100)
        risk_score = {"Critical": 100, "Warning": 60, "Safe": 20}.get(risk_status, 20)
        demand_score = min(100, trend_modifier * 30)  # Trend modifier scaled to 0-100
        confidence_score = forecast_confidence * 100

        # Weighted urgency (40% risk, 35% demand, 25% confidence)
        urgency = (risk_score * 0.4) + (demand_score * 0.35) + (confidence_score * 0.25)

        reorder_candidates.append({
            "item_id": item.item_id,
            "item_name": item.item_name,
            "category": item.item_category,
            "current_stock": item.current_stock,
            "recommended_qty": recommended_qty,
            "spend_required": spend_required,
            "unit_price": item.unit_price,
            "risk_status": risk_status,
            "trend_modifier": trend_modifier,
            "urgency_score": round(urgency, 1),
            "profit_potential": profit_impact,
            "reasoning": _generate_reorder_reason(
                item, risk_status, trend_modifier, analysis.get("explanation_english", "")
            ),
        })

    # 1. Sort by urgency (descending)
    reorder_candidates.sort(key=lambda x: x["urgency_score"], reverse=True)

    # 2. Greedy Budget Allocation (Knapsack)
    final_list = []
    cumulative_spend = 0.0
    
    for candidate in reorder_candidates:
        if cumulative_spend + candidate["spend_required"] <= cash_available:
            cumulative_spend += candidate["spend_required"]
            candidate["cumulative_spend"] = cumulative_spend
            final_list.append(candidate)
        else:
            # Drop item or could do partial quantity allocation if desired, but strict list is safer
            continue

    return final_list



def _generate_reorder_reason(
    item: InventoryItem,
    risk_status: str,
    trend_modifier: float,
    explanation: str
) -> str:
    """Generate human-readable reason for reorder priority"""
    reasons = []

    if risk_status == "Critical":
        reasons.append("Stock critically low")
    elif risk_status == "Warning":
        reasons.append("Stock running low")

    if trend_modifier > 1.5:
        reasons.append("High demand detected")
    elif trend_modifier > 1.2:
        reasons.append("Growing demand")

    if not reasons:
        reasons.append("Balanced stock level")

    return "; ".join(reasons)


def compute_portfolio_analytics(
    items: List[InventoryItem],
    cash_on_hand: float,
    user_location: str = "Delhi"
) -> Dict[str, Any]:
    """
    Compute comprehensive portfolio-level analytics.

    Aggregates all items into:
    - Category-level summaries
    - Portfolio-level metrics
    - Priority reorder list
    - Risk assessment
    """

    if not items:
        return {
            "user_id": items[0].user_id if items else "unknown",
            "total_items": 0,
            "total_current_stock": 0,
            "total_cash_utilized": 0.0,
            "cash_available": cash_on_hand,
            "utilization_percentage": 0.0,
            "portfolio_risk_status": "Safe",
            "overall_modifier": 1.0,
            "category_analyses": {},
            "priority_reorder_list": [],
            "avg_forecast_confidence": 0.0,
            "insights": [],
        }

    user_id = items[0].user_id

    # Compute category analyses
    categories = set(i.item_category for i in items)
    category_analyses = {}

    for category in categories:
        cat_analysis = analyze_category_items(items, category)
        category_analyses[category] = cat_analysis

    # Portfolio-wide metrics
    total_current = sum(i.current_stock for i in items)
    total_recommended = 0
    total_cash_used = 0.0
    risk_statuses = []
    trend_modifiers = []
    confidences = []

    for item in items:
        analysis = item.analysis or {}
        recommended_qty = analysis.get("recommended_qty", item.usual_order_qty)
        total_recommended += recommended_qty
        cash_used = recommended_qty * item.unit_price
        total_cash_used += cash_used

        risk_statuses.append(analysis.get("risk_status", "Safe"))
        trend_modifiers.append(analysis.get("trend_modifier", 1.0))
        confidences.append(analysis.get("forecast_confidence", 0.0))

    # Determine portfolio risk
    critical_items = sum(1 for r in risk_statuses if r == "Critical")
    warning_items = sum(1 for r in risk_statuses if r == "Warning")

    if critical_items > 0:
        portfolio_risk = "Critical"
    elif warning_items >= len(items) * 0.4:  # More than 40% warning
        portfolio_risk = "Warning"
    else:
        portfolio_risk = "Safe"

    # Utilization percentage
    max_cash_available = cash_on_hand + (total_cash_used * 0.2)  # Conservative estimate
    utilization_pct = (total_cash_used / max_cash_available * 100) if max_cash_available > 0 else 0

    # Priority reorder list
    priority_list = generate_priority_reorder_list(items, cash_on_hand * 0.8)  # Keep 20% reserve

    # Generate insights
    insights = _generate_portfolio_insights(
        items, category_analyses, portfolio_risk, priority_list, trend_modifiers
    )

    return {
        "user_id": user_id,
        "total_items": len(items),
        "total_current_stock": total_current,
        "total_recommended_stock": total_recommended,
        "total_cash_utilized": total_cash_used,
        "cash_available": cash_on_hand,
        "utilization_percentage": round(utilization_pct, 2),
        "portfolio_risk_status": portfolio_risk,
        "overall_modifier": round(sum(trend_modifiers) / len(trend_modifiers), 2) if trend_modifiers else 1.0,
        "avg_forecast_confidence": round(sum(confidences) / len(confidences) * 100, 1) if confidences else 0.0,
        "category_analyses": category_analyses,
        "priority_reorder_list": priority_list[:20],  # Top 20 items
        "insights": insights,
    }


def _generate_portfolio_insights(
    items: List[InventoryItem],
    category_analyses: Dict[str, Any],
    portfolio_risk: str,
    priority_list: List[Dict[str, Any]],
    trend_modifiers: List[float]
) -> List[Dict[str, str]]:
    """Generate actionable insights for the portfolio"""
    insights = []

    # Risk insights
    if portfolio_risk == "Critical":
        insights.append({
            "type": "risk",
            "severity": "high",
            "message": "⚠️ CRITICAL: Multiple items at risk. Prioritize reorders.",
        })
    elif portfolio_risk == "Warning":
        insights.append({
            "type": "risk",
            "severity": "medium",
            "message": "⚠️ WARNING: Some items have low stock. Review priority list.",
        })
    else:
        insights.append({
            "type": "status",
            "severity": "low",
            "message": "✓ Portfolio risk is well-managed.",
        })

    # Demand trends
    avg_modifier = sum(trend_modifiers) / len(trend_modifiers) if trend_modifiers else 1.0
    if avg_modifier > 1.5:
        insights.append({
            "type": "opportunity",
            "severity": "high",
            "message": f"📈 HIGH DEMAND: Average trend modifier at {avg_modifier:.1f}x. Strong selling opportunity.",
        })
    elif avg_modifier < 0.8:
        insights.append({
            "type": "opportunity",
            "severity": "low",
            "message": f"📉 LOW DEMAND: Average trend modifier at {avg_modifier:.1f}x. Reduce stock levels.",
        })

    # Category balance
    high_risk_categories = [
        cat for cat, analysis in category_analyses.items()
        if analysis.get("category_risk_status") == "Critical"
    ]
    if high_risk_categories:
        insights.append({
            "type": "category",
            "severity": "medium",
            "message": f"Focus on {', '.join(high_risk_categories)} - these categories need attention.",
        })

    # Top opportunity
    if priority_list:
        top_item = priority_list[0]
        insights.append({
            "type": "action",
            "severity": "high",
            "message": f"🎯 TOP PRIORITY: Reorder {top_item['item_name']} ({top_item['recommended_qty']} units, ₹{top_item['spend_required']:.0f})",
        })

    return insights
