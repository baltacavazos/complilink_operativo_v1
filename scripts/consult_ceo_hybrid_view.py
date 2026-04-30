import json
import os
from pathlib import Path

import requests

PROJECT_DIR = Path("/home/ubuntu/complilink_operativo_v1")
OUTPUT_PATH = PROJECT_DIR / ".manus-notes" / "ceo_hybrid_view_consensus.json"
OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)

PROMPT = """
Contexto actual del producto:
- Existe una ruta operativa principal de usuario en /auditar.
- Existe una consola ejecutiva separada en /ceo y subrutas /ceo/*.
- El administrador real puede activar un modo para verse como usuario normal.
- En ese modo, el sistema redirige fuera de /ceo hacia /auditar.
- El deseo de producto ahora es: mantener la vista de usuario normal como base para el CEO, pero darle una entrada visible y discreta a sus acciones ejecutivas, sin sentir que cambia de mundo cada vez.
- No se debe degradar el perímetro real de seguridad: admin sigue siendo admin real; la simulación no debe abrir acciones CEO a usuarios normales.
- Se prefiere un cambio mínimo viable, pragmático y reversible en frontend, con el menor riesgo de regresión posible.

Necesito una respuesta breve y práctica, en JSON válido, con este esquema exacto:
{
  "recommended_pattern": "...",
  "why": ["...", "...", "..."],
  "ui_shape": ["...", "...", "..."],
  "routing_strategy": ["...", "...", "..."],
  "security_guardrails": ["...", "...", "..."],
  "implementation_order": ["...", "...", "..."],
  "avoid": ["...", "...", "..."]
}

Da una recomendación concreta para una V1.1 pragmática. Prioriza simplicidad, claridad de navegación y mínimo cambio estructural.
""".strip()


def call_openai():
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        return {"provider": "openai", "error": "OPENAI_API_KEY missing"}
    response = requests.post(
        "https://api.openai.com/v1/chat/completions",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json={
            "model": "gpt-4.1-mini",
            "temperature": 0.2,
            "response_format": {"type": "json_object"},
            "messages": [
                {"role": "system", "content": "Eres un arquitecto de producto y UX. Responde solo JSON válido."},
                {"role": "user", "content": PROMPT},
            ],
        },
        timeout=60,
    )
    response.raise_for_status()
    data = response.json()
    content = data["choices"][0]["message"]["content"]
    return {"provider": "openai", "raw": content, "parsed": json.loads(content)}


def call_grok():
    api_key = os.environ.get("XAI_API_KEY")
    if not api_key:
        return {"provider": "grok", "error": "XAI_API_KEY missing"}
    response = requests.post(
        "https://api.x.ai/v1/chat/completions",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json={
            "model": "grok-3-mini",
            "temperature": 0.2,
            "response_format": {"type": "json_object"},
            "messages": [
                {"role": "system", "content": "Eres un arquitecto de producto y UX. Responde solo JSON válido."},
                {"role": "user", "content": PROMPT},
            ],
        },
        timeout=60,
    )
    response.raise_for_status()
    data = response.json()
    content = data["choices"][0]["message"]["content"]
    return {"provider": "grok", "raw": content, "parsed": json.loads(content)}


def call_gemini():
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        return {"provider": "gemini", "error": "GEMINI_API_KEY missing"}
    response = requests.post(
        f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}",
        headers={"Content-Type": "application/json"},
        json={
            "generationConfig": {
                "temperature": 0.2,
                "responseMimeType": "application/json",
            },
            "systemInstruction": {
                "parts": [{"text": "Eres un arquitecto de producto y UX. Responde solo JSON válido."}]
            },
            "contents": [
                {
                    "role": "user",
                    "parts": [{"text": PROMPT}],
                }
            ],
        },
        timeout=60,
    )
    response.raise_for_status()
    data = response.json()
    content = data["candidates"][0]["content"]["parts"][0]["text"]
    return {"provider": "gemini", "raw": content, "parsed": json.loads(content)}


def safe_call(name, fn):
    try:
        return fn()
    except Exception as exc:
        return {"provider": name, "error": f"{type(exc).__name__}: {exc}"}


results = {
    "prompt": PROMPT,
    "responses": [
        safe_call("openai", call_openai),
        safe_call("grok", call_grok),
        safe_call("gemini", call_gemini),
    ],
}

OUTPUT_PATH.write_text(json.dumps(results, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(str(OUTPUT_PATH))
