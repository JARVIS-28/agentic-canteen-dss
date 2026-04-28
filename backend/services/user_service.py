"""
User Service: Manages user registration, profiles, and inventory imports.
Handles:
- User registration with phone number validation
- CSV bulk import of inventory items
- User profile updates
- User location and language preferences
"""

import io
import csv
import re
import logging
from typing import List, Dict, Any, Optional
import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr, validator

logger = logging.getLogger(__name__)

# ===========================
# DATA MODELS
# ===========================

class UserRegister(BaseModel):
    """User registration data"""
    phone_number: str
    shop_name: str
    city: str                            # e.g., "PES EC Campus", "Bangalore"
    language_preference: str = "english" # "english", "hinglish", "hindi"
    cash_on_hand: float = 5000.0

    @validator('phone_number')
    def validate_phone(cls, v):
        """Validate Indian phone number format"""
        # Remove common formatting
        v = re.sub(r'[\s\-\+]', '', v)

        # Check if it's 10 digits
        if not re.match(r'^\d{10}$', v):
            raise ValueError('Phone number must be 10 digits')

        return v

    @validator('language_preference')
    def validate_language(cls, v):
        allowed = ["english", "hinglish", "hindi"]
        if v not in allowed:
            raise ValueError(f'Language must be one of {allowed}')
        return v


class UserProfile(BaseModel):
    """User profile information"""
    user_id: str
    phone_number: str
    shop_name: str
    city: str
    language_preference: str
    cash_on_hand: float
    created_at: str              # ISO datetime
    total_items: int = 0
    total_inventory_value: float = 0.0


class UserProfileUpdate(BaseModel):
    """Update user profile"""
    shop_name: Optional[str] = None
    city: Optional[str] = None
    language_preference: Optional[str] = None
    cash_on_hand: Optional[float] = None


class InventoryItemCSV(BaseModel):
    """Expected CSV row format"""
    item_name: str
    unit_price: float
    cost_price: float = 0.0
    usual_order_qty: int = 10
    current_stock: int = 0
    category: str = "general"
    is_perishable: bool = False
    expiry_date: Optional[str] = None
    barcode: Optional[str] = None

    @validator('unit_price', 'usual_order_qty')
    def validate_positive(cls, v):
        if v <= 0:
            raise ValueError('Must be greater than 0')
        return v

    @validator('current_stock')
    def validate_non_negative(cls, v):
        if v < 0:
            raise ValueError('Must be >= 0')
        return v


class ImportResult(BaseModel):
    """Result of CSV import"""
    user_id: str
    items_imported: int
    items_failed: int
    failed_rows: List[Dict[str, Any]] = []
    created_at: str
    total_inventory_value: float = 0.0


# ===========================
# PREDEFINED CATEGORIES
# ===========================

PREDEFINED_CATEGORIES = [
    "grains",       # rice, wheat, maize, millets
    "pulses",       # dal, lentils, chickpeas, beans
    "dairy",        # milk, ghee, buttermilk, paneer, curd
    "meat",         # chicken, mutton, fish
    "snacks",       # biscuits, chips, namkeen, cookies
    "cleaning",     # soap, detergent, bleach
    "washing",      # laundry_detergent, fabric_softener
    "hygiene",      # toothpaste, shampoo, deodorant
    "spices",       # turmeric, salt, chili, cinnamon
    "oils",         # cooking_oil, coconut_oil, mustard_oil
    "sweets",       # sugar, jaggery, sweetener
    "beverages",    # tea, coffee, cold_drinks
]

# ===========================
# CITY MAPPINGS (for weather API)
# ===========================

CITY_TO_COORDINATES = {
    "PES EC Campus": {"lat": 12.8615, "lon": 77.6647},
    "Delhi": {"lat": 28.7041, "lon": 77.1025},
    "Mumbai": {"lat": 19.0760, "lon": 72.8777},
    "Bangalore": {"lat": 12.9716, "lon": 77.5946},
    "Hyderabad": {"lat": 17.3850, "lon": 78.4867},
    "Chennai": {"lat": 13.0827, "lon": 80.2707},
    "Kolkata": {"lat": 22.5726, "lon": 88.3639},
    "Pune": {"lat": 18.5204, "lon": 73.8567},
    "Jaipur": {"lat": 26.9124, "lon": 75.7873},
    "Lucknow": {"lat": 26.8467, "lon": 80.9462},
    "Ahmedabad": {"lat": 23.0225, "lon": 72.5714},
    "Chandigarh": {"lat": 30.7333, "lon": 76.8277},
    "Visakhapatnam": {"lat": 17.6869, "lon": 83.2185},
    "Surat": {"lat": 21.1458, "lon": 72.1544},
    "Vadodara": {"lat": 22.3072, "lon": 73.1812},
    "Bhopal": {"lat": 23.1815, "lon": 79.9864},
}


# ===========================
# USER SERVICE FUNCTIONS
# ===========================

def generate_user_id() -> str:
    """Generate unique user ID"""
    return str(uuid.uuid4())


def create_user(user_data: UserRegister) -> UserProfile:
    """
    Create a new user (would be persisted to Supabase in production).

    For now, returns a profile with generated user_id.
    """
    user_id = generate_user_id()

    profile = UserProfile(
        user_id=user_id,
        phone_number=user_data.phone_number,
        shop_name=user_data.shop_name,
        city=user_data.city,
        language_preference=user_data.language_preference,
        cash_on_hand=user_data.cash_on_hand,
        created_at=datetime.utcnow().isoformat(),
        total_items=0,
        total_inventory_value=0.0
    )

    logger.info(f"User created: {user_id} from {user_data.city}")
    return profile


def parse_csv(file_content: bytes) -> tuple[List[InventoryItemCSV], List[Dict[str, Any]]]:
    """
    Parse CSV file and return list of inventory items and errors.

    Expected CSV format:
    item_name,unit_price,usual_order_qty,current_stock,category
    Sugar,20,50,10,grains
    Milk,55,30,5,dairy

    Returns:
        (valid_items, error_rows)
        - valid_items: List of InventoryItemCSV objects
        - error_rows: List of dicts with row_number and error message
    """
    valid_items = []
    error_rows = []

    try:
        # Decode bytes to string
        text_content = file_content.decode('utf-8')
        csv_reader = csv.DictReader(io.StringIO(text_content))

        if csv_reader.fieldnames is None:
            error_rows.append({
                "row": 1,
                "error": "CSV file is empty or has no headers"
            })
            return [], error_rows

        # Check required headers
        required_headers = {'item_name', 'unit_price', 'usual_order_qty', 'current_stock'}
        headers_set = set(csv_reader.fieldnames)

        if not required_headers.issubset(headers_set):
            missing = required_headers - headers_set
            error_rows.append({
                "row": 1,
                "error": f"Missing required headers: {', '.join(missing)}"
            })
            return [], error_rows

        # Parse rows
        for row_num, row in enumerate(csv_reader, start=2):  # Start at 2 (after header)
            try:
                # Clean whitespace
                row = {k: v.strip() if isinstance(v, str) else v for k, v in row.items()}

                # Parse and validate
                item = InventoryItemCSV(
                    item_name=row['item_name'],
                    unit_price=float(row['unit_price']),
                    cost_price=float(row.get('cost_price', float(row['unit_price']) * 0.8)),
                    usual_order_qty=int(row['usual_order_qty']),
                    current_stock=int(row['current_stock']),
                    category=row.get('category', row.get('item_category', 'general')).lower(),
                    is_perishable=row.get('is_perishable', 'false').lower() == 'true',
                    expiry_date=row.get('expiry_date'),
                    barcode=row.get('barcode')
                )

                # Validate category
                if item.category not in PREDEFINED_CATEGORIES:
                    # Log warning but allow custom categories
                    logger.warning(f"Unknown category {item.category} (row {row_num}), treating as custom")

                valid_items.append(item)

            except ValueError as e:
                error_rows.append({
                    "row": row_num,
                    "error": str(e),
                    "data": row
                })
            except Exception as e:
                error_rows.append({
                    "row": row_num,
                    "error": f"Unexpected error: {str(e)}",
                    "data": row
                })

    except UnicodeDecodeError as e:
        error_rows.append({
            "row": 0,
            "error": "File encoding error. Please ensure CSV is UTF-8 encoded"
        })
    except Exception as e:
        error_rows.append({
            "row": 0,
            "error": f"Error parsing CSV: {str(e)}"
        })

    return valid_items, error_rows


def bulk_import_items(user_id: str, items: List[InventoryItemCSV]) -> ImportResult:
    """
    Bulk import items (would insert into Supabase inventory table in production).

    Returns ImportResult with count of successful and failed imports.
    """
    imported_count = len(items)
    total_value = sum(item.unit_price * item.usual_order_qty for item in items)

    result = ImportResult(
        user_id=user_id,
        items_imported=imported_count,
        items_failed=0,
        failed_rows=[],
        created_at=datetime.utcnow().isoformat(),
        total_inventory_value=total_value
    )

    logger.info(f"Imported {imported_count} items for user {user_id}, total value: ₹{total_value:.2f}")
    return result


def get_csv_template() -> str:
    """Generate CSV template for download"""
    template = """item_name,unit_price,cost_price,usual_order_qty,current_stock,category,is_perishable,expiry_date,barcode
Cavin’s Milk Shake,35,27,100,20,beverages,true,2026-09-27,8902979015929
Amul Taaza Milk,27,24,50,5,dairy,true,2026-03-30,8901058000104
Sugar (1kg),45,38,50,15,grains,false,2027-01-01,
Rice (5kg),240,210,15,3,grains,false,2027-01-01,
Tea Powder,120,105,25,8,beverages,false,2027-01-01,
Coffee,80,68,15,3,beverages,false,2027-01-01,"""
    return template


def validate_city(city: str) -> bool:
    """Check if city is in predefined list (for weather API)"""
    return city in CITY_TO_COORDINATES


def get_cities_list() -> List[str]:
    """Return list of supported cities for location"""
    return list(CITY_TO_COORDINATES.keys())
