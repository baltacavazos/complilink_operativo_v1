import json
import os
import requests
from pathlib import Path

PROMPT = """
Contexto: proyecto web de AuditaPatron con arquitectura interna Helios-first. Hay una mutación backend llamada acceptLegalPackage que hoy ya usa un lock lógico por caso/version, pero todavía puede crear duplicados de consentimientos y contratos si llegan reintentos o concurrencia. También hay que instrumentar un embudo analítico ya existente con Umami, sin introducir nueva infraestructura.

Objetivo:
1. Recomienda la estrategia más robusta y pragmática para blindar acceptLegalPackage con idempotencia real en backend.
2. Indica si conviene usar solo lock aplicativo, huella/idempotency key persistida en DB, verificación previa por versión legal y/o constraints únicos.
3. Propón un enfoque mínimo y seguro para instrumentar el embudo home → expediente → aceptación legal → subida documental usando Umami ya cargado globalmente en el frontend.
4. Da riesgos concretos, pruebas mínimas y sugerencias de naming de eventos.

Responde en JSON estricto con esta forma:
{
  "backend_idempotency": {
    "recommended_strategy": "",
    "why": "",
    "must_have_controls": [""],
    "db_or_app_tradeoff": "",
    "test_cases": [""]
  },
  "analytics_funnel": {
    "recommended_strategy": "",
    "event_names": [""],
    "trigger_points": [""],
    "risks": [""]
  },
  "implementation_order": [""],
  "confidence": "high|medium|low"
}
""".strip()

OUT = Path("/home/ubuntu/complilink_operativo_v1/tmp/model_consensus_legal_funnel.json")
OUT.parent.mkdir(parents=True, exist_ok=True)

headers_json = {"Content-Type": "application/json"}


def call_openai():
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        return {"status": "missing_env", "provider": "openai"}
    payload = {
        "model": "gpt-4.1-mini",
        "temperature": 0.1,
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": "Eres un arquitecto de software cauteloso. Devuelve solo JSON válido."},
            {"role": "user", "content": PROMPT},
        ],
    }
    r = requests.post(
        "https://api.openai.com/v1/chat/completions",
        headers={**headers_json, "Authorization": f"Bearer {api_key}"},
        json=payload,
        timeout=90,
    )
    data = r.json()
    if r.ok:
        content = data["choices"][0]["message"]["content"]
        return {"status": "ok", "provider": "openai", "raw": content, "parsed": json.loads(content)}
    return {"status": "error", "provider": "openai", "http_status": r.status_code, "body": data}


def call_xai():
    api_key = os.getenv("XAI_API_KEY")
    if not api_key:
        return {"status": "missing_env", "provider": "grok"}
    payload = {
        "model": "grok-4",
        "temperature": 0.1,
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": "Eres un arquitecto de software cauteloso. Devuelve solo JSON válido."},
            {"role": "user", "content": PROMPT},
        ],
    }
    r = requests.post(
        "https://api.x.ai/v1/chat/completions",
        headers={**headers_json, "Authorization": f"Bearer {api_key}"},
        json=payload,
        timeout=90,
    )
    data = r.json()
    if r.ok:
        content = data["choices"][0]["message"]["content"]
        return {"status": "ok", "provider": "grok", "raw": content, "parsed": json.loads(content)}
    return {"status": "error", "provider": "grok", "http_status": r.status_code, "body": data}


def call_gemini():
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        return {"status": "missing_env", "provider": "gemini"}
    payload = {
        "generationConfig": {
            "temperature": 0.1,
            "responseMimeType": "application/json",
        },
        "contents": [
            {
                "role": "user",
                "parts": [{"text": PROMPT}],
            }
        ],
    }
    r = requests.post(
        f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}",
        headers=headers_json,
        json=payload,
        timeout=90,
    )
    data = r.json()
    if r.ok:
        content = data["candidates"][0]["content"]["parts"][0]["text"]
        return {"status": "ok", "provider": "gemini", "raw": content, "parsed": json.loads(content)}
    return {"status": "error", "provider": "gemini", "http_status": r.status_code, "body": data}


results = {
    "prompt": PROMPT,
    "results": {
        "openai": call_openai(),
        "grok": call_xai(),
        "gemini": call_gemini(),
    },
}

OUT.write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")
print(str(OUT))
