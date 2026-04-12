import json
import os
import requests
from typing import Any

PROMPT = """
Actúa como arquitecto senior full-stack para una app React + tRPC + Express + Drizzle/MySQL.

Contexto real del código existente:
1. Ya existe un procedimiento backend `ceoRecordExportAudit` que registra auditoría cuando se exporta una sección del dashboard CEO. Guarda: tenantId opcional, section, format, snapshotGeneratedAt, appliedFilters y visibleCount.
2. Ya existe un procedimiento backend `ceoEmailBridgeExport` para la sección bridge. Valida snapshot fresco, envía correo con Resend a 1-5 destinatarios, mensaje opcional, y hasta 2 adjuntos (PDF/CSV en base64). Luego registra auditoría con acción `dashboard.ceo.export_emailed`.
3. En frontend, el dashboard CEO ya tiene:
   - filtros globales transversales,
   - filtros específicos de historial smoke del bridge,
   - botones superiores para Exportar CSV, Reporte PDF, Enviar por correo y Actualizar,
   - control para ajustar el umbral de alerting del smoke test del bridge.
4. El frontend actual genera los adjuntos PDF/CSV en cliente y para correo pide destinatarios/mensaje con `window.prompt`.
5. El esquema actual de base de datos tiene usuarios, tenants, memberships, casos, documentos, webhooks y auditoría operativa, pero no muestra una tabla clara de presets/schedules/preferencias de dashboard persistidas por usuario.
6. Restricción del producto: agregar presets reutilizables de filtros/exportación/correo y una agenda automática del bloque bridge, sin rehacer la interfaz existente.
7. El objetivo es una implementación incremental y compatible con el código actual, manteniendo trazabilidad y pruebas.

Necesito una recomendación concreta y pragmática para implementar:
A) presets reutilizables del bridge
B) agenda automática para compartir el reporte bridge

Devuelve JSON válido con este esquema exacto:
{
  "recommended_data_model": {
    "tables": [
      {
        "name": "string",
        "purpose": "string",
        "columns": ["string"],
        "indexes": ["string"]
      }
    ],
    "notes": ["string"]
  },
  "backend_contract": {
    "procedures": [
      {
        "name": "string",
        "type": "query|mutation",
        "purpose": "string",
        "input_summary": ["string"],
        "output_summary": ["string"]
      }
    ],
    "automation_execution_strategy": "string"
  },
  "frontend_extension": {
    "minimal_ui_changes": ["string"],
    "avoid": ["string"]
  },
  "guardrails": ["string"],
  "test_plan": ["string"],
  "migration_strategy": ["string"],
  "risks": ["string"],
  "final_recommendation": "string"
}

Prioriza cambios mínimos, claridad operativa, auditoría, idempotencia, y una UX sobria para usuarios CEO.
No expliques fuera del JSON.
""".strip()


def post_json(url: str, headers: dict[str, str], payload: dict[str, Any]) -> dict[str, Any]:
    response = requests.post(url, headers=headers, json=payload, timeout=120)
    return {
        "status_code": response.status_code,
        "body": response.text,
    }


def call_openai() -> dict[str, Any]:
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        return {"provider": "openai", "ok": False, "error": "OPENAI_API_KEY missing"}
    payload = {
        "model": "gpt-4.1-mini",
        "temperature": 0.2,
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": "Eres un arquitecto de software pragmático y orientado a compatibilidad incremental."},
            {"role": "user", "content": PROMPT},
        ],
    }
    result = post_json(
        "https://api.openai.com/v1/chat/completions",
        {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        payload,
    )
    try:
        parsed = json.loads(result["body"])
        content = parsed["choices"][0]["message"]["content"]
        data = json.loads(content)
        return {"provider": "openai", "ok": True, "data": data}
    except Exception as exc:
        return {"provider": "openai", "ok": False, "error": str(exc), "raw": result}


def call_gemini() -> dict[str, Any]:
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        return {"provider": "gemini", "ok": False, "error": "GEMINI_API_KEY missing"}

    models = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"]
    last_failure: dict[str, Any] | None = None

    for model in models:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
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
        }
        result = post_json(url, {"Content-Type": "application/json"}, payload)
        try:
            parsed = json.loads(result["body"])
            text = parsed["candidates"][0]["content"]["parts"][0]["text"]
            data = json.loads(text)
            return {"provider": "gemini", "ok": True, "model": model, "data": data}
        except Exception as exc:
            last_failure = {"provider": "gemini", "ok": False, "model": model, "error": str(exc), "raw": result}

    return last_failure or {"provider": "gemini", "ok": False, "error": "Unknown Gemini failure"}


def call_xai() -> dict[str, Any]:
    api_key = os.environ.get("XAI_API_KEY")
    if not api_key:
        return {"provider": "xai", "ok": False, "error": "XAI_API_KEY missing"}
    payload = {
        "model": "grok-4",
        "temperature": 0.2,
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": "Eres un arquitecto de software pragmático y orientado a compatibilidad incremental."},
            {"role": "user", "content": PROMPT},
        ],
    }
    result = post_json(
        "https://api.x.ai/v1/chat/completions",
        {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        payload,
    )
    try:
        parsed = json.loads(result["body"])
        content = parsed["choices"][0]["message"]["content"]
        data = json.loads(content)
        return {"provider": "xai", "ok": True, "data": data}
    except Exception as exc:
        return {"provider": "xai", "ok": False, "error": str(exc), "raw": result}


def main() -> None:
    results = [call_openai(), call_gemini(), call_xai()]
    print(json.dumps(results, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
