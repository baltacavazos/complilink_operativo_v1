import json
import os
from pathlib import Path

import requests

PROMPT = """
Contexto del proyecto:
- El bridge AuditaPatrón ↔ CompliLink ya está operativo y validado con smoke test recurrente.
- La consola CEO ya muestra métricas agregadas del bridge y el último estado persistido del smoke test.
- El usuario pidió seguir con los pendientes en el orden que minimice riesgo y maximice valor inmediato.

Pendientes priorizados ya registrados en todo.md:
1) Añadir historial operativo del bridge con tendencias recientes y filtros básicos dentro de la consola CEO.
2) Disparar alertas al propietario cuando el smoke test falle de forma consecutiva según umbral operativo.
3) Ampliar cobertura de navegador del panel CEO para validar render y refresco del estado operativo del bridge.

Restricciones:
- Hacer cambios mínimos y reutilizar al máximo la infraestructura existente.
- Preferir archivos JSON y utilidades actuales del proyecto antes que introducir nuevas tablas o servicios.
- Mantener compatibilidad con React + Express + tRPC + Vitest + Playwright.
- Priorizar primero el bloque que desbloquee mejor observabilidad para el CEO.

Necesito una recomendación breve, pragmática y comparable.
Responde ÚNICAMENTE en JSON válido con esta forma exacta:
{
  "recommended_first_block": "...",
  "reasoning": ["...", "...", "..."],
  "history_panel": {
    "data_source": "...",
    "ui_scope": ["...", "...", "..."],
    "backend_scope": ["...", "..."],
    "tests": ["...", "..."]
  },
  "owner_alerts": {
    "trigger_rule": "...",
    "minimal_implementation": ["...", "...", "..."],
    "tests": ["...", "..."]
  },
  "browser_coverage": {
    "priority_checks": ["...", "...", "..."],
    "minimal_harness": "..."
  },
  "recommended_order": ["...", "...", "..."],
  "risks": ["...", "..."]
}
""".strip()

OUT_PATH = Path("/home/ubuntu/complilink_operativo_v1/tmp/multi_ai_bridge_next_blocks.json")
OUT_PATH.parent.mkdir(parents=True, exist_ok=True)


def post_openai(prompt: str):
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        return {"error": "OPENAI_API_KEY missing"}
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
                {"role": "system", "content": "Eres un arquitecto de software pragmático. Responde sólo JSON válido."},
                {"role": "user", "content": prompt},
            ],
        },
        timeout=60,
    )
    response.raise_for_status()
    data = response.json()
    return json.loads(data["choices"][0]["message"]["content"])


def post_xai(prompt: str):
    api_key = os.environ.get("XAI_API_KEY")
    if not api_key:
        return {"error": "XAI_API_KEY missing"}
    response = requests.post(
        "https://api.x.ai/v1/chat/completions",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json={
            "model": "grok-4",
            "temperature": 0.2,
            "response_format": {"type": "json_object"},
            "messages": [
                {"role": "system", "content": "Eres un arquitecto de software pragmático. Responde sólo JSON válido."},
                {"role": "user", "content": prompt},
            ],
        },
        timeout=60,
    )
    response.raise_for_status()
    data = response.json()
    return json.loads(data["choices"][0]["message"]["content"])


def post_gemini(prompt: str):
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        return {"error": "GEMINI_API_KEY missing"}
    response = requests.post(
        f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}",
        headers={"Content-Type": "application/json"},
        json={
            "generationConfig": {
                "temperature": 0.2,
                "responseMimeType": "application/json",
            },
            "contents": [
                {
                    "role": "user",
                    "parts": [{"text": prompt}],
                }
            ],
        },
        timeout=60,
    )
    response.raise_for_status()
    data = response.json()
    text = data["candidates"][0]["content"]["parts"][0]["text"]
    return json.loads(text)


result = {}
for name, fn in (("chatgpt", post_openai), ("grok", post_xai), ("gemini", post_gemini)):
    try:
        result[name] = fn(PROMPT)
    except Exception as exc:  # noqa: BLE001
        result[name] = {"error": f"{type(exc).__name__}: {exc}"}

OUT_PATH.write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
print(json.dumps(result, indent=2, ensure_ascii=False))
