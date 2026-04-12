import json
import os
from typing import Any

import requests

OUTPUT_PATH = "/home/ubuntu/complilink_operativo_v1/.manus-ai/bridge_schedule_incident_multi_ai.json"

PROMPT = """
Actúa como arquitecto senior de software y SRE para una app React + Express + tRPC + Drizzle + MySQL.

Necesito un dictamen corto y pragmático sobre si existe hoy un bloqueo real para publicar V1 en el módulo bridge scheduling.

Evidencia confirmada del proyecto:
1. El log histórico del servidor muestra a las 2026-04-12T14:43:20Z un error del worker: Table '...ceo_bridge_schedules' doesn't exist, durante el Initial scan del scheduler.
2. El esquema y la migración 0004_even_liz_osborn.sql sí crean ceo_bridge_presets y ceo_bridge_schedules, con índices y foreign keys.
3. Una inspección directa actual a la base confirma que HOY existen ambas tablas, existen los índices esperados, existen las foreign keys esperadas y la migración 0004 está registrada en __drizzle_migrations.
4. Un grep reciente de logs ya no muestra nuevas ocurrencias posteriores del error del scheduler.
5. El worker del bridge sigue consultando ceo_bridge_schedules al iniciar.

Quiero solo JSON válido con este esquema exacto:
{
  "current_assessment": "string",
  "likely_root_cause": "string",
  "publish_blocker_now": true,
  "minimal_safe_action": ["string"],
  "what_not_to_do": ["string"],
  "confidence": "low|medium|high"
}

Criterios:
- Distingue con claridad entre incidente histórico ya resuelto vs bloqueo activo actual.
- Prioriza acciones mínimas y verificables.
- No propongas refactors grandes.
- No expliques fuera del JSON.
""".strip()


def post_json(url: str, headers: dict[str, str], payload: dict[str, Any]) -> dict[str, Any]:
    response = requests.post(url, headers=headers, json=payload, timeout=120)
    return {"status_code": response.status_code, "body": response.text}


def extract_openai_json(raw: dict[str, Any]) -> dict[str, Any]:
    parsed = json.loads(raw["body"])
    content = parsed["choices"][0]["message"]["content"]
    return json.loads(content)


def extract_xai_json(raw: dict[str, Any]) -> dict[str, Any]:
    parsed = json.loads(raw["body"])
    content = parsed["choices"][0]["message"]["content"]
    return json.loads(content)


def extract_gemini_json(raw: dict[str, Any]) -> dict[str, Any]:
    parsed = json.loads(raw["body"])
    text = parsed["candidates"][0]["content"]["parts"][0]["text"]
    return json.loads(text)


def call_openai() -> dict[str, Any]:
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        return {"provider": "chatgpt", "ok": False, "error": "OPENAI_API_KEY missing"}
    payload = {
        "model": "gpt-4.1-mini",
        "temperature": 0.1,
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": "Eres un arquitecto pragmático, conservador y orientado a validación operativa."},
            {"role": "user", "content": PROMPT},
        ],
    }
    raw = post_json(
        "https://api.openai.com/v1/chat/completions",
        {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        payload,
    )
    try:
        return {"provider": "chatgpt", "ok": True, "data": extract_openai_json(raw)}
    except Exception as exc:
        return {"provider": "chatgpt", "ok": False, "error": str(exc), "raw": raw}


def call_grok() -> dict[str, Any]:
    api_key = os.environ.get("XAI_API_KEY")
    if not api_key:
        return {"provider": "grok", "ok": False, "error": "XAI_API_KEY missing"}
    models = ["grok-3-mini-beta", "grok-4-fast-non-reasoning", "grok-4"]
    last_error = None
    for model in models:
        payload = {
            "model": model,
            "temperature": 0.1,
            "response_format": {"type": "json_object"},
            "messages": [
                {"role": "system", "content": "Eres un arquitecto pragmático, conservador y orientado a validación operativa."},
                {"role": "user", "content": PROMPT},
            ],
        }
        raw = post_json(
            "https://api.x.ai/v1/chat/completions",
            {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            payload,
        )
        try:
            return {"provider": "grok", "ok": True, "model": model, "data": extract_xai_json(raw)}
        except Exception as exc:
            last_error = {"provider": "grok", "ok": False, "model": model, "error": str(exc), "raw": raw}
    return last_error or {"provider": "grok", "ok": False, "error": "unknown grok failure"}


def call_gemini() -> dict[str, Any]:
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        return {"provider": "gemini", "ok": False, "error": "GEMINI_API_KEY missing"}
    models = ["gemini-2.5-flash", "gemini-2.0-flash-lite", "gemini-2.0-flash"]
    last_error = None
    for model in models:
        raw = post_json(
            f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}",
            {"Content-Type": "application/json"},
            {
                "generationConfig": {"temperature": 0.1, "responseMimeType": "application/json"},
                "contents": [{"parts": [{"text": PROMPT}]}],
            },
        )
        try:
            return {"provider": "gemini", "ok": True, "model": model, "data": extract_gemini_json(raw)}
        except Exception as exc:
            last_error = {"provider": "gemini", "ok": False, "model": model, "error": str(exc), "raw": raw}
    return last_error or {"provider": "gemini", "ok": False, "error": "unknown gemini failure"}


def main() -> None:
    results = {
        "prompt": PROMPT,
        "models": {
            "chatgpt": call_openai(),
            "grok": call_grok(),
            "gemini": call_gemini(),
        },
    }
    with open(OUTPUT_PATH, "w", encoding="utf-8") as file:
        json.dump(results, file, ensure_ascii=False, indent=2)
    print(json.dumps(results, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
