"""
Bharat-MAS Service — Settings Management
Handles fetching and saving canteen settings from/to the database.
"""

from typing import Dict, Any, Optional
import os
import json
from pathlib import Path
from services.supabase_service import supabase_client
from services.calendar_service import DEFAULT_SETTINGS

def fetch_settings(admin_id: str) -> Dict[str, Any]:
    """
    Fetch the canteen settings for the specific admin from the database.
    Falls back to local file and then defaults.
    """
    if not admin_id or admin_id == "unknown":
        return DEFAULT_SETTINGS.copy()

    try:
        resp = supabase_client.table('canteen_settings').select('settings').eq('admin_id', admin_id).execute()
        if resp.data and len(resp.data) > 0:
            return resp.data[0]['settings']
    except Exception as e:
        print(f"SettingsService: DB fetch error for admin {admin_id}: {e}")

    # Fallback to local file for compatibility during transition
    settings_path = Path(__file__).parent.parent / "data" / "settings.json"
    if settings_path.exists():
        try:
            return json.loads(settings_path.read_text(encoding='utf-8'))
        except:
            pass

    return DEFAULT_SETTINGS.copy()

def update_settings(admin_id: str, settings: Dict[str, Any]) -> bool:
    """Updates the settings in the database for the current admin."""
    if not admin_id or admin_id == "unknown":
        return False

    try:
        supabase_client.table('canteen_settings').upsert({
            'admin_id': admin_id,
            'settings': settings
        }).execute()
        return True
    except Exception as e:
        print(f"SettingsService: Error saving settings: {e}")
        return False
