import json
import os
from pathlib import Path

import requests

PROJECT_DIR = Path("/home/ubuntu/complilink_operativo_v1")
OUTPUT_PATH = PROJECT_DIR / ".manus-notes" / "ceo_hybrid_view_round2_consensus.json"
OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)

PROMPT = """
Contexto actual del producto:
- Ya existe una experiencia híbrida inicial donde el CEO puede usar /auditar como vista base y abrir acciones ejecutivas de forma discreta.
- Ahora se autorizó una segunda ronda con tres objetivos simultáneos:
  1) añadir una pestaña o acceso fijo CEO en el header operativo;
  2) guardar de forma persistente si el panel CEO debe abrirse o permanecer cerrado;
  3) extender el mismo patrón híbrido a /acceso y a la home privada para que el comportamiento sea consistente.
- El cambio debe ser mínimo viable, reversible y con el menor riesgo de regresión posible.
- No se debe degradar la seguridad: solo admins reales ven y usan controles CEO.
- Se prefiere reusar estado, componentes y patrones ya existentes, evitando infraestructura nueva si no es necesaria.

Devuélveme JSON válido con este esquema exacto:
{
  "recommended_pattern": "...",
  "header_entry": ["...", "...", "..."],
  "persistence_strategy": ["...", "...", "..."],
  "surface_extension": ["...", "...", "..."],
  "implementation_order": ["...", "...", "..."],
  "risks": ["...", "...", "..."],
  "avoid": ["...", "...", "..."]
}

Responde para una V1.1 pragmática. Prioriza claridad de navegación, consistencia entre superficies y mínimo cambio estructural.
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
