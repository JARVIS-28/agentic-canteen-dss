import datetime
import json
import logging
import httpx
from typing import Optional, Dict, Any, List
from pathlib import Path

logger = logging.getLogger(__name__)

# --- Configuration ---
DATA_DIR = Path(__file__).parent.parent / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)
MASTER_DATABASE_FILE = DATA_DIR / "barcode_master_db.json"

class BarcodeIntelligenceService:
    """
    A premium barcode identification service focusing on the Indian market.
    Integrates Open Food Facts, Regional Manufacturer Patterns, and a Local Master DB.
    """
    
    def __init__(self):
        self.local_db = self._load_master_db()
        # Mapping of Indian GS1 Prefixes to Manufacturers
        self.manufacturer_map = {
            "890103": "Hindustan Unilever (HUL)",
            "890104": "ITC Limited",
            "890105": "Dabur India",
            "890106": "Britannia Industries",
            "890108": "Godrej Consumer Products",
            "890113": "Haldiram's",
            "890126": "Nestle India",
            "890149": "Amul (GCMMF)",
            "890157": "Parle Products",
            "890171": "PepsiCo India (Lays/Kurkure)",
            "890257": "Marico Limited",
            "890600": "Patanjali Ayurved",
            "890400": "Colgate-Palmolive India",
            "890800": "Mother Dairy",
            "890115": "MTR Foods",
            "890111": "Bikanervala (Bikano)",
            "890120": "Cadbury / Mondelez India"
        }

    def _load_master_db(self) -> Dict[str, Any]:
        """Load a local curated database of Indian canteen items."""
        if MASTER_DATABASE_FILE.exists():
            try:
                return json.loads(MASTER_DATABASE_FILE.read_text(encoding="utf-8"))
            except:
                pass
        
        # Default starting DB for a typical Indian canteen
        default_db = {
            "8902979015929": {"name": "Cavin's Premium Malt Milk Shake", "cat": "beverages", "unit": "170ml", "price": 40},
            "8901719114170": {"name": "Kurkure Masala Munch", "cat": "snacks", "unit": "40g", "price": 20},
            "8901262150009": {"name": "Nestle Munch Chocolate", "cat": "snacks", "unit": "pack", "price": 10},
            "8901491100343": {"name": "Amul Gold Full Cream Milk", "cat": "dairy", "unit": "500ml", "price": 33},
            "8901571101011": {"name": "Parle-G Biscuits", "cat": "snacks", "unit": "80g", "price": 5},
            "8901030362841": {"name": "Red Label Tea", "cat": "beverages", "unit": "100g", "price": 60},
            "8901491502017": {"name": "Amul Kool Koko", "cat": "beverages", "unit": "180ml", "price": 30},
            "8901719101071": {"name": "Lay's Classic Salted", "cat": "snacks", "unit": "30g", "price": 20},
            "8901200000010": {"name": "Cadbury Dairy Milk", "cat": "snacks", "unit": "13g", "price": 10}
        }
        
        # Save default if not exists
        if not MASTER_DATABASE_FILE.exists():
            MASTER_DATABASE_FILE.write_text(json.dumps(default_db, indent=2), encoding="utf-8")
        
        return default_db

    async def identify(self, barcode: str) -> Optional[Dict[str, Any]]:
        """Identify a product using multiple strategies."""
        if not barcode: return None
        barcode = str(barcode).strip()
        
        # Step 1: Local Master Database (Fastest)
        if barcode in self.local_db:
            item = self.local_db[barcode]
            return {
                "item_name": item["name"],
                "item_category": item["cat"],
                "unit_price": float(item.get("price", 0.0)),
                "cost_price": float(item.get("price", 0.0)) * 0.85,
                "is_perishable": item["cat"] in ["dairy", "beverages"],
                "barcode": barcode,
                "brand": self._guess_brand(barcode),
                "source": "master_db",
                "confidence": 1.0
            }

        # Step 2: Open Food Facts API (Global Search)
        off_data = await self._lookup_openfoodfacts(barcode)
        if off_data:
            off_data["brand"] = off_data.get("brand") or self._guess_brand(barcode)
            return off_data

        # Step 3: Heuristic Intelligence (Manufacturer Lookup)
        if barcode.startswith("890"):
            brand = self._guess_brand(barcode)
            if brand != "Unknown brand":
                return {
                    "item_name": f"{brand} Product (Generic)",
                    "item_category": "general",
                    "unit_price": 0.0,
                    "cost_price": 0.0,
                    "is_perishable": False,
                    "barcode": barcode,
                    "brand": brand,
                    "source": "heuristic_engine",
                    "confidence": 0.5,
                    "suggestion": "We identified the manufacturer but need product name."
                }

        return None

    def _guess_brand(self, barcode: str) -> str:
        """Guess the brand based on GS1 manufacturer prefix."""
        for prefix, brand in self.manufacturer_map.items():
            if barcode.startswith(prefix):
                return brand
        return "Unknown brand"

    async def _lookup_openfoodfacts(self, barcode: str) -> Optional[Dict[str, Any]]:
        """Fetch item data from Open Food Facts API with enhanced mapping."""
        url = f"https://world.openfoodfacts.org/api/v0/product/{barcode}.json"
        try:
            async with httpx.AsyncClient(timeout=6.0) as client:
                response = await client.get(url)
                if response.status_code != 200:
                    return None
                
                data = response.json()
                if data.get("status") != 1:
                    return None
                
                product = data.get("product", {})
                item_name = product.get("product_name", product.get("product_name_en", "Unknown Item"))
                
                # Cleanup brand from product data
                brand = product.get("brands", "")
                if "," in brand: brand = brand.split(",")[0]
                
                categories_tags = product.get("categories_tags", [])
                category = self._best_category_match(categories_tags)
                
                return {
                    "item_name": item_name,
                    "item_category": category,
                    "unit_price": 0.0,
                    "cost_price": 0.0,
                    "is_perishable": "perishable" in str(categories_tags).lower() or category == "dairy",
                    "barcode": barcode,
                    "brand": brand,
                    "source": "open_food_facts",
                    "confidence": 0.9,
                    "image_url": product.get("image_url")
                }
        except Exception as e:
            logger.error(f"OFF lookup error: {e}")
            return None

    def _best_category_match(self, tags: List[str]) -> str:
        if not tags: return "general"
        t_str = " ".join(tags).lower()
        mapping = {
            "beverages": ["beverage", "drink", "soda", "tea", "coffee", "juice", "milkshake"],
            "snacks": ["snack", "biscuit", "cookie", "chip", "confectionery", "chocolate", "namkeen"],
            "dairy": ["dairy", "milk", "cheese", "yogurt", "butter"],
            "grains": ["grain", "rice", "cereal", "flour"],
            "personal care": ["soap", "shampoo", "toothpaste", "beauty"],
            "home care": ["detergent", "cleaner", "dishwash"]
        }
        for cat, keywords in mapping.items():
            if any(k in t_str for k in keywords):
                return cat
        return "general"

# Singleton instance
intel_service = BarcodeIntelligenceService()
