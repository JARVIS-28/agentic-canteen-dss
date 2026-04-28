"""
Bharat-MAS — XAI Explanation Agent (Decision Support System Translator)

Role in the pipeline:
  • Receives the fully-resolved AgentState (after Risk Agent)
  • Reads all upstream agent outputs: Q*, α, DSS options, liquidity ratio
  • Produces a structured English explanation in the voice of a knowledgeable advisor.
  • Uses Hugging Face free serverless inference API for dynamic text generation, 
    with a zero-latency internal template fallback.
"""

import os
import httpx
import datetime
import json
from pathlib import Path
from typing import Any, Dict

HF_API_KEY = os.getenv("HF_API_KEY")
HF_ROUTER_URL = os.getenv("HF_ROUTER_URL") or "https://router.huggingface.co/v1/chat/completions"
HF_MODEL_ID = os.getenv("HF_MODEL_ID") or "Qwen/Qwen2.5-7B-Instruct"
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
GROQ_BASE_URL = (os.getenv("GROQ_BASE_URL") or "https://api.groq.com").rstrip("/")
GROQ_MODEL = os.getenv("GROQ_MODEL") or "llama-3.1-8b-instant"
OLLAMA_BASE_URL = (os.getenv("OLLAMA_BASE_URL") or "http://localhost:11434").rstrip("/")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL") or "llama2:latest"
ENABLE_OLLAMA = (os.getenv("ENABLE_OLLAMA") or "false").lower() == "true"
EXPLANATION_PROVIDER = (os.getenv("EXPLANATION_PROVIDER") or "auto").lower()


def _call_openai_compatible(
    *,
    base_url: str,
    api_key: str,
    model: str,
    system_prompt: str,
    user_prompt: str,
    timeout: float = 15.0,
) -> str:
    """Call any OpenAI-compatible chat completion endpoint."""
    if not api_key:
        return ""

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "max_tokens": 140,
        "temperature": 0.4,
    }

    with httpx.Client(timeout=timeout) as client:
        resp = client.post(f"{base_url}/chat/completions", headers=headers, json=payload)
        resp.raise_for_status()
        data = resp.json()
        choices = data.get("choices")
        if not isinstance(choices, list) or not choices:
            return ""
        message = choices[0].get("message") if isinstance(choices[0], dict) else {}
        content = message.get("content") if isinstance(message, dict) else ""
        return str(content).strip() if content else ""

def _template_fallback(state: Dict[str, Any]) -> str:
    """
    A naturally-written structured string that acts as our Decision Support System advisor.
    Requires no GPU or internal LLM to run.
    """
    item    = state.get("item_name", "this item").title()
    usual   = state.get("usual_order_qty", 0)
    rec     = state.get("recommended_qty", 0)
    mod     = state.get("trend_modifier", 1.0)
    action  = state.get("mdp_action", "SAFE")
    ratio   = state.get("liquidity_ratio", 0.0)
    cash    = state.get("cash_on_hand", 0.0)
    is_perishable = state.get("is_perishable", False)
    expiry = state.get("expiry_date") or "its expiry"
    
    change  = rec - usual
    pct     = (change / usual * 100) if usual > 0 else 0

    direction = "more" if change > 0 else "less" if change < 0 else "the same amount"
    trend_dir = "higher than usual market demand" if mod > 1.05 else \
                "lower than usual market demand" if mod < 0.95 else \
                "stable market conditions"

    # Load operational settings from DB (with fallback)
    from services.settings_service import fetch_settings
    admin_id = state.get("admin_id") or state.get("user_id", "unknown")
    settings = fetch_settings(admin_id)
    close_time = settings.get("close_time", "17:00")

    if is_perishable:
        storage_note = f"Since {item} are perishable, they cannot be stored overnight and must be sold today before {close_time}."
    else:
        storage_note = f"Since {item} are non-perishable, they can be stocked until {expiry}."

    time_r = state.get("time_reason", "")
    confidence = state.get("forecast_confidence", 0.0)
    conf_pct = int(confidence * 100)
    
    conf_reason = "High confidence due to strong signal alignment." if confidence > 0.9 else \
                  "Solid confidence based on historical demand patterns." if confidence >= 0.85 else \
                  "Moderate confidence based on available data."

    lines = [
        f"We suggest a Moderate order of {rec} units of {item}. This is {abs(change)} units {direction} than your usual order ({pct:+.0f}%).",
        f"Market signals show {trend_dir} (driven by weather, college events, and local trends).",
        f"AI Intelligence: {conf_pct}% confidence. {conf_reason}",
        f"Freshness Factor: {time_r}",
        storage_note
    ]

    if action == "SAFE":
        lines.append(f"Financial Safety: Safe. You will use {ratio:.0%} of your available Rs. {cash:,.0f}.")
    elif action == "CAUTION":
        lines.append(f"Financial Safety: Caution. A full aggressive order pushes your cash usage over 80%. We strongly recommend the Conservative option instead.")
    else:
        lines.append(f"Financial Safety: Critical Risk. This order breaches your available cash. Only order what is strictly necessary.")

    lines.append(f"As a Decision Support Tool, you may view multiple options below (Conservative, Moderate, Aggressive) to decide what best fits your current business.")
    return "\n\n".join(lines)


def _call_huggingface(system_prompt: str, user_prompt: str) -> str:
    """POST to Hugging Face Router first, then Inference API fallback."""
    if not HF_API_KEY:
        return ""

    # Attempt 1: Router (OpenAI-compatible)
    try:
        router_base = HF_ROUTER_URL
        if "/chat/completions" in router_base:
            router_base = router_base.split("/chat/completions", 1)[0]
        router_base = router_base.rstrip("/")

        return _call_openai_compatible(
            base_url=router_base,
            api_key=HF_API_KEY,
            model=HF_MODEL_ID,
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            timeout=15.0,
        )
    except Exception as router_exc:
        # Attempt 2: Inference API text-generation fallback (avoids router-specific 400s)
        inference_url = f"https://api-inference.huggingface.co/models/{HF_MODEL_ID}"
        headers = {
            "Authorization": f"Bearer {HF_API_KEY}",
            "Content-Type": "application/json",
        }
        prompt = f"System: {system_prompt}\n\nUser: {user_prompt}\n\nAssistant:"
        payload = {
            "inputs": prompt,
            "parameters": {
                "max_new_tokens": 140,
                "temperature": 0.4,
                "return_full_text": False,
            },
        }

        if "402" in str(router_exc) or "Payment Required" in str(router_exc):
            print(f"[ExplanationAgent] Hugging Face Quota Exceeded (402). Falling back to internal template.")
        else:
            print(f"[ExplanationAgent] Hugging Face Router Error: {router_exc}")

        try:
            with httpx.Client(timeout=20.0) as client:
                resp = client.post(inference_url, headers=headers, json=payload)
                resp.raise_for_status()
                data = resp.json()
                if isinstance(data, list) and data:
                    first = data[0]
                    if isinstance(first, dict) and first.get("generated_text"):
                        return str(first["generated_text"]).strip()
                if isinstance(data, dict) and data.get("generated_text"):
                    return str(data["generated_text"]).strip()
                return ""
        except Exception as inference_exc:
            print(f"[ExplanationAgent] Hugging Face Inference API Error: {inference_exc}")
            return ""


def _call_groq(system_prompt: str, user_prompt: str) -> str:
    """POST to Groq (OpenAI-compatible), free-tier friendly for hosted deployments."""
    if not GROQ_API_KEY:
        return ""

    try:
        return _call_openai_compatible(
            base_url=f"{GROQ_BASE_URL}/openai/v1",
            api_key=GROQ_API_KEY,
            model=GROQ_MODEL,
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            timeout=15.0,
        )
    except Exception as exc:
        print(f"[ExplanationAgent] Groq Error ({GROQ_MODEL}): {exc}")
        return ""


def _call_ollama(system_prompt: str, user_prompt: str) -> str:
    """POST to local Ollama server (chat endpoint)."""
    payload = {
        "model": OLLAMA_MODEL,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ],
        "stream": False,
        "options": {
            "temperature": 0.4
        }
    }

    try:
        with httpx.Client(timeout=60.0) as client:
            resp = client.post(f"{OLLAMA_BASE_URL}/api/chat", json=payload)
            resp.raise_for_status()
            data = resp.json()
            if isinstance(data, dict):
                message = data.get("message") or {}
                content = message.get("content") if isinstance(message, dict) else ""
                if content:
                    return str(content).strip()
                # Compatibility fallback for non-chat response formats.
                if data.get("response"):
                    return str(data.get("response", "")).strip()
            return ""
    except Exception as exc:
        print(f"[ExplanationAgent] Ollama Error ({OLLAMA_MODEL} @ {OLLAMA_BASE_URL}): {exc}")
        return ""


def explanation_agent(state: Dict[str, Any]) -> Dict[str, Any]:
    """
    LangGraph Node: Explanation Agent.
    Uses cloud-hosted providers first (Groq/Hugging Face), optional Ollama,
    then falls back to an instantaneous internal string template.
    """
    item    = state.get("item_name", "item")
    usual   = state.get("usual_order_qty", 0)
    rec     = state.get("recommended_qty", 0)
    mod     = state.get("trend_modifier", 1.0)
    action  = state.get("mdp_action", "SAFE")
    ratio   = state.get("liquidity_ratio", 0.0)

    is_perishable = state.get("is_perishable", False)
    expiry = state.get("expiry_date") or "its expiry"

    system_msg = (
        "You are a friendly business advisor talking to a small shop owner. Give a very simple explanation about an inventory order. "
        "IMPORTANT: If an item is perishable, you MUST warn them that it cannot be stored past today's closing time. "
    )
    
    # ── GET ADVISORY CONTEXT ──
    # Use provided current_time from state if available
    current_time_from_state = state.get("current_time")
    if current_time_from_state:
        current_time = current_time_from_state
    else:
        current_time = datetime.datetime.now().strftime("%H:%M")
    
    # Load operational settings from DB (with fallback)
    from services.settings_service import fetch_settings
    admin_id = state.get("admin_id") or state.get("user_id", "unknown")
    settings = fetch_settings(admin_id)
    close_time = settings.get("close_time", "17:00")

    horizon = state.get("horizon_days", 1)
    
    # Precise Labeling
    if horizon == 0:
        horizon_label = "for the rest of today"
    elif horizon == 1:
        horizon_label = "for tomorrow's operations"
    else:
        horizon_label = f"for the next {horizon} days"
    
    if is_perishable:
        storage_info = f"CRITICAL: This item is PERISHABLE. It MUST be sold within the same working day. Storage overnight is FORBIDDEN. Even though the plan is {horizon_label}, we only recommend 1 day's supply to keep it fresh."
    else:
        storage_info = f"This item is non-perishable. It can be stored safely in the warehouse until its expiry date ({expiry})."
    
    time_r = state.get("time_reason", "Item freshness and workday timings have been considered.")
    
    user_msg = (
        f"PLANNING CONTEXT: {horizon_label.upper()}\n"
        f"ITEM: {item.title()}\n"
        f"TOTAL RECOMMENDED IN THIS ADVICE: {rec} units\n"
        f"DAILY SALES BASE: {usual} units\n"
        f"TIME REASON: {time_r}\n"
        f"STORAGE POLICY: {storage_info}\n\n"
        f"INSTRUCTIONS:\n"
        f"1. Start your response by explicitly mentioning the planning timeframe: '{horizon_label}'\n"
        f"2. Explicitly mention that the AI is {int(state.get('forecast_confidence', 0)*100)}% confident in this recommendation and briefly explain why (e.g. alignment of signals or historical stability).\n"
        f"3. For Perishables: Explain why the quantity was adjusted (Mention: {time_r})\n"
        f"4. Be professional and friendly. Write 3-4 sentences total in PURE ENGLISH (No Hinglish or Hindi)."
    )
    
    # ── OPTIMIZATION: Only use LLM for the Primary Tomorrow Horizon ──
    # Non-primary horizons (today, week, month) use the fast template fallback 
    # to prevent parallel LLM batch processing from timing out the request.
    if horizon != 1:
        explanation = _template_fallback(state)
        provider_used = "template"
    else:
        try:
            raw = ""
            provider_used = ""

            if EXPLANATION_PROVIDER == "groq":
                raw = _call_groq(system_msg, user_msg)
                provider_used = "groq" if raw and len(raw) > 10 else ""
            elif EXPLANATION_PROVIDER == "huggingface":
                raw = _call_huggingface(system_msg, user_msg)
                provider_used = "huggingface" if raw and len(raw) > 10 else ""
            elif EXPLANATION_PROVIDER == "ollama":
                raw = _call_ollama(system_msg, user_msg)
                provider_used = "ollama" if raw and len(raw) > 10 else ""
            else:
                # auto mode: hosted-free first, local Ollama only if explicitly enabled
                if GROQ_API_KEY:
                    raw = _call_groq(system_msg, user_msg)
                    provider_used = "groq" if raw and len(raw) > 10 else ""

                if not provider_used and HF_API_KEY:
                    raw = _call_huggingface(system_msg, user_msg)
                    provider_used = "huggingface" if raw and len(raw) > 10 else ""

                if not provider_used and ENABLE_OLLAMA:
                    raw = _call_ollama(system_msg, user_msg)
                    provider_used = "ollama" if raw and len(raw) > 10 else ""

            if raw and len(raw) > 10:
                explanation = raw.replace("**", "").replace("__", "").replace("#", "").strip()
            else:
                explanation = _template_fallback(state)
                provider_used = "template"
        except Exception as e:
            print(f"[ExplanationAgent] LLM Pipeline failure: {e}")
            explanation = _template_fallback(state)
            provider_used = "template fallback (error)"

    log_entry = {
        "agent":     "ExplanationAgent",
        "timestamp": datetime.datetime.utcnow().isoformat(),
        "thought": (
            f"[DSS Advisor] {item.title()}: rec={rec}, "
            f"trend={mod:.2f}×, DSS Action={action}, "
            f"cash={ratio:.0%} used. "
            f"Provider Used: {provider_used}."
        ),
        "output": {
            "provider_used":       provider_used,
            "explanation_length":  len(explanation),
            "recommendation":      rec,
            "mdp_action":          action,
            "liquidity_ratio":     round(ratio, 4)
        },
    }

    existing_log = state.get("agent_thought_log", [])
    return {
        "explanation_english":  explanation,
        "explanation_hinglish": explanation, # For this version, both use the LLM output (which we set to Hinglish)
        "agent_thought_log":    existing_log + [log_entry],
    }
