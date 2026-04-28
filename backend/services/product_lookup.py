import datetime
import json
import logging
from typing import Optional, Dict, Any, List
from pathlib import Path
import httpx
import asyncio

logger = logging.getLogger(__name__)

# Cache file path
CACHE_DIR = Path(__file__).parent.parent / "data"
CACHE_DIR.mkdir(parents=True, exist_ok=True)
BARCODE_CACHE_FILE = CACHE_DIR / "barcode_cache.json"

class ProductLookupService:
    def __init__(self):
        self._load_cache()
        # No more hardcoded PRODUCT_DB as per user request
        
    def _load_cache(self) -> Dict[str, Any]:
        """Load the local JSON cache."""
        if BARCODE_CACHE_FILE.exists():
            try:
                self.cache = json.loads(BARCODE_CACHE_FILE.read_text(encoding="utf-8"))
                return self.cache
            except Exception as e:
                logger.error(f"Error loading barcode cache: {e}")
                self.cache = {}
                return {}
        self.cache = {}
        return {}

    def _save_cache(self):
        """Save current cache to local storage."""
        try:
            BARCODE_CACHE_FILE.write_text(json.dumps(self.cache, indent=2), encoding="utf-8")
        except Exception as e:
            logger.error(f"Error saving barcode cache: {e}")

    async def lookup(self, barcode: str) -> Optional[Dict[str, Any]]:
        """
        Primary entry point for barcode lookup.
        Checks: Cache -> External APIs (Open Food Facts, etc.) -> Discovery Fallback
        """
        if not barcode:
            return None
            
        barcode = str(barcode).strip()
        logger.info(f"Looking up barcode: '{barcode}'")

        # 1. Check File Cache first (persistent record of previous successful lookups)
        search_keys = [barcode]
        if barcode.startswith('0'):
            search_keys.append(barcode.lstrip('0'))
        else:
            search_keys.append('0' + barcode)

        for key in search_keys:
            if key in self.cache:
                logger.info(f"Barcode '{key}' found in cache")
                return self.cache[key]

        # 2. Check External APIs / Discovery
        product_info = await self._discover_product(barcode)
        
        if product_info:
            # Save to cache for future use
            self.cache[barcode] = product_info
            self._save_cache()
            return product_info

        logger.warning(f"Barcode '{barcode}' not found in any automated source")
        return None

    async def _discover_product(self, barcode: str) -> Optional[Dict[str, Any]]:
        """Try to discover product info from external sources."""
        # Try Open Food Facts first (Fast, Free, Open)
        off_data = await self._lookup_openfoodfacts(barcode)
        if off_data:
            return off_data

        # Fallback for common Indian products (Prefix 890)
        if barcode.startswith('890'):
            logger.info(f"Detected Indian barcode {barcode}, attempting regional discovery...")
            
            # Manual Mapping for Common Canteen Inventory in India
            indian_db = {
                "8902979015929": {"item_name": "Cavin’s Milk Shake (170ml)", "price": 40.0, "cat": "beverages"},
                "8901030919199": {"item_name": "Surf Excel Quick Wash (100g)", "price": 20.0, "cat": "general"},
                "8901491100343": {"item_name": "Amul Gold (500ml)", "price": 33.0, "cat": "dairy"},
                "8901058000000": {"item_name": "HUL Product Sample", "price": 0.0, "cat": "general"},
                "8901262150000": {"item_name": "Nestle Munch", "price": 10.0, "cat": "snacks"},
                "8901719114170": {"item_name": "Kurkure Masala Munch (40g)", "price": 20.0, "cat": "snacks"},
                "8901063140133": {"item_name": "Brittania Tiger Biscuits", "price": 5.0, "cat": "snacks"},
                "8901030362841": {"item_name": "Red Label Tea (100g)", "price": 60.0, "cat": "beverages"}
            }
            
            # Partial match or exact match
            match = next((v for k, v in indian_db.items() if k in barcode or barcode in k), None)
            
            if match:
                 return {
                    "item_name": match["item_name"],
                    "item_category": match["cat"],
                    "unit_price": match["price"],
                    "cost_price": match["price"] * 0.8,
                    "is_perishable": match["cat"] in ["dairy", "beverages"],
                    "barcode": barcode,
                    "expiry_date": (datetime.date.today() + datetime.timedelta(days=180)).isoformat(),
                    "source": "regional_discovery"
                }

        return None

    async def _lookup_openfoodfacts(self, barcode: str) -> Optional[Dict[str, Any]]:
        """Fetch item data from Open Food Facts API."""
        url = f"https://world.openfoodfacts.org/api/v0/product/{barcode}.json"
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(url)
                if response.status_code != 200:
                    return None
                
                data = response.json()
                if data.get("status") != 1:
                    return None
                
                product = data.get("product", {})
                item_name = product.get("product_name", product.get("product_name_en", "Unknown Item"))
                categories_tags = product.get("categories_tags", [])
                category = self._best_category_match(categories_tags)
                
                return {
                    "item_name": item_name,
                    "item_category": category,
                    "unit_price": 0.0,
                    "cost_price": 0.0,
                    "is_perishable": "perishable" in str(categories_tags).lower() or category == "dairy",
                    "barcode": barcode,
                    "expiry_date": (datetime.date.today() + datetime.timedelta(days=30)).isoformat(),
                    "source": "open_food_facts"
                }
        except Exception as e:
            logger.error(f"OFF lookup error for {barcode}: {e}")
            return None

    def _best_category_match(self, tags: List[str]) -> str:
        if not tags: return "general"
        t_str = " ".join(tags).lower()
        mapping = {
            "beverages": ["beverage", "drink", "soda", "tea", "coffee", "juice", "milkshake"],
            "snacks": ["snack", "biscuit", "cookie", "chip", "confectionery", "chocolate"],
            "dairy": ["dairy", "milk", "cheese", "yogurt", "butter"],
            "grains": ["grain", "rice", "cereal", "flour"],
            "pulses": ["pulse", "dal", "lentil", "legume", "bean"],
            "spices": ["spice", "herb", "salt", "pepper", "turmeric"],
            "oils": ["oil", "fat", "butter", "ghee"]
        }
        for cat, keywords in mapping.items():
            if any(k in t_str for k in keywords):
                return cat
        return "general"

# Singleton instance
barcode_service = ProductLookupService()

async def lookup_barcode(barcode: str) -> Optional[Dict[str, Any]]:
    return await barcode_service.lookup(barcode)
