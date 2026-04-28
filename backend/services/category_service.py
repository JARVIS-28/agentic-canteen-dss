"""
Category Service: Manages product categories and category-level analytics.
Provides predefined categories and allows users to create custom categories.
"""

import logging
from typing import List, Dict, Set, Optional

logger = logging.getLogger(__name__)

# ===========================
# PREDEFINED CATEGORIES
# ===========================

PREDEFINED_CATEGORIES: Dict[str, Dict[str, any]] = {
    "snacks": {
        "display_name": "Snacks",
        "description": "Chips, chaats, samosa, biscuits",
        "keywords": ["chips", "chaat", "samosa", "biscuits", "snack", "cracker"],
        "color": "#FFD700"  # Gold
    },
    "beverages": {
        "display_name": "Beverages",
        "description": "Coke, Sprite, juices, tea, coffee",
        "keywords": ["coke", "sprite", "juice", "tea", "coffee", "cold_drink", "beverage", "tropicana", "soda"],
        "color": "#8B4513"  # Saddle brown
    },
    "fast_food": {
        "display_name": "Fast Food",
        "description": "Burgers, pizzas, rolls, sandwiches",
        "keywords": ["burger", "pizza", "roll", "sandwich", "fast_food", "fries", "noodles"],
        "color": "#DC143C"  # Crimson
    },
    "dairy": {
        "display_name": "Dairy",
        "description": "Milkymist, milkshakes, curd, lassi",
        "keywords": ["milkymist", "milkshake", "curd", "lassi", "milk", "dairy", "calvins"],
        "color": "#4169E1"  # Royal blue
    },
    "meals": {
        "display_name": "Meals",
        "description": "Lunch combos, thalis, rice bowls",
        "keywords": ["meal", "thali", "rice", "combo", "lunch"],
        "color": "#32CD32"  # Lime green
    },
    "bakery": {
        "display_name": "Bakery",
        "description": "Puffs, cakes, breads, pastries",
        "keywords": ["puff", "cake", "bread", "pastry", "bakery", "pie"],
        "color": "#FF8C00"  # Dark orange
    },
    "general": {
        "display_name": "General",
        "description": "Miscellaneous canteen items",
        "keywords": ["miscellaneous", "general", "other"],
        "color": "#808080"  # Gray
    }
}


# ===========================
# CATEGORY MANAGEMENT
# ===========================

def get_predefined_categories() -> Dict[str, Dict[str, any]]:
    """Get all predefined categories"""
    return PREDEFINED_CATEGORIES.copy()


def get_category_names() -> List[str]:
    """Get list of all predefined category names"""
    return list(PREDEFINED_CATEGORIES.keys())


def get_category_keywords() -> Dict[str, List[str]]:
    """Get keyword mapping for all categories (for auto-classification)"""
    return {
        cat: details["keywords"]
        for cat, details in PREDEFINED_CATEGORIES.items()
    }


def classify_item_to_category(item_name: str) -> str:
    """
    Auto-classify item to a category based on keyword matching.

    Args:
        item_name: Name of the item

    Returns:
        category name or "general" if no match
    """
    item_lower = item_name.lower()

    for category, details in PREDEFINED_CATEGORIES.items():
        for keyword in details["keywords"]:
            if keyword.lower() in item_lower or item_lower in keyword.lower():
                logger.debug(f"Classified '{item_name}' to '{category}'")
                return category

    logger.debug(f"Could not classify '{item_name}', using 'general'")
    return "general"


def validate_category(category_name: str) -> bool:
    """Check if category exists in predefined categories"""
    return category_name. lower() in PREDEFINED_CATEGORIES


def get_category_info(category_name: str) -> Optional[Dict[str, any]]:
    """Get detailed info about a category"""
    return PREDEFINED_CATEGORIES.get(category_name.lower())


# ===========================
# MULTI-LEVEL ANALYTICS
# ===========================

class CategoryAnalytics:
    """Aggregates metrics at category level"""

    def __init__(self, category: str):
        self.category = category
        self.items = []
        self.total_stock = 0
        self.total_recommended = 0
        self.total_spend = 0.0
        self.trend_modifiers = []
        self.risk_statuses = []

    def add_item(self, item_analysis: Dict[str, any]):
        """Add item analysis to category aggregate"""
        self.items.append(item_analysis)
        self.total_stock += item_analysis.get("current_stock", 0)
        self.total_recommended += item_analysis.get("recommended_qty", 0)
        self.total_spend += item_analysis.get("recommended_qty", 0) * item_analysis.get("unit_price", 0)
        self.trend_modifiers.append(item_analysis.get("trend_modifier", 1.0))
        self.risk_statuses.append(item_analysis.get("risk_status", "Safe"))

    def get_aggregate_trend_modifier(self) -> float:
        """Get category-level trend modifier (average)"""
        if not self.trend_modifiers:
            return 1.0
        return sum(self.trend_modifiers) / len(self.trend_modifiers)

    def get_category_risk_status(self) -> str:
        """Get category-level risk status"""
        if not self.risk_statuses:
            return "Safe"

        # If any item is Unsafe, category is at risk
        if any(status == "Unsafe" for status in self.risk_statuses):
            return "Warning"

        # If all items are Safe
        return "Safe"

    def to_dict(self) -> Dict[str, any]:
        """Convert to dictionary for API response"""
        return {
            "category": self.category,
            "total_items": len(self.items),
            "total_current_stock": self.total_stock,
            "total_recommended_stock": self.total_recommended,
            "total_spend_required": round(self.total_spend, 2),
            "category_trend_modifier": round(self.get_aggregate_trend_modifier(), 3),
            "category_risk_status": self.get_category_risk_status(),
            "items": self.items,
        }


class PortfolioAnalytics:
    """Aggregates metrics at portfolio level"""

    def __init__(self, user_id: str):
        self.user_id = user_id
        self.categories: Dict[str, CategoryAnalytics] = {}
        self.total_items = 0
        self.total_cash_used = 0.0
        self.total_cash_available = 0.0
        self.all_items_analysis = []

    def add_item_analysis(self, item_analysis: Dict[str, any]):
        """Add item analysis to portfolio"""
        category = item_analysis.get("item_category", "general")

        if category not in self.categories:
            self.categories[category] = CategoryAnalytics(category)

        self.categories[category].add_item(item_analysis)
        self.total_items += 1
        self.total_cash_used += item_analysis.get("recommended_qty", 0) * item_analysis.get("unit_price", 0)
        self.all_items_analysis.append(item_analysis)

    def set_cash_available(self, cash: float):
        """Set available cash for liquidity calculation"""
        self.total_cash_available = cash

    def get_portfolio_risk_status(self) -> str:
        """Get portfolio-level risk status"""
        if not self.categories:
            return "Safe"

        category_risks = [cat.get_category_risk_status() for cat in self.categories.values()]

        if any(risk == "Warning" for risk in category_risks):
            return "Warning"

        return "Safe"

    def get_priority_reorder_list(self, limit: int = 10) -> List[Dict[str, any]]:
        """Get priority list of items to reorder"""
        # Sort by (current_stock / usual_order_qty) ratio (ascending)
        items_sorted = sorted(
            self.all_items_analysis,
            key=lambda x: x.get("current_stock", 0) / max(x.get("usual_order_qty", 1), 1)
        )

        return items_sorted[:limit]

    def to_dict(self) -> Dict[str, any]:
        """Convert to dictionary for API response"""
        category_analyses = {
            cat_name: cat.to_dict()
            for cat_name, cat in self.categories.items()
        }

        return {
            "user_id": self.user_id,
            "total_items": self.total_items,
            "total_cash_utilized": round(self.total_cash_used, 2),
            "cash_available": round(self.total_cash_available, 2),
            "utilization_percentage": round((self.total_cash_used / self.total_cash_available * 100) if self.total_cash_available > 0 else 0, 2),
            "portfolio_risk_status": self.get_portfolio_risk_status(),
            "overall_modifier": round(
                sum(c.get_aggregate_trend_modifier() for c in self.categories.values()) / len(self.categories)
                if self.categories else 1.0,
                3
            ),
            "category_analyses": category_analyses,
            "priority_reorder_list": self.get_priority_reorder_list(),
        }
