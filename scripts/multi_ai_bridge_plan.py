import json
import os
from pathlib import Path

import requests

PROMPT = """
Contexto del proyecto:
- Bridge AuditaPatrón ↔ CompliLink ya operativo.
- Contrato vigente: HMAC sobre `timestamp.body`, endpoints públicos `GET /api/auditapatron/health` y `POST /api/auditapatron/webhook`.
- Ya existe un dashboard CEO con una sección bridge que resume expedientes críticos, warning, pendientes y conformes.
- Ya existe un script `bridge_smoke_test.mjs` que pega a los endpoints públicos, valida el contrato y guarda `bridge_smoke_test_results.json`.
- Próximos 3 pasos confirmados por el usuario, a implementar en este orden:
  1) ampliar panel operativo del bridge con métricas de entregas, rechazos y reintentos;
  2) automatizar smoke test recurrente con persistencia reutilizable por el panel;
  3) ampliar pruebas E2E cubriendo éxito, error, firma inválida y duplicados/idempotencia.

Restricciones:
- Mantener cambios mínimos, compatibles con stack React + Express + tRPC + Vitest + Playwright.
- Priorizar reutilizar el JSON persistido del smoke test antes que crear infraestructura nueva.
- Evitar migraciones SQL si no son estrictamente necesarias.
- Proponer una secuencia de implementación concreta, breve y de bajo riesgo.

Responde ÚNICAMENTE en JSON válido con esta forma exacta:
{
  "panel": ["...", "...", "..."],
  "smoke_automation": ["...", "...", "..."],
  "e2e": ["...", "...", "..."],
  "risks": ["...", "..."],
  "recommended_order": ["...", "...", "..."]
}
""".strip()

OUT_PATH = Path("/home/ubuntu/complilink_operativo_v1/tmp/multi_ai_bridge_plan.json")
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
