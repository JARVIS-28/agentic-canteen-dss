import sys
import os
from pathlib import Path

# Add services to path
sys.path.append(str(Path(__file__).parent))

from services.calendar_service import parse_calendar_pdf

def test_pdf_parsing():
    pdf_dir = Path("calender_of_events")
    pdfs = list(pdf_dir.glob("*.pdf"))
    
    if not pdfs:
        print("No PDFs found in calender_of_events")
        return

    print(f"Testing {len(pdfs)} PDFs...")
    for pdf_path in pdfs:
        print(f"\n--- Testing: {pdf_path.name} ---")
        try:
            with open(pdf_path, "rb") as f:
                content = f.read()
            
            events = parse_calendar_pdf(content, filename=pdf_path.name)
            print(f"Extracted {len(events)} events.")
            if events:
                # Show first 3 events
                for ev in events[:3]:
                    print(f"  - {ev['event_date']}: {ev['event_name']} ({ev['event_type']} / {ev['stream_type']})")
        except Exception as e:
            print(f"Error parsing {pdf_path.name}: {e}")

def test_manual_event():
    import uuid
    from services.supabase_service import supabase_client
    from services import calendar_service
    
    print("\n--- Testing: Manual Event Addition ---")
    
    # We need a valid admin ID or at least try to insert one.
    # Let's try to find an existing admin
    try:
        admins = supabase_client.table('canteen_admins').select('id').limit(1).execute()
        if not admins.data:
            print("No admins found in canteen_admins. Skipping manual event test.")
            return

        admin_id = admins.data[0]['id']
        test_payload = {
            "event_date": "2026-12-25",
            "event_name": "Christmas Break - Antigravity Test",
            "event_type": "Holiday",
            "stream_type": "General"
        }
        
        # We need to cleanup before and after to keep the DB clean
        supabase_client.table('college_events').delete().eq('event_name', test_payload['event_name']).execute()
        
        # Test add_manual_event
        result = calendar_service.add_manual_event(admin_id, supabase_client, test_payload)
        if result.data:
            print(f"Manual Event Added: {result.data[0]['id']} - {result.data[0]['event_name']}")
        else:
            print("Manual event added but no data returned.")
        
    except Exception as e:
        print(f"Manual event test error: {e}")

def list_stored_events():
    from services.supabase_service import supabase_client
    print("\n--- Current Events in Database (Summary) ---")
    try:
        streams = ["Nursing", "B.Tech", "MBBS"]
        for s in streams:
            resp = supabase_client.table('college_events').select('*').eq('stream_type', s).limit(2).execute()
            events = resp.data or []
            print(f"Stream {s}: {len(events)} samples found.")
            for ev in events:
                 print(f"  - {ev['event_date']}: {ev['event_name']} ({ev['event_type']})")
    except Exception as e:
        print(f"Error listing events from DB: {e}")

if __name__ == "__main__":
    test_pdf_parsing()
    test_manual_event()
    list_stored_events()

