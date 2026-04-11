#!/usr/bin/env python3
import json
import os
import sys
from typing import Any

import requests

PROMPT = """
Actúa como arquitecto senior de producto y software para un dashboard administrativo interno.

Contexto del proyecto:
- Existe un dashboard CEO en React/tRPC para una plataforma llamada AuditaPatron / CompliLink.
- Debemos agregar una nueva sección interna llamada 'panel operativo del bridge'.
- No debe romper el acceso actual ni la navegación existente del dashboard CEO.
- El backend ya tiene dos flujos clave:
  1) Salida hacia AuditaPatron Engine / CompliLink, con observabilidad que incluye: dispatchId, targetHost, targetPath, outcomeCategory, retryScheduled, retryDelayMs, remoteSmokeEnabled, httpStatusCode.
  2) Webhook de retorno firmado con eventos como document.processing.started, document.analysis.completed, document.analyzed, contract.analysis.detailed. Los warnings/flags pueden abrir alertas operativas.
- El dashboard CEO actual ya usa snapshot ejecutivo, filtros transversales, auditoría, alertas, accesos y documentos.
- Ya existe lógica para calcular estado por documento: not_sent, waiting, attention, received.

Necesito una recomendación concisa pero útil para implementar el primer corte del panel operativo del bridge.

Devuelve JSON válido con esta estructura exacta:
{
  "recommended_scope": ["string"],
  "backend_shape": {
    "endpoint_name": "string",
    "top_level_keys": ["string"],
    "derived_kpis": ["string"],
    "filters": ["string"]
  },
  "ui_sections": ["string"],
  "risk_guardrails": ["string"],
  "test_plan": ["string"],
  "not_now": ["string"],
  "rationale": "string"
}

Reglas:
- Prioriza una implementación V1 mínima, observable y segura.
- Reutiliza tablas, logs y procedimientos existentes antes de proponer nuevos esquemas.
- Incluye KPIs, filtros y un detalle de eventos/errores.
- Considera guardrails de frescura, trazabilidad y no duplicar fuentes de verdad.
- Responde sólo JSON, sin markdown.
""".strip()


def post_json(url: str, headers: dict[str, str], payload: dict[str, Any], timeout: int = 90) -> Any:
    response = requests.post(url, headers=headers, json=payload, timeout=timeout)
    response.raise_for_status()
    return response.json()



def call_openai() -> dict[str, Any]:
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        return {"ok": False, "provider": "chatgpt", "error": "OPENAI_API_KEY not set"}

    payload = {
        "model": "gpt-4.1-mini",
        "input": [
            {
                "role": "system",
                "content": [
                    {
                        "type": "input_text",
                        "text": "Eres un arquitecto pragmático de software. Respondes estrictamente JSON válido."
                    }
                ]
            },
            {
                "role": "user",
                "content": [
                    {
                        "type": "input_text",
                        "text": PROMPT
                    }
                ]
            }
        ],
        "text": {
            "format": {
                "type": "json_schema",
                "name": "bridge_panel_recommendation",
                "schema": {
                    "type": "object",
                    "properties": {
                        "recommended_scope": {"type": "array", "items": {"type": "string"}},
                        "backend_shape": {
                            "type": "object",
                            "properties": {
                                "endpoint_name": {"type": "string"},
                                "top_level_keys": {"type": "array", "items": {"type": "string"}},
                                "derived_kpis": {"type": "array", "items": {"type": "string"}},
                                "filters": {"type": "array", "items": {"type": "string"}}
                            },
                            "required": ["endpoint_name", "top_level_keys", "derived_kpis", "filters"],
                            "additionalProperties": False
                        },
                        "ui_sections": {"type": "array", "items": {"type": "string"}},
                        "risk_guardrails": {"type": "array", "items": {"type": "string"}},
                        "test_plan": {"type": "array", "items": {"type": "string"}},
                        "not_now": {"type": "array", "items": {"type": "string"}},
                        "rationale": {"type": "string"}
                    },
                    "required": ["recommended_scope", "backend_shape", "ui_sections", "risk_guardrails", "test_plan", "not_now", "rationale"],
                    "additionalProperties": False
                },
                "strict": True
            }
        }
    }

    data = post_json(
        "https://api.openai.com/v1/responses",
        {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        payload,
    )

    text = data.get("output", [])[0].get("content", [])[0].get("text")
    return {"ok": True, "provider": "chatgpt", "raw": data, "parsed": json.loads(text)}



def call_gemini() -> dict[str, Any]:
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        return {"ok": False, "provider": "gemini", "error": "GEMINI_API_KEY not set"}

    schema = {
        "type": "OBJECT",
        "properties": {
            "recommended_scope": {"type": "ARRAY", "items": {"type": "STRING"}},
            "backend_shape": {
                "type": "OBJECT",
                "properties": {
                    "endpoint_name": {"type": "STRING"},
                    "top_level_keys": {"type": "ARRAY", "items": {"type": "STRING"}},
                    "derived_kpis": {"type": "ARRAY", "items": {"type": "STRING"}},
                    "filters": {"type": "ARRAY", "items": {"type": "STRING"}}
                },
                "required": ["endpoint_name", "top_level_keys", "derived_kpis", "filters"]
            },
            "ui_sections": {"type": "ARRAY", "items": {"type": "STRING"}},
            "risk_guardrails": {"type": "ARRAY", "items": {"type": "STRING"}},
            "test_plan": {"type": "ARRAY", "items": {"type": "STRING"}},
            "not_now": {"type": "ARRAY", "items": {"type": "STRING"}},
            "rationale": {"type": "STRING"}
        },
        "required": ["recommended_scope", "backend_shape", "ui_sections", "risk_guardrails", "test_plan", "not_now", "rationale"]
    }

    payload = {
        "contents": [{"parts": [{"text": PROMPT}]}],
        "generationConfig": {
            "responseMimeType": "application/json",
            "responseSchema": schema,
            "temperature": 0.2
        }
    }

    data = post_json(
        f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}",
        {"Content-Type": "application/json"},
        payload,
    )

    text = data["candidates"][0]["content"]["parts"][0]["text"]
    return {"ok": True, "provider": "gemini", "raw": data, "parsed": json.loads(text)}



def call_grok() -> dict[str, Any]:
    api_key = os.environ.get("XAI_API_KEY")
    if not api_key:
        return {"ok": False, "provider": "grok", "error": "XAI_API_KEY not set"}

    schema = {
        "type": "object",
        "properties": {
            "recommended_scope": {"type": "array", "items": {"type": "string"}},
            "backend_shape": {
                "type": "object",
                "properties": {
                    "endpoint_name": {"type": "string"},
                    "top_level_keys": {"type": "array", "items": {"type": "string"}},
                    "derived_kpis": {"type": "array", "items": {"type": "string"}},
                    "filters": {"type": "array", "items": {"type": "string"}}
                },
                "required": ["endpoint_name", "top_level_keys", "derived_kpis", "filters"],
                "additionalProperties": False
            },
            "ui_sections": {"type": "array", "items": {"type": "string"}},
            "risk_guardrails": {"type": "array", "items": {"type": "string"}},
            "test_plan": {"type": "array", "items": {"type": "string"}},
            "not_now": {"type": "array", "items": {"type": "string"}},
            "rationale": {"type": "string"}
        },
        "required": ["recommended_scope", "backend_shape", "ui_sections", "risk_guardrails", "test_plan", "not_now", "rationale"],
        "additionalProperties": False
    }

    payload = {
        "model": "grok-4-0709",
        "temperature": 0.2,
        "messages": [
            {"role": "system", "content": "Eres un arquitecto pragmático de software. Respondes estrictamente JSON válido."},
            {"role": "user", "content": PROMPT}
        ],
        "response_format": {
            "type": "json_schema",
            "json_schema": {
                "name": "bridge_panel_recommendation",
                "schema": schema,
                "strict": True
            }
        }
    }

    data = post_json(
        "https://api.x.ai/v1/chat/completions",
        {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        payload,
    )

    text = data["choices"][0]["message"]["content"]
    return {"ok": True, "provider": "grok", "raw": data, "parsed": json.loads(text)}



def main() -> int:
    providers = [call_openai, call_gemini, call_grok]
    results = []
    for fn in providers:
        try:
            results.append(fn())
        except Exception as exc:  # noqa: BLE001
            results.append({"ok": False, "provider": fn.__name__.replace("call_", ""), "error": str(exc)})

    print(json.dumps({"prompt": PROMPT, "results": results}, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
