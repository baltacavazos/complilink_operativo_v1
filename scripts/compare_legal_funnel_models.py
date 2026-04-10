import json
import os
import requests
from pathlib import Path

PROMPT = """
Contexto: proyecto web de AuditaPatron con arquitectura interna Helios-first. Ya se endureció acceptLegalPackage para reducir duplicados y ya existe instrumentación básica del embudo en frontend con Umami. La siguiente iteración busca tres cosas: (a) llevar la idempotencia a un nivel persistente, resistente a reintentos y concurrencia real, (b) exponer una lectura operativa mínima del embudo sin introducir una nueva plataforma analítica compleja, y (c) validar login, /auditar y páginas legales bajo el dominio final del proyecto.

Objetivo:
1. Recomienda la estrategia más robusta y pragmática para persistir una idempotency key o huella transaccional en backend para consentimientos/aceptación legal.
2. Indica el mínimo panel, consulta, vista o reporte interno que permita leer el embudo ya instrumentado sin sobreconstruir infraestructura.
3. Propón una estrategia de validación final bajo dominio propio/manus space para login, rutas legales y /auditar.
4. Da riesgos concretos, pruebas mínimas y orden recomendado de implementación.

Restricciones:
- Priorizar cambios pequeños, seguros y compatibles con la base actual.
- No introducir servicios nuevos si puede resolverse con DB, backend y Umami ya existentes.
- Pensar en confiabilidad útil para el usuario final, no solo elegancia técnica.

Responde en JSON estricto con esta forma:
{
  "persistent_idempotency": {
    "recommended_strategy": "",
    "storage_shape": "",
    "must_have_controls": [""],
    "failure_modes": [""],
    "test_cases": [""]
  },
  "funnel_readout": {
    "recommended_strategy": "",
    "minimum_viable_surface": "",
    "metrics_or_events_to_show": [""],
    "risks": [""]
  },
  "final_domain_validation": {
    "recommended_strategy": "",
    "critical_checks": [""],
    "risks": [""]
  },
  "implementation_order": [""],
  "confidence": "high|medium|low"
}
""".strip()

OUT = Path("/home/ubuntu/complilink_operativo_v1/tmp/model_consensus_next_iteration.json")
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
