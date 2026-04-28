"""Bharat-MAS API Smoke Test Suite"""
import httpx
import json
import sys

BASE = "http://127.0.0.1:5500"
results = []

def test(name, fn):
    try:
        code, detail = fn()
        status = "PASS" if code == 200 else "FAIL"
        results.append((status, name, code, detail))
    except Exception as e:
        results.append(("FAIL", name, 0, str(e)))

# --- Tests ---

def t_health():
    r = httpx.get(f"{BASE}/health")
    return r.status_code, r.json()

def t_categories():
    r = httpx.get(f"{BASE}/categories/list")
    d = r.json()
    return r.status_code, f"{len(d.get('predefined',[]))} categories"

def t_csv_template():
    r = httpx.get(f"{BASE}/csv-template")
    return r.status_code, "ok"

def t_settings_get():
    r = httpx.get(f"{BASE}/admin/settings")
    return r.status_code, "ok"

def t_calendar_events_get():
    r = httpx.get(f"{BASE}/admin/calendar/events")
    return r.status_code, r.text[:100]

def t_calendar_get():
    r = httpx.get(f"{BASE}/admin/calendar")
    return r.status_code, r.text[:100]

def t_analyze():
    payload = {
        "item_name": "Coffee",
        "unit_price": 15.0,
        "usual_order_qty": 50,
        "current_stock": 10,
        "cash_on_hand": 5000.0,
        "item_category": "beverages",
        "is_perishable": True,
        "horizon_days": 1,
    }
    r = httpx.post(f"{BASE}/analyze", json=payload, timeout=120.0)
    if r.status_code == 200:
        data = r.json()
        horizons = list(data.get("horizons", {}).keys())
        return 200, (
            f"rec_qty={data['recommended_qty']}, "
            f"risk={data['risk_status']}, "
            f"horizons={horizons}, "
            f"trend={data.get('trend_modifier',0)}"
        )
    else:
        return r.status_code, r.text[:200]

def t_explanation_quality():
    payload = {
        "item_name": "Samosa",
        "unit_price": 10.0,
        "usual_order_qty": 100,
        "current_stock": 5,
        "cash_on_hand": 3000.0,
        "item_category": "snacks",
        "is_perishable": True,
        "horizon_days": 0,
    }
    r = httpx.post(f"{BASE}/analyze", json=payload, timeout=120.0)
    if r.status_code == 200:
        data = r.json()
        expl = data.get("explanation_english", "")
        if len(expl) > 30:
            return 200, f"len={len(expl)}, preview={expl[:120]}..."
        else:
            return 400, f"Explanation too short: '{expl}'"
    return r.status_code, r.text[:200]

def t_menu():
    r = httpx.get(f"{BASE}/menu")
    return r.status_code, "ok"

# Run all
test("Health", t_health)
test("Categories", t_categories)
test("CSV Template", t_csv_template)
test("Settings GET", t_settings_get)
test("Calendar Events GET (no auth)", t_calendar_events_get)
test("Calendar GET (no auth)", t_calendar_get)
test("Menu", t_menu)
print("--- Running analysis tests (may take 30-60s per test)... ---")
test("Analyze (Coffee, perishable)", t_analyze)
test("Explanation Quality (Samosa)", t_explanation_quality)

# Print summary
print("\n" + "="*70)
print("BHARAT-MAS API SMOKE TEST RESULTS")
print("="*70)
passed = 0
failed = 0
for status, name, code, detail in results:
    icon = "✓" if status == "PASS" else "✗"
    print(f"  [{icon}] {name}: HTTP {code} -> {detail}")
    if status == "PASS":
        passed += 1
    else:
        failed += 1

print(f"\nTotal: {passed} passed, {failed} failed out of {passed+failed}")
if failed > 0:
    sys.exit(1)
