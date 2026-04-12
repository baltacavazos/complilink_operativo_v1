import json
import os
from typing import Any

import requests

OUTPUT_PATH = "/home/ubuntu/complilink_operativo_v1/.manus-ai/bridge_logbook_filters_multi_ai.json"

PROMPT = """
Actúa como arquitecto senior full-stack y SRE para una app React + Express + tRPC + Drizzle + MySQL.

Necesito una recomendación mínima y segura para implementar filtros en la **bitácora visible del scheduler bridge** antes de publicar V1.

Contexto confirmado del proyecto:
1. Ya existe una bitácora visible derivada de audit logs, construida en frontend con `buildBridgeScheduleLogbook({ auditTrail, schedules })`.
2. Cada fila hoy tiene al menos: `scheduleId`, `presetId`, `presetName`, `tenantId`, `status` (`success` o `failed`), `executedAt`, `nextRunAt`, `traceId`, `errorMessage`, `visibleCount`, `recipientCount`, `exportFormat`, `attachments`, `appliedFilters`.
3. Ya existe en la misma pantalla un patrón de filtros por chips para el historial smoke con tres dimensiones: estado, ventana temporal y severidad.
4. El siguiente paso aprobado para V1 es añadir a la bitácora del scheduler bridge filtros por: `status`, `preset` y `timeWindow`.
5. Restricción crítica: no ampliar alcance innecesariamente, no crear backend nuevo si no hace falta, no tocar esquema DB para esto.
6. La bitácora hoy muestra las últimas corridas ordenadas por `executedAt` descendente y corta a 6 elementos visibles.

Devuelve solo JSON válido con este esquema exacto:
{
  "recommended_minimum_design": "string",
  "filter_dimensions": ["string"],
  "ui_pattern": ["string"],
  "implementation_notes": ["string"],
  "tests_to_add": ["string"],
  "avoid_for_v1": ["string"],
  "confidence": "low|medium|high"
}

Criterios:
- Prioriza reutilizar el helper/frontend existente y el patrón visual ya usado por el historial smoke.
- Si basta con filtrar en memoria sobre `bridgeScheduleLogbook.rows`, dilo claramente.
- Propón una ventana temporal simple y ejecutiva (por ejemplo all/24h/7d/30d) si eso es suficiente para V1.
- El filtro de preset debe ser práctico con los datos ya disponibles; no propongas buscadores complejos.
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
