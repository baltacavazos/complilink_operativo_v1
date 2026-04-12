import json
import os
from typing import Any

import requests

OUTPUT_PATH = "/home/ubuntu/complilink_operativo_v1/.manus-ai/bridge_logbook_enhancements_multi_ai.json"

PROMPT = """
Actúa como arquitecto senior full-stack para una app React 19 + TypeScript + tRPC + Drizzle.

Necesito una recomendación V1, conservadora y fácil de usar, para ampliar la bitácora visible del scheduler bridge.

Contexto confirmado:
1. Ya existe una bitácora visible con filas derivadas de audit logs.
2. Ya existen filtros por estado, preset y ventana temporal en frontend, aplicados en memoria.
3. Se aprobó implementar tres mejoras adicionales:
   - búsqueda por texto sobre `errorMessage`, `traceId`, `presetName` y/o identificador de agenda
   - persistencia de filtros en la URL para que la vista se pueda compartir o recargar sin perder contexto
   - exportación del subconjunto filtrado desde la misma bitácora
4. Restricciones: evitar backend nuevo si no es indispensable, no tocar esquema DB, no volver compleja la UX.
5. La sección vive dentro de un dashboard ejecutivo; debe seguir siendo rápida y autoexplicativa.
6. La bitácora visible sigue mostrando un subconjunto reciente, pero el filtrado puede correr en memoria sobre las filas derivadas.

Devuelve solo JSON válido con este esquema exacto:
{
  "recommended_search_design": "string",
  "recommended_persistence_design": "string",
  "recommended_export_design": "string",
  "ui_principles": ["string"],
  "implementation_notes": ["string"],
  "tests_to_add": ["string"],
  "avoid_for_v1": ["string"],
  "confidence": "low|medium|high"
}

Criterios:
- Prioriza simplicidad y bajo riesgo.
- Si la búsqueda debe ser substring case-insensitive en memoria, dilo explícitamente.
- Si la persistencia debe usar query params cortos y estables, dilo explícitamente.
- Si la exportación debe ser CSV o JSON generado en cliente sin backend, dilo explícitamente y justifica cuál conviene más para un dashboard ejecutivo.
- No propongas modales complejos, tablas avanzadas ni nuevas rutas dedicadas salvo que sea estrictamente necesario.
- No expliques nada fuera del JSON.
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
            {"role": "system", "content": "Eres un arquitecto pragmático, conservador y orientado a V1."},
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
                {"role": "system", "content": "Eres un arquitecto pragmático, conservador y orientado a V1."},
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
    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
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
