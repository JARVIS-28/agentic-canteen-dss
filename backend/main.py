"""
Bharat-MAS — FastAPI Application Entry Point

Multi-Agent System for Indian MSME Inventory Optimization.
Provides REST + WebSocket APIs for inventory analysis, calendar management,
admin CRUD, and barcode intelligence.
"""

import json
import uuid
import asyncio
import datetime
import hashlib
import logging
from typing import Optional, List, Dict, Any

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, UploadFile, File, Request, Form, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from dotenv import load_dotenv
from pathlib import Path
import os

load_dotenv()

from services.supabase_service import supabase_client, create_supabase_client, supabase_auth_signup
from orchestrator import get_graph
from services.user_service import (
    UserRegister, UserProfile, bulk_import_items, parse_csv, create_user, get_csv_template
)
from services.category_service import get_category_names, PREDEFINED_CATEGORIES
from services.inventory_store import get_inventory_store, InventoryItem
from services.product_lookup import lookup_barcode
from services.barcode_intel import intel_service
from services.portfolio_service import compute_portfolio_analytics
from services.supabase_service import (
    upload_calendar_file,
    remove_calendar_file,
    get_calendar_signed_url,
)
from services import calendar_service

logger = logging.getLogger(__name__)


# ──────────────────────────────────────────────────────────────────────────────
# App Setup
# ──────────────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="Bharat-MAS API",
    description="Multi-Agent System for Indian MSME Inventory Optimization",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ──────────────────────────────────────────────────────────────────────────────
# Data Utilities (file-backed, prototype)
# ──────────────────────────────────────────────────────────────────────────────

DATA_DIR = Path(__file__).parent / 'data'
DATA_DIR.mkdir(parents=True, exist_ok=True)


def _data_path(name: str) -> Path:
    return DATA_DIR / f"{name}.json"


def _load_json(name: str, default):
    p = _data_path(name)
    if not p.exists():
        return default
    try:
        return json.loads(p.read_text(encoding='utf8'))
    except Exception:
        return default


def _save_json(name: str, data):
    p = _data_path(name)
    p.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding='utf8')


# ──────────────────────────────────────────────────────────────────────────────
# Auth Helpers (single canonical definitions)
# ──────────────────────────────────────────────────────────────────────────────

def _extract_admin_jwt(request: Request) -> str:
    """Extract JWT from request headers with robust fallbacks."""
    token = request.headers.get('x-admin-token') or request.headers.get('authorization')
    if not token:
        token = request.query_params.get('token')

    if token and token.startswith('Bearer '):
        token = token.split(' ', 1)[1]

    if not token:
        raise HTTPException(status_code=401, detail='Unauthorized: No token provided')
    return token


def _get_user_client(request: Request):
    """
    Returns a Supabase client hydrated with the user's JWT.
    Required for RLS and auth.get_user() to work.
    """
    token = _extract_admin_jwt(request)

    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_ANON_KEY")
    if not url or not key:
        raise HTTPException(status_code=500, detail='Supabase config missing')

    client = create_supabase_client(url, key)
    try:
        if token:
            client.auth.set_session(token, "")
            client.postgrest.auth(token)
    except Exception as e:
        logger.warning(f"Session init error: {e}")
    return client


async def _get_current_admin_id(request: Request) -> str:
    """Get the current administrative user's ID from their JWT."""
    token = _extract_admin_jwt(request)
    client = _get_user_client(request)
    user_resp = client.auth.get_user(token)
    if not user_resp or not user_resp.user:
        raise HTTPException(status_code=401, detail='Invalid session')
    return user_resp.user.id


def _validate_admin_token(token: str) -> bool:
    """Validate an admin JWT token against Supabase Auth."""
    dev_mode = os.getenv('DEV_MODE', 'true').lower() == 'true'
    if not token:
        return dev_mode
    try:
        user_resp = supabase_client.auth.get_user(token)
        return getattr(user_resp, 'user', None) is not None
    except Exception as e:
        logger.warning(f"Auth Token Validation Failed: {e}")
        return False


# ──────────────────────────────────────────────────────────────────────────────
# Request / Response Models
# ──────────────────────────────────────────────────────────────────────────────

class InventoryInput(BaseModel):
    user_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    item_id: Optional[str] = None
    item_name: str = Field(..., example="Sugar")
    unit_price: float = Field(..., gt=0, example=20.0)
    cost_price: float = Field(default=0.0, ge=0, example=15.0)
    usual_order_qty: int = Field(..., gt=0, example=50)
    current_stock: int = Field(..., ge=0, example=10)
    item_category: str = Field(default="general", example="grains")
    cash_on_hand: float = Field(..., gt=0, example=5000.0)
    user_location: str = Field(default="Delhi", example="Delhi")
    is_perishable: bool = Field(default=False)
    expiry_date: Optional[str] = Field(default=None)
    monthly_revenue: float = Field(default=0.0)
    monthly_expenses: float = Field(default=0.0)
    inventory_levels: Optional[dict] = Field(default_factory=dict)
    current_date: Optional[str] = None
    current_time: Optional[str] = Field(
        default_factory=lambda: datetime.datetime.now().strftime("%H:%M")
    )
    horizon_days: Optional[int] = 1


class MASResponse(BaseModel):
    session_id: str
    recommended_qty: int
    explanation_hinglish: str
    explanation_english: str
    risk_status: str
    liquidity_ratio: float
    mdp_action: str
    profit_impact: float
    agent_thought_log: list
    forecast_confidence: float
    trend_modifier: float
    api_trend_signals: Dict[str, Any] = Field(default_factory=dict)
    trend_sources: List[str] = Field(default_factory=list)
    horizons: Dict[str, Any] = Field(default_factory=dict)
    is_working_day: Optional[bool] = Field(default=None)


class AdminLogin(BaseModel):
    email: str
    password: str


class ChangePasswordInput(BaseModel):
    new_password: str


class ImportResult(BaseModel):
    user_id: str
    items_imported: int
    items_failed: int
    failed_rows: List[Dict[str, Any]] = []
    created_at: str
    total_inventory_value: float = 0.0


class CategoryAnalysis(BaseModel):
    category: str
    total_items: int
    total_current_stock: int
    total_recommended_stock: int
    total_spend_required: float
    category_trend_modifier: float
    category_risk_status: str
    items: List[Dict[str, Any]]


class PortfolioAnalysis(BaseModel):
    user_id: str
    total_items: int
    total_cash_utilized: float
    cash_available: float
    utilization_percentage: float
    portfolio_risk_status: str
    overall_modifier: float
    category_analyses: Dict[str, CategoryAnalysis]
    priority_reorder_list: List[Dict[str, Any]]


# ──────────────────────────────────────────────────────────────────────────────
# Core Analysis Endpoints
# ──────────────────────────────────────────────────────────────────────────────

@app.post("/analyze", response_model=MASResponse)
async def analyze_inventory(payload: InventoryInput, request: Request):
    """Run the full MAS pipeline for a given inventory query."""
    session_id = str(uuid.uuid4())
    graph = get_graph()

    # Attempt to get real admin ID from token, fallback to payload user_id
    admin_id = payload.user_id
    try:
        token = _extract_admin_jwt(request)
        if token:
            admin_id = await _get_current_admin_id(request)
    except:
        pass

    initial_state = {
        "session_id": session_id,
        "admin_id": admin_id,
        "user_id": payload.user_id,
        "item_name": payload.item_name,
        "unit_price": payload.unit_price,
        "usual_order_qty": payload.usual_order_qty,
        "current_stock": payload.current_stock,
        "item_category": payload.item_category,
        "cash_on_hand": payload.cash_on_hand,
        "user_location": payload.user_location,
        "is_perishable": payload.is_perishable,
        "expiry_date": payload.expiry_date,
        "monthly_revenue": payload.monthly_revenue,
        "monthly_expenses": payload.monthly_expenses,
        "inventory_levels": payload.inventory_levels or {},
        "current_date": payload.current_date or datetime.date.today().isoformat(),
        "current_time": payload.current_time or datetime.datetime.now().strftime("%H:%M"),
        "horizon_days": payload.horizon_days if payload.horizon_days is not None else 1,
        "agent_thought_log": [],
        "recalculation_iterations": 0,
    }

    # Run analysis for ALL horizons and pack into result
    all_horizons = {0: "today", 1: "tmrw", 7: "week", 30: "month"}
    horizons_analysis = {}
    
    # Run all horizons in parallel for 4x speedup
    tasks = []
    horizon_labels = []
    
    for h, label in all_horizons.items():
        base_date = datetime.date.fromisoformat(initial_state["current_date"])
        target_date = base_date + datetime.timedelta(days=h)
        h_state = initial_state.copy()
        h_state["horizon_days"] = h
        h_state["current_date"] = target_date.isoformat()
        
        tasks.append(graph.ainvoke(h_state, {"recursion_limit": 50}))
        horizon_labels.append((h, label))

    # Execute all horizons concurrently
    horizon_results = await asyncio.gather(*tasks, return_exceptions=True)
    
    result = None
    last_successful_result = None

    for (h, label), h_result in zip(horizon_labels, horizon_results):
        if isinstance(h_result, Exception):
            err_type = type(h_result).__name__
            logger.error(f"Horizon {h} ({label}) failure: {err_type}: {h_result}")
            horizons_analysis[label] = {
                "qty": 0,
                "explanation": f"Structural Analysis Error [{err_type}]: {str(h_result)}",
                "risk_status": "Unsafe"
            }
        else:
            last_successful_result = h_result
            horizons_analysis[label] = {
                "qty": h_result.get("recommended_qty", 0),
                "explanation": h_result.get("explanation_english", ""),
                "risk_status": h_result.get("risk_status", "Safe")
            }
            # Use TMRW result as the primary for backward compatibility
            if h == 1:
                result = h_result

    if result is None:
        result = last_successful_result

    if result is None:
        raise HTTPException(
            status_code=503,
            detail="Analysis is temporarily unavailable. Please try again."
        )

    result["horizons"] = horizons_analysis

    # Generate the English summary explanation
    from services.explanation_service import explanation_service
    result["explanation_english"] = explanation_service.generate_english_advice(
        item_name=payload.item_name,
        recommended_qty=result.get("recommended_qty", 0),
        current_stock=payload.current_stock,
        mas_result=result
    )

    # Store the result in inventory store for portfolio analysis
    item_id = str(uuid.uuid4())
    inventory_item = InventoryItem(
        item_id=item_id,
        user_id=payload.user_id,
        item_name=payload.item_name,
        unit_price=payload.unit_price,
        usual_order_qty=payload.usual_order_qty,
        current_stock=payload.current_stock,
        item_category=payload.item_category,
        created_at=datetime.datetime.utcnow().isoformat(),
    )

    analysis_data = {
        "recommended_qty": result.get("recommended_qty", payload.usual_order_qty),
        "explanation_hinglish": result.get("explanation_hinglish", ""),
        "explanation_english": result.get("explanation_english", ""),
        "risk_status": result.get("risk_status", "Unknown"),
        "liquidity_ratio": result.get("liquidity_ratio", 0.0),
        "mdp_action": result.get("mdp_action", "APPROVE"),
        "profit_impact": result.get("profit_impact", 0.0),
        "forecast_confidence": result.get("forecast_confidence", 0.0),
        "trend_modifier": result.get("trend_modifier", 1.0),
        "api_trend_signals": result.get("api_trend_signals", {}),
        "trend_sources": result.get("trend_sources", []),
        "horizons": result.get("horizons", {}),
        "is_working_day": result.get("is_working_day", result.get("is_working_day_settings")),
    }
    inventory_item.analysis = analysis_data
    get_inventory_store().add_item(payload.user_id, inventory_item)

    # Persist to Supabase if item_id provided
    if payload.item_id:
        try:
            supabase_client.table('inventory').update({
                "analysis_result": analysis_data,
                "last_analyzed_at": datetime.datetime.utcnow().isoformat()
            }).eq('id', payload.item_id).execute()
        except Exception as e:
            logger.warning(f"Supabase persist error: {e}")

    return MASResponse(
        session_id=session_id,
        recommended_qty=result.get("recommended_qty", payload.usual_order_qty),
        explanation_hinglish=result.get("explanation_hinglish", ""),
        explanation_english=result.get("explanation_english", ""),
        risk_status=result.get("risk_status", "Unknown"),
        liquidity_ratio=result.get("liquidity_ratio", 0.0),
        mdp_action=result.get("mdp_action", "APPROVE"),
        profit_impact=result.get("profit_impact", 0.0),
        agent_thought_log=result.get("agent_thought_log", []),
        forecast_confidence=result.get("forecast_confidence", 0.0),
        trend_modifier=result.get("trend_modifier", 1.0),
        api_trend_signals=result.get("api_trend_signals", {}),
        trend_sources=result.get("trend_sources", []),
        horizons=result.get("horizons", {}),
        is_working_day=result.get("is_working_day", result.get("is_working_day_settings"))
    )


# ──────────────────────────────────────────────────────────────────────────────
# WebSocket: Real-time agent thought stream
# ──────────────────────────────────────────────────────────────────────────────

@app.websocket("/ws/analyze")
async def ws_analyze(websocket: WebSocket):
    """Streams agent thoughts in real-time over WebSocket using graph.astream()."""
    await websocket.accept()
    session_id = str(uuid.uuid4())

    try:
        data = await asyncio.wait_for(websocket.receive_text(), timeout=30)
        payload = json.loads(data)

        graph = get_graph()

        # Try to identify which admin is connecting
        admin_id = payload.get("admin_id") or payload.get("user_id")
        try:
            token = payload.get("token") or payload.get("admin_token")
            if token:
                user_resp = supabase_client.auth.get_user(token)
                if user_resp and user_resp.user:
                    admin_id = user_resp.user.id
        except:
            pass

        initial_state = {
            "session_id": session_id,
            "admin_id": admin_id,
            "user_id": payload.get("user_id", "unknown"),
            "agent_thought_log": [],
            "recalculation_iterations": 0,
            "current_time": datetime.datetime.now().strftime("%H:%M"),
            **payload,
            "is_perishable": payload.get("is_perishable", False),
            "horizon_days": payload.get("horizon_days", 1)
        }

        logger.info(f"[WS] Session {session_id}: analyzing '{payload.get('item_name', 'unknown')}'")

        accumulated: dict = {}

        try:
            async for step_output in graph.astream(initial_state, {"recursion_limit": 50}):
                for node_name, node_state in step_output.items():
                    accumulated.update(node_state)
                    thoughts = node_state.get("agent_thought_log", [])
                    if thoughts:
                        await websocket.send_text(json.dumps({
                            "type": "thought",
                            "node": node_name,
                            "data": thoughts[-1],
                        }))

            # Final result
            await websocket.send_text(json.dumps({
                "type": "result",
                "session_id": session_id,
                "data": {
                    "recommended_qty":      accumulated.get("recommended_qty", payload.get("usual_order_qty", 1)),
                    "explanation_hinglish": accumulated.get("explanation_hinglish", ""),
                    "explanation_english":  accumulated.get("explanation_english", ""),
                    "risk_status":          accumulated.get("risk_status", "Unknown"),
                    "liquidity_ratio":      accumulated.get("liquidity_ratio", 0.0),
                    "mdp_action":           accumulated.get("mdp_action", "APPROVE"),
                    "profit_impact":        accumulated.get("profit_impact", 0.0),
                    "agent_thought_log":    accumulated.get("agent_thought_log", []),
                    "forecast_confidence":  accumulated.get("forecast_confidence", 0.0),
                    "trend_modifier":       accumulated.get("trend_modifier", 1.0),
                    "api_trend_signals":    accumulated.get("api_trend_signals", {}),
                    "trend_sources":        accumulated.get("trend_sources", []),
                },
            }))

            # Persist to Supabase if item_id provided
            item_id = payload.get('item_id')
            if item_id:
                try:
                    analysis_data = {
                        "recommended_qty":      accumulated.get("recommended_qty", payload.get("usual_order_qty", 1)),
                        "explanation_hinglish": accumulated.get("explanation_hinglish", ""),
                        "explanation_english":  accumulated.get("explanation_english", ""),
                        "risk_status":          accumulated.get("risk_status", "Unknown"),
                        "liquidity_ratio":      accumulated.get("liquidity_ratio", 0.0),
                        "mdp_action":           accumulated.get("mdp_action", "APPROVE"),
                        "profit_impact":        accumulated.get("profit_impact", 0.0),
                        "forecast_confidence":  accumulated.get("forecast_confidence", 0.0),
                        "trend_modifier":       accumulated.get("trend_modifier", 1.0),
                        "api_trend_signals":    accumulated.get("api_trend_signals", {}),
                        "trend_sources":        accumulated.get("trend_sources", []),
                    }
                    supabase_client.table('inventory').update({
                        "analysis_result": analysis_data,
                        "last_analyzed_at": datetime.datetime.utcnow().isoformat()
                    }).eq('id', item_id).execute()
                except Exception as e:
                    logger.warning(f"WS persist error: {e}")

        except Exception as exc:
            logger.error(f"[WS] Stream error: {exc}")
            await websocket.send_text(json.dumps({
                "type": "error",
                "message": f"Analysis failed: {str(exc)}",
                "session_id": session_id,
            }))

        await websocket.send_text(json.dumps({
            "type": "done",
            "session_id": session_id,
        }))

    except asyncio.TimeoutError:
        await websocket.send_text(json.dumps({
            "type": "error", "message": "Timed out waiting for payload", "session_id": session_id
        }))
    except WebSocketDisconnect:
        logger.info(f"[WS] Client disconnected: {session_id}")
    except Exception as exc:
        logger.error(f"[WS] Unhandled exception [{session_id}]: {exc}")
        try:
            await websocket.send_text(json.dumps({
                "type": "error", "message": str(exc), "session_id": session_id
            }))
        except Exception:
            pass


# ──────────────────────────────────────────────────────────────────────────────
# Health Check
# ──────────────────────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {"status": "ok", "service": "Bharat-MAS v1.0"}


# ──────────────────────────────────────────────────────────────────────────────
# Admin Auth Endpoints
# ──────────────────────────────────────────────────────────────────────────────

@app.post('/admin/login')
async def admin_login(payload: AdminLogin):
    try:
        resp = supabase_client.auth.sign_in_with_password({
            "email": payload.email,
            "password": payload.password
        })
        if not resp.session:
            raise HTTPException(status_code=401, detail='Invalid login credentials')
        return {'token': resp.session.access_token}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=401, detail=str(e))


@app.post('/admin/logout')
async def admin_logout(request: Request):
    # No-op for JWT-based auth (client discards the token)
    return {'status': 'ok'}


@app.post('/admin/register')
async def register_admin(payload: dict):
    required = ['full_name', 'canteen_name', 'college_name', 'manager_password', 'email']
    missing = [key for key in required if not payload.get(key)]
    if missing:
        raise HTTPException(status_code=400, detail=f"Missing fields: {', '.join(missing)}")

    try:
        url = os.environ.get("SUPABASE_URL")
        service_key = os.environ.get("SUPABASE_SERVICE_KEY")
        anon_key = os.environ.get("SUPABASE_ANON_KEY")
        write_key = service_key or anon_key

        if not url or not anon_key or not write_key:
            raise HTTPException(status_code=500, detail="Supabase config missing")

        # 1) Create Auth user
        signup_data = supabase_auth_signup(
            email=payload['email'],
            password=payload['manager_password'],
            url_override=url,
            key_override=anon_key,
        )
        admin_id = signup_data['user']['id']

        # 2) Persist admin profile via service key when available (bypasses RLS)
        user_client = create_supabase_client(url, write_key)

        auth_session = signup_data.get('session') or {}
        access_token = auth_session.get('access_token') if isinstance(auth_session, dict) else None
        refresh_token = auth_session.get('refresh_token') if isinstance(auth_session, dict) else ""
        if not service_key and access_token:
            user_client.postgrest.auth(access_token)
            user_client.auth.set_session(access_token, refresh_token or "")

        pwd_hash = hashlib.sha256(payload['manager_password'].encode()).hexdigest()
        new_admin = {
            'id': admin_id,
            'full_name': payload['full_name'],
            'canteen_name': payload['canteen_name'],
            'college_name': payload['college_name'],
            'email': payload['email'],
            'manager_password_hash': pwd_hash,
            'city': payload.get('city', 'Unknown'),
            'language': payload.get('language', 'english'),
            'cash_on_hand': payload.get('cash_on_hand', 0)
        }

        resp = user_client.table('canteen_admins').insert(new_admin).execute()
        if not resp.data:
            check = user_client.table('canteen_admins').select('id').eq('id', admin_id).execute()
            if not check.data:
                raise Exception("Database blocked admin record creation. Ensure 'canteen_admins' table exists.")

        return new_admin
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))


@app.post('/admin/delete-account')
async def admin_delete_account(request: Request):
    try:
        client = _get_user_client(request)
        user_resp = client.auth.get_user(_extract_admin_jwt(request))
        admin_id = user_resp.user.id

        try:
            client.table('canteen_admins').delete().eq('id', admin_id).execute()
            client.table('inventory').delete().eq('admin_id', admin_id).execute()
        except Exception:
            pass

        return {'ok': True}
    except Exception as e:
        raise HTTPException(status_code=401, detail=str(e))


@app.get('/admin/me')
async def get_admin_me(request: Request):
    try:
        token = _extract_admin_jwt(request)
        client = _get_user_client(request)
        user_resp = client.auth.get_user(token)
        if not user_resp or not user_resp.user:
            raise HTTPException(status_code=401, detail='Invalid or expired session')
        admin_id = user_resp.user.id
        resp = client.table('canteen_admins').select('*').eq('id', admin_id).single().execute()
        return resp.data
    except Exception as e:
        raise HTTPException(status_code=401, detail=str(e))


@app.post('/admin/update-profile')
async def update_admin_profile(payload: dict, request: Request):
    try:
        token = _extract_admin_jwt(request)
        client = _get_user_client(request)
        user_resp = client.auth.get_user(token)
        if not user_resp or not user_resp.user:
            raise HTTPException(status_code=401, detail='Invalid or expired session')
        admin_id = user_resp.user.id
        
        updatable_fields = ['full_name', 'canteen_name', 'college_name', 'city', 'language', 'cash_on_hand']
        update_data = {k: v for k, v in payload.items() if k in updatable_fields}
        
        if not update_data:
            return {"status": "no-op"}
            
        resp = client.table('canteen_admins').update(update_data).eq('id', admin_id).execute()
        return {"status": "success", "data": resp.data}
    except Exception as e:
         raise HTTPException(status_code=400, detail=str(e))


@app.post('/admin/change-password')
async def change_admin_password(payload: ChangePasswordInput, request: Request):
    try:
        token = _extract_admin_jwt(request)
        client = _get_user_client(request)
        user_resp = client.auth.get_user(token)
        if not user_resp or not user_resp.user:
            raise HTTPException(status_code=401, detail='Invalid or expired session')
        admin_id = user_resp.user.id

        client.auth.update_user({"password": payload.new_password})
        new_hash = hashlib.sha256(payload.new_password.encode()).hexdigest()
        client.table('canteen_admins').update({'manager_password_hash': new_hash}).eq('id', admin_id).execute()

        return {'status': 'success'}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ──────────────────────────────────────────────────────────────────────────────
# Settings & Calendar Management
# ──────────────────────────────────────────────────────────────────────────────

@app.get('/admin/settings')
async def get_settings(request: Request):
    """Fetch canteen settings from the database for the current admin."""
    try:
        admin_id = await _get_current_admin_id(request)
        client = _get_user_client(request)
        
        resp = client.table('canteen_settings').select('settings').eq('admin_id', admin_id).execute()
        if resp.data:
            return resp.data[0]['settings']
            
        # Fallback to local JSON if DB is empty (migration path)
        local_settings = _load_json('settings', None)
        if local_settings:
            return local_settings
            
        return calendar_service.DEFAULT_SETTINGS
    except Exception as e:
        logger.warning(f"Settings fetch failed: {e}")
        return calendar_service.DEFAULT_SETTINGS


@app.post('/admin/settings')
async def save_settings(payload: dict, request: Request):
    """Upsert canteen settings into the database for the current admin."""
    admin_id = await _get_current_admin_id(request)
    client = _get_user_client(request)

    def _ok_time(t):
        return isinstance(t, str) and len(t) in (4, 5) and ':' in t

    if not _ok_time(payload.get('open_time', '09:00')) or not _ok_time(payload.get('close_time', '17:00')):
        raise HTTPException(status_code=400, detail='invalid time format')
        
    breaks_value = payload.get('breaks', [])
    if not isinstance(breaks_value, list):
        raise HTTPException(status_code=400, detail='breaks must be a list')
        
    calendar_payload = payload.get('calendar', {})
    cal = calendar_service.normalize_calendar(calendar_payload) if hasattr(calendar_service, 'normalize_calendar') else calendar_payload
    
    settings_payload = {
        'working_days': cal.get('working_days', ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']),
        'open_time': payload.get('open_time', '09:00'),
        'close_time': payload.get('close_time', '17:00'),
        'breaks': breaks_value,
        'calendar': cal,
    }
    
    try:
        client.table('canteen_settings').upsert({
            'admin_id': admin_id,
            'settings': settings_payload,
            'updated_at': datetime.datetime.utcnow().isoformat()
        }).execute()
        return {'ok': True}
    except Exception as e:
        logger.error(f"Error saving settings to DB: {e}")
        raise HTTPException(status_code=500, detail=f"Database save failed: {str(e)}")


@app.get('/menu')
async def get_menu():
    return []


@app.get('/admin/calendar')
async def get_calendar(request: Request = None):
    if not request:
        return {'files': []}
    try:
        token = _extract_admin_jwt(request)
        client = _get_user_client(request)
        user_resp = client.auth.get_user(token)
        if not user_resp or not user_resp.user:
            return {'files': []}
        admin_id = user_resp.user.id
        assets = calendar_service.get_active_calendars(admin_id, client)
        return {'files': assets}
    except Exception as e:
        logger.warning(f"Error loading calendars: {e}")
        return {'files': []}


@app.get('/admin/calendar/events')
async def get_calendar_events(request: Request = None):
    if request is None:
        return []
    try:
        token = _extract_admin_jwt(request)
        client = _get_user_client(request)
        user_resp = client.auth.get_user(token)
        if not user_resp or not user_resp.user:
            return []
        admin_id = user_resp.user.id
        resp = supabase_client.table('college_events').select("*").eq("admin_id", admin_id).order("event_date").execute()
        return resp.data or []
    except Exception as e:
        logger.warning(f"Fetch events error: {e}")
        return []


@app.post('/admin/calendar/upload')
async def upload_calendar(file: UploadFile = File(...), request: Request = None):
    admin_id = await _get_current_admin_id(request)
    client = _get_user_client(request)
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail='file is empty')

    result = await calendar_service.process_calendar_upload(
        admin_id=admin_id,
        client=client,
        file_bytes=content,
        filename=file.filename
    )
    return result


@app.post('/admin/calendar/events')
async def create_calendar_event(payload: dict, request: Request = None):
    """Add a manual event to the college calendar via the calendar_service."""
    if request is None:
        raise HTTPException(status_code=400, detail='bad request')

    admin_id = await _get_current_admin_id(request)

    # Validate required fields
    event_date = payload.get("event_date")
    event_name = (payload.get("event_name") or "").strip()
    if not event_date:
        raise HTTPException(status_code=400, detail="event_date is required (YYYY-MM-DD)")
    if not event_name:
        raise HTTPException(status_code=400, detail="event_name is required")

    try:
        resp = calendar_service.add_manual_event(admin_id, supabase_client, payload)
        return resp.data[0] if resp.data else {"status": "ok"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Calendar event save error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ──────────────────────────────────────────────────────────────────────────────
# Inventory CRUD
# ──────────────────────────────────────────────────────────────────────────────

@app.get('/admin/inventory')
async def get_admin_inventory(request: Request):
    try:
        client = _get_user_client(request)
        resp = client.table('inventory').select('*').execute()
        if not resp.data:
            return []
        out = []
        for row in resp.data:
            out.append({
                **row,
                "name": row.get("item_name"),
                "quantity": row.get("current_stock"),
                "price": row.get("unit_price"),
                "reorder_threshold": row.get("usual_order_qty")
            })
        return out
    except Exception as e:
        logger.warning(f"Supabase load error: {e}")
        return _load_json('inventory', [])


@app.post('/admin/inventory')
async def add_admin_inventory(item: dict, request: Request = None):
    if request is None:
        raise HTTPException(status_code=400, detail='bad request')
    client = _get_user_client(request)

    if not item.get('name') and not item.get('item_name'):
        raise HTTPException(status_code=400, detail='invalid inventory item')

    try:
        token = _extract_admin_jwt(request)
        user_resp = client.auth.get_user(token)
        if not user_resp or not user_resp.user:
            raise HTTPException(status_code=401, detail='Invalid or expired session')
        admin_id = user_resp.user.id
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Authentication failed: {e}")

    db_item = {
        "admin_id": admin_id,
        "item_name": item.get("item_name", item.get("name")),
        "item_category": item.get("item_category", item.get("category", "snacks")),
        "unit_price": float(item.get("unit_price", item.get("price", 0))),
        "cost_price": float(item.get("cost_price", 0)),
        "current_stock": int(item.get("current_stock", item.get("quantity", 0))),
        "usual_order_qty": int(item.get("usual_order_qty", item.get("reorder_threshold", 0))),
        "barcode": item.get("barcode"),
        "is_perishable": bool(item.get("is_perishable", False)),
        "user_location": item.get("user_location", "PES EC Campus"),
        "cash_on_hand": float(item.get("cash_on_hand", 0)),
        "expiry_date": item.get("expiry_date"),
    }

    try:
        resp = client.table('inventory').insert(db_item).execute()
        if not resp.data and hasattr(resp, 'error') and resp.error:
            raise Exception(f"DB Error: {resp.error}")

        if resp.data:
            row = resp.data[0]
            return {
                **row,
                "name": row.get("item_name"),
                "quantity": row.get("current_stock"),
                "price": row.get("unit_price"),
                "reorder_threshold": row.get("usual_order_qty")
            }
    except Exception as e:
        logger.error(f"Insert error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get('/admin/inventory/lookup/{barcode}')
async def lookup_admin_inventory(barcode: str, request: Request = None):
    if request is None:
        raise HTTPException(status_code=400, detail='bad request')
    if not barcode:
        raise HTTPException(status_code=400, detail='barcode is required')

    try:
        client = _get_user_client(request)
        token = _extract_admin_jwt(request)
        user_resp = client.auth.get_user(token)
        if not user_resp or not user_resp.user:
            raise HTTPException(status_code=401, detail='Invalid admin session')
        admin_id = user_resp.user.id
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=401, detail=f'unauthorized: {e}')

    try:
        alt_barcodes = [barcode]
        if barcode.startswith('0'):
            alt_barcodes.append(barcode.lstrip('0'))
        else:
            alt_barcodes.append('0' + barcode)

        resp = client.table('inventory').select('*').eq('admin_id', admin_id).in_('barcode', alt_barcodes).limit(1).execute()

        if not resp.data:
            raise HTTPException(status_code=404, detail='Barcode not found in your inventory')
        return resp.data[0]
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"Lookup error: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))


@app.put('/admin/inventory/{item_id}')
async def update_admin_inventory(item_id: str, updates: dict, request: Request = None):
    if not updates or not isinstance(updates, dict):
        raise HTTPException(status_code=400, detail='invalid update payload')
    if request is None:
        raise HTTPException(status_code=400, detail='bad request')

    updates['last_updated'] = datetime.datetime.utcnow().isoformat()
    client = _get_user_client(request)

    update_data = {}
    if "current_stock" in updates or "quantity" in updates:
        update_data["current_stock"] = int(updates.get("current_stock", updates.get("quantity", 0)))
    if "unit_price" in updates or "price" in updates:
        update_data["unit_price"] = float(updates.get("unit_price", updates.get("price", 0)))
    if "cost_price" in updates:
        update_data["cost_price"] = float(updates.get("cost_price", 0))
    if "item_name" in updates or "name" in updates:
        update_data["item_name"] = updates.get("item_name", updates.get("name"))
    if "usual_order_qty" in updates or "reorder_threshold" in updates:
        update_data["usual_order_qty"] = int(updates.get("usual_order_qty", updates.get("reorder_threshold", 0)))

    try:
        resp = client.table('inventory').update(update_data).eq('id', item_id).execute()
        if not resp.data and hasattr(resp, 'error') and resp.error:
            raise Exception(f"Update error: {resp.error}")

        if resp.data:
            row = resp.data[0]
            return {
                **row,
                "name": row.get("item_name"),
                "quantity": row.get("current_stock"),
                "price": row.get("unit_price"),
                "reorder_threshold": row.get("usual_order_qty")
            }
        else:
            raise HTTPException(status_code=404, detail='inventory item not found')
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete('/admin/inventory/{item_id}')
async def delete_admin_inventory(item_id: str, request: Request = None):
    if request is None:
        raise HTTPException(status_code=400, detail='bad request')
    try:
        client = _get_user_client(request)
        # Detach sales history first
        try:
            client.table('sales').update({"item_id": None}).eq('item_id', item_id).execute()
        except Exception:
            try:
                client.table('sales').delete().eq('item_id', item_id).execute()
            except Exception:
                pass

        resp = client.table('inventory').delete().eq('id', item_id).execute()
        return {'ok': True}
    except Exception as e:
        logger.error(f"Delete error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ──────────────────────────────────────────────────────────────────────────────
# Sales
# ──────────────────────────────────────────────────────────────────────────────

@app.post('/admin/sales')
async def add_admin_sale(sale: dict, request: Request = None):
    if request is None:
        raise HTTPException(status_code=400, detail='bad request')
    try:
        client = _get_user_client(request)
        user_resp = client.auth.get_user(_extract_admin_jwt(request))
        admin_id = user_resp.user.id

        item_id = sale.get('item_id')
        qty = sale.get('quantity', 1)

        item_resp = client.table('inventory').select('*').eq('id', item_id).execute()
        if not item_resp.data:
            raise HTTPException(status_code=404, detail='Item not found')

        item_row = item_resp.data[0]
        unit_price = float(item_row.get('unit_price', 0))
        current_stock = int(item_row.get('current_stock', 0))

        raw_payment = str(sale.get('payment_type', 'Cash')).lower()
        payment_map = {
            "cash": "Cash", "upi": "UPI", "card": "Card",
            "student_wallet": "Student_Wallet", "wallet": "Student_Wallet"
        }
        payment_type = payment_map.get(raw_payment, "Cash")

        sale_data = {
            "admin_id": admin_id,
            "item_id": item_id,
            "quantity": qty,
            "total_price": unit_price * qty,
            "payment_type": payment_type
        }
        sale_resp = client.table('sales').insert(sale_data).execute()
        if not sale_resp.data and hasattr(sale_resp, 'error') and sale_resp.error:
            raise Exception(f"Sale insert error: {sale_resp.error}")

        new_stock = max(0, current_stock - qty)
        client.table('inventory').update({
            "current_stock": new_stock,
            "last_updated": datetime.datetime.utcnow().isoformat()
        }).eq('id', item_id).execute()

        return {"ok": True, "new_stock": new_stock}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Record sale error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ──────────────────────────────────────────────────────────────────────────────
# User Registration & Management
# ──────────────────────────────────────────────────────────────────────────────

@app.post("/users/register", response_model=UserProfile)
async def register_user(user_data: UserRegister):
    """Register a new shop owner."""
    try:
        profile = create_user(user_data)
        return profile
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/users/{user_id}/profile", response_model=UserProfile)
async def get_user_profile(user_id: str):
    """Get user profile (mock implementation)."""
    return UserProfile(
        user_id=user_id,
        phone_number="",
        shop_name="",
        city="",
        language_preference="english",
        cash_on_hand=0.0,
        created_at=datetime.datetime.utcnow().isoformat(),
        total_items=0,
        total_inventory_value=0.0
    )


@app.post("/users/{user_id}/csv-import", response_model=ImportResult)
async def bulk_import_inventory(user_id: str, file: UploadFile = File(...)):
    """Bulk import inventory items from CSV."""
    try:
        content = await file.read()
        items, error_rows = parse_csv(content)

        if error_rows and not items:
            raise HTTPException(status_code=400, detail=f"CSV parsing failed: {error_rows}")

        result = bulk_import_items(user_id, items)

        store = get_inventory_store()
        for parsed_item in items:
            item = InventoryItem(
                item_id=str(uuid.uuid4()),
                user_id=user_id,
                item_name=parsed_item.item_name,
                unit_price=parsed_item.unit_price,
                usual_order_qty=parsed_item.usual_order_qty,
                current_stock=parsed_item.current_stock,
                item_category=parsed_item.category,
                created_at=datetime.datetime.utcnow().isoformat(),
                analysis={}
            )
            store.add_item(user_id, item)

        return ImportResult(
            user_id=user_id,
            items_imported=result.items_imported,
            items_failed=result.items_failed,
            failed_rows=result.failed_rows,
            created_at=result.created_at,
            total_inventory_value=result.total_inventory_value
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/csv-template")
async def download_csv_template():
    """Get CSV template for download."""
    template = get_csv_template()
    return {
        "template": template,
        "format": "CSV",
        "required_columns": ["item_name", "unit_price", "usual_order_qty", "current_stock"],
        "optional_columns": ["category"]
    }


@app.get("/categories/list")
async def list_categories():
    """Get all available categories."""
    return {
        "predefined": get_category_names(),
        "category_details": PREDEFINED_CATEGORIES
    }


# ──────────────────────────────────────────────────────────────────────────────
# Portfolio & Category Analytics
# ──────────────────────────────────────────────────────────────────────────────

@app.post("/analyze/all-items", response_model=PortfolioAnalysis)
async def analyze_all_items(user_id: str):
    """Analyze all items for a user at once."""
    store = get_inventory_store()
    items = store.get_user_items(user_id)

    if not items:
        return PortfolioAnalysis(
            user_id=user_id, total_items=0,
            total_cash_utilized=0.0, cash_available=0.0,
            utilization_percentage=0.0, portfolio_risk_status="Safe",
            overall_modifier=1.0, category_analyses={},
            priority_reorder_list=[]
        )

    cash_available = items[0].analysis.get("cash_on_hand", 5000.0) if items[0].analysis else 5000.0
    portfolio = compute_portfolio_analytics(items, cash_available)

    return PortfolioAnalysis(
        user_id=user_id,
        total_items=portfolio["total_items"],
        total_cash_utilized=portfolio["total_cash_utilized"],
        cash_available=portfolio["cash_available"],
        utilization_percentage=portfolio["utilization_percentage"],
        portfolio_risk_status=portfolio["portfolio_risk_status"],
        overall_modifier=portfolio["overall_modifier"],
        category_analyses=portfolio["category_analyses"],
        priority_reorder_list=portfolio["priority_reorder_list"]
    )


@app.post("/analyze/category")
async def analyze_category(user_id: str, category: str):
    """Analyze all items in a specific category."""
    from services.portfolio_service import analyze_category_items
    store = get_inventory_store()
    items = store.get_user_items(user_id)

    if not items:
        return {
            "category": category, "display_name": category.title(),
            "items": [], "total_items": 0,
            "total_current_stock": 0, "total_recommended_stock": 0,
            "total_spend_required": 0.0, "category_trend_modifier": 1.0,
            "category_risk_status": "Safe", "avg_confidence": 0.0,
        }

    return analyze_category_items(items, category)


@app.get("/analytics/summary")
async def get_analytics_summary(user_id: str):
    """Return overall business intelligence dashboard."""
    store = get_inventory_store()
    items = store.get_user_items(user_id)

    if not items:
        return {
            "user_id": user_id, "summary_date": datetime.date.today().isoformat(),
            "total_items": 0, "total_current_stock": 0,
            "total_recommended_stock": 0, "total_revenue_potential": 0.0,
            "total_cost_at_risk": 0.0, "portfolio_risk_status": "Safe",
            "avg_trend_modifier": 1.0, "avg_forecast_confidence": 0.0,
            "best_items": [], "worst_items": [], "insights": [],
        }

    total_current = sum(i.current_stock for i in items)
    total_recommended = 0
    total_spend = 0.0
    trend_mods = []
    confidences = []
    risk_statuses = []
    item_metrics = []

    for item in items:
        analysis = item.analysis or {}
        rec_qty = analysis.get("recommended_qty", item.usual_order_qty)
        total_recommended += rec_qty
        spend = rec_qty * item.unit_price
        total_spend += spend
        trend_mod = analysis.get("trend_modifier", 1.0)
        trend_mods.append(trend_mod)
        conf = analysis.get("forecast_confidence", 0.0)
        confidences.append(conf)
        risk = analysis.get("risk_status", "Safe")
        risk_statuses.append(risk)
        profit = analysis.get("profit_impact", 0.0)

        item_metrics.append({
            "item_name": item.item_name, "category": item.item_category,
            "current_stock": item.current_stock, "recommended_qty": rec_qty,
            "trend_modifier": trend_mod, "risk_status": risk,
            "forecast_confidence": conf, "profit_impact": profit,
        })

    item_metrics.sort(key=lambda x: x["profit_impact"], reverse=True)
    best_items = item_metrics[:5]
    worst_items = item_metrics[-5:] if len(item_metrics) > 5 else []

    critical_count = sum(1 for r in risk_statuses if r == "Critical")
    portfolio_risk = "Critical" if critical_count > 0 else "Safe"

    avg_trend = sum(trend_mods) / len(trend_mods) if trend_mods else 1.0
    avg_conf = sum(confidences) / len(confidences) if confidences else 0.0

    return {
        "user_id": user_id, "summary_date": datetime.date.today().isoformat(),
        "total_items": len(items), "total_current_stock": total_current,
        "total_recommended_stock": total_recommended,
        "total_revenue_potential": total_recommended * 25,
        "total_cost_at_risk": total_spend, "portfolio_risk_status": portfolio_risk,
        "avg_trend_modifier": round(avg_trend, 2),
        "avg_forecast_confidence": round(avg_conf * 100, 1),
        "critical_items": critical_count,
        "best_items": best_items, "worst_items": worst_items,
        "total_items_analyzed": len(items),
    }


# ──────────────────────────────────────────────────────────────────────────────
# Barcode & Product Intelligence
# ──────────────────────────────────────────────────────────────────────────────

@app.get('/product/lookup/{barcode}')
async def product_lookup(barcode: str):
    """Lookup product details by barcode with integrated pricing intelligence."""
    product = await intel_service.identify(barcode)
    if not product:
        product = await lookup_barcode(barcode)

    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    from services.pricing_service import pricing_intel
    prices = await pricing_intel.get_product_prices(barcode, product.get('name'))

    product['market_pricing'] = prices
    product['suggested_price'] = prices.get('mrp') or prices.get('most_common_price')

    return product


@app.post("/barcode/identify")
async def barcode_identify(code: Optional[str] = Form(None), file: Optional[UploadFile] = File(None)):
    """Barcode Intelligence Service — scan an image or type a code to identify an item."""
    if not code and not file:
        raise HTTPException(status_code=400, detail="Either code or image file required")

    barcode = code

    if file:
        try:
            from PIL import Image
            img = Image.open(file.file)
            logger.info("Image received for identification. Decoding via backend channel...")
        except Exception as e:
            logger.warning(f"Backend image decoding failed: {e}")

    if not barcode:
        raise HTTPException(status_code=422, detail="No valid barcode could be identified from the source.")

    result = await intel_service.identify(barcode)
    if not result:
        raise HTTPException(status_code=404, detail="Product not found in any global or local Intelligence database.")

    from services.pricing_service import pricing_intel
    market_data = await pricing_intel.get_product_prices(barcode, result.get('item_name'))

    return {
        "status": "success",
        "barcode": barcode,
        "product": {
            **result,
            "market_pricing": market_data,
            "suggested_price": market_data.get('most_common_price') or result.get('unit_price')
        },
        "metadata": {
            "timestamp": datetime.datetime.now().isoformat(),
            "region": "India",
            "provider": "Bharat-MAS Intel"
        }
    }


# ──────────────────────────────────────────────────────────────────────────────
# Admin Utility
# ──────────────────────────────────────────────────────────────────────────────

@app.delete("/admin/purge-auth-user")
async def purge_auth_user(email: str):
    """Utility to permanently delete a user from Supabase Auth."""
    url = os.environ.get("SUPABASE_URL")
    service_key = os.environ.get("SUPABASE_SERVICE_KEY")
    if not service_key:
        return {"error": "SUPABASE_SERVICE_KEY not found. Delete manually in Supabase Dashboard."}

    admin_client = create_supabase_client(url, service_key)
    try:
        users_resp = admin_client.auth.admin.list_users()
        target = next((u for u in users_resp if u.email == email), None)

        if not target:
            return {"message": f"User {email} not found in Auth system."}

        admin_client.auth.admin.delete_user(target.id)
        return {"message": f"Successfully purged {email} from Supabase Auth."}
    except Exception as e:
        return {"error": str(e)}
