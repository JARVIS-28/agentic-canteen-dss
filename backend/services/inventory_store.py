"""
In-memory inventory storage system for managing user items.
In production, this would be replaced with Supabase or similar database.
"""

from typing import Dict, List, Any
from datetime import datetime
from dataclasses import dataclass, field, asdict


@dataclass
class InventoryItem:
    """Represents a single inventory item with analysis results"""
    item_id: str
    user_id: str
    item_name: str
    unit_price: float
    usual_order_qty: int
    current_stock: int
    item_category: str
    created_at: str
    analysis: Dict[str, Any] = field(default_factory=dict)  # MASResponse data

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary"""
        return asdict(self)


class InventoryStore:
    """
    In-memory storage for user inventories.
    Thread-safe dictionary of user_id -> list of items
    """

    def __init__(self):
        self._store: Dict[str, List[InventoryItem]] = {}

    def add_item(self, user_id: str, item: InventoryItem) -> None:
        """Add item to user's inventory"""
        if user_id not in self._store:
            self._store[user_id] = []
        self._store[user_id].append(item)

    def get_user_items(self, user_id: str) -> List[InventoryItem]:
        """Get all items for a user"""
        return self._store.get(user_id, [])

    def get_item(self, user_id: str, item_id: str) -> InventoryItem | None:
        """Get a specific item"""
        items = self._store.get(user_id, [])
        return next((i for i in items if i.item_id == item_id), None)

    def update_item(self, user_id: str, item_id: str, updates: Dict[str, Any]) -> bool:
        """Update an item (merge updates)"""
        items = self._store.get(user_id, [])
        for item in items:
            if item.item_id == item_id:
                for key, value in updates.items():
                    setattr(item, key, value)
                return True
        return False

    def update_item_analysis(self, user_id: str, item_id: str, analysis: Dict[str, Any]) -> bool:
        """Update analysis results for an item"""
        items = self._store.get(user_id, [])
        for item in items:
            if item.item_id == item_id:
                item.analysis = analysis
                return True
        return False

    def delete_item(self, user_id: str, item_id: str) -> bool:
        """Delete an item"""
        if user_id not in self._store:
            return False
        self._store[user_id] = [i for i in self._store[user_id] if i.item_id != item_id]
        return True

    def user_exists(self, user_id: str) -> bool:
        """Check if user has any items"""
        return user_id in self._store and len(self._store[user_id]) > 0

    def get_items_by_category(self, user_id: str, category: str) -> List[InventoryItem]:
        """Get items in a specific category"""
        items = self._store.get(user_id, [])
        return [i for i in items if i.item_category.lower() == category.lower()]

    def clear_user(self, user_id: str) -> None:
        """Clear all items for a user"""
        if user_id in self._store:
            del self._store[user_id]

    def clear_all(self) -> None:
        """Clear entire store (for testing)"""
        self._store.clear()


# Global singleton instance
_inventory_store = InventoryStore()


def get_inventory_store() -> InventoryStore:
    """Get the global inventory store instance"""
    return _inventory_store
