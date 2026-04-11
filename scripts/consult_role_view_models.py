import json
import os
from pathlib import Path

import requests

PROJECT_DIR = Path("/home/ubuntu/complilink_operativo_v1")
OUTPUT_PATH = PROJECT_DIR / "tmp" / "role_view_model_consensus.json"
OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)

PROMPT = """
Contexto del producto:
- Plataforma web TypeScript con autenticación y dashboard CEO.
- El propietario actual debe seguir siendo CEO maestro (admin real, con permisos completos).
- Se quiere añadir una opción segura de \"ver la plataforma como usuario normal\" para demos y muestras.
- No se deben degradar permisos reales del CEO ni romper el perímetro/adminProcedure del backend.
- La solución ideal debe permitir volver rápido al modo CEO.
- También debe ser testeable con Vitest y Playwright.

Necesito una respuesta breve y práctica, en JSON válido, con este esquema exacto:
{
  "recommended_pattern": "...",
  "why": ["...", "...", "..."],
  "backend_contract": ["...", "...", "..."],
  "frontend_contract": ["...", "...", "..."],
  "security_guardrails": ["...", "...", "..."],
  "testing_notes": ["...", "...", "..."],
  "avoid": ["...", "...", "..."]
}

Da una recomendación concreta para una V1.1 pragmática, sin rediseñar toda la auth.
""".strip()


def call_openai():
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        return {"provider": "openai", "error": "OPENAI_API_KEY missing"}

    url = "https://api.openai.com/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": "gpt-4.1-mini",
        "temperature": 0.2,
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": "Eres un arquitecto de producto y seguridad. Responde solo JSON válido."},
            {"role": "user", "content": PROMPT},
        ],
    }
    resp = requests.post(url, headers=headers, json=payload, timeout=60)
    resp.raise_for_status()
    data = resp.json()
    content = data["choices"][0]["message"]["content"]
    return {"provider": "openai", "raw": content, "parsed": json.loads(content)}


def call_xai():
    api_key = os.environ.get("XAI_API_KEY")
    if not api_key:
        return {"provider": "grok", "error": "XAI_API_KEY missing"}

    url = "https://api.x.ai/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": "grok-3-mini",
        "temperature": 0.2,
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": "Eres un arquitecto de producto y seguridad. Responde solo JSON válido."},
            {"role": "user", "content": PROMPT},
        ],
    }
    resp = requests.post(url, headers=headers, json=payload, timeout=60)
    resp.raise_for_status()
    data = resp.json()
    content = data["choices"][0]["message"]["content"]
    return {"provider": "grok", "raw": content, "parsed": json.loads(content)}


def call_gemini():
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        return {"provider": "gemini", "error": "GEMINI_API_KEY missing"}

    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}"
    headers = {"Content-Type": "application/json"}
    payload = {
        "generationConfig": {
            "temperature": 0.2,
            "responseMimeType": "application/json",
        },
        "contents": [
            {
                "role": "user",
                "parts": [{"text": PROMPT}],
            }
        ],
        "systemInstruction": {
            "parts": [{"text": "Eres un arquitecto de producto y seguridad. Responde solo JSON válido."}]
        },
    }
    resp = requests.post(url, headers=headers, json=payload, timeout=60)
    resp.raise_for_status()
    data = resp.json()
    content = data["candidates"][0]["content"]["parts"][0]["text"]
    return {"provider": "gemini", "raw": content, "parsed": json.loads(content)}


def safe_call(fn):
    try:
        return fn()
    except Exception as exc:
        return {"provider": fn.__name__, "error": f"{type(exc).__name__}: {exc}"}


results = {
    "prompt": PROMPT,
    "responses": [
        safe_call(call_openai),
        safe_call(call_xai),
        safe_call(call_gemini),
    ],
}

OUTPUT_PATH.write_text(json.dumps(results, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(str(OUTPUT_PATH))
