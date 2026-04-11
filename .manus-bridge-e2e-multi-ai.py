#!/usr/bin/env python3
import json
import os
from typing import Any

import requests

PROMPT = """
Actúa como arquitecto senior de QA y software para una aplicación React/tRPC con dashboard interno.

Contexto del proyecto:
- Ya existe un dashboard CEO en AuditaPatron / CompliLink con una nueva sección interna de monitoreo operativo del bridge.
- El siguiente bloque del roadmap es cubrir con pruebas E2E el flujo completo de acceso, expediente y guardrails del bridge.
- La aplicación ya tiene frontend React y backend tRPC/Express, con autenticación Manus OAuth.
- Debemos priorizar pruebas estables, de alto valor y bajo mantenimiento.
- Queremos evitar flakiness, evitar depender de datos volátiles y reutilizar al máximo la infraestructura existente del proyecto.
- Las pruebas deben validar navegación, acceso al dashboard/expediente, visualización del monitoreo bridge y guardrails funcionales clave.

Necesito una recomendación concisa pero útil para un primer corte de pruebas E2E.

Devuelve JSON válido con esta estructura exacta:
{
  "recommended_flows": ["string"],
  "coverage_split": {
    "critical": ["string"],
    "secondary": ["string"],
    "not_now": ["string"]
  },
  "test_data_strategy": ["string"],
  "selector_strategy": ["string"],
  "stabilization_guardrails": ["string"],
  "must_mock_or_seed": ["string"],
  "minimal_file_plan": ["string"],
  "rationale": "string"
}

Reglas:
- Prioriza una V1 mínima, confiable y mantenible.
- Propón primero pruebas de recorrido crítico antes que cobertura exhaustiva.
- Favorece selectores semánticos y contratos estables sobre detalles visuales frágiles.
- Incluye estrategias para auth, datos de prueba, waits y aislamiento.
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
                        "text": "Eres un arquitecto pragmático de QA y software. Respondes estrictamente JSON válido."
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
                "name": "bridge_e2e_recommendation",
                "schema": {
                    "type": "object",
                    "properties": {
                        "recommended_flows": {"type": "array", "items": {"type": "string"}},
                        "coverage_split": {
                            "type": "object",
                            "properties": {
                                "critical": {"type": "array", "items": {"type": "string"}},
                                "secondary": {"type": "array", "items": {"type": "string"}},
                                "not_now": {"type": "array", "items": {"type": "string"}}
                            },
                            "required": ["critical", "secondary", "not_now"],
                            "additionalProperties": False
                        },
                        "test_data_strategy": {"type": "array", "items": {"type": "string"}},
                        "selector_strategy": {"type": "array", "items": {"type": "string"}},
                        "stabilization_guardrails": {"type": "array", "items": {"type": "string"}},
                        "must_mock_or_seed": {"type": "array", "items": {"type": "string"}},
                        "minimal_file_plan": {"type": "array", "items": {"type": "string"}},
                        "rationale": {"type": "string"}
                    },
                    "required": [
                        "recommended_flows",
                        "coverage_split",
                        "test_data_strategy",
                        "selector_strategy",
                        "stabilization_guardrails",
                        "must_mock_or_seed",
                        "minimal_file_plan",
                        "rationale"
                    ],
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
            "recommended_flows": {"type": "ARRAY", "items": {"type": "STRING"}},
            "coverage_split": {
                "type": "OBJECT",
                "properties": {
                    "critical": {"type": "ARRAY", "items": {"type": "STRING"}},
                    "secondary": {"type": "ARRAY", "items": {"type": "STRING"}},
                    "not_now": {"type": "ARRAY", "items": {"type": "STRING"}}
                },
                "required": ["critical", "secondary", "not_now"]
            },
            "test_data_strategy": {"type": "ARRAY", "items": {"type": "STRING"}},
            "selector_strategy": {"type": "ARRAY", "items": {"type": "STRING"}},
            "stabilization_guardrails": {"type": "ARRAY", "items": {"type": "STRING"}},
            "must_mock_or_seed": {"type": "ARRAY", "items": {"type": "STRING"}},
            "minimal_file_plan": {"type": "ARRAY", "items": {"type": "STRING"}},
            "rationale": {"type": "STRING"}
        },
        "required": [
            "recommended_flows",
            "coverage_split",
            "test_data_strategy",
            "selector_strategy",
            "stabilization_guardrails",
            "must_mock_or_seed",
            "minimal_file_plan",
            "rationale"
        ]
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
            "recommended_flows": {"type": "array", "items": {"type": "string"}},
            "coverage_split": {
                "type": "object",
                "properties": {
                    "critical": {"type": "array", "items": {"type": "string"}},
                    "secondary": {"type": "array", "items": {"type": "string"}},
                    "not_now": {"type": "array", "items": {"type": "string"}}
                },
                "required": ["critical", "secondary", "not_now"],
                "additionalProperties": False
            },
            "test_data_strategy": {"type": "array", "items": {"type": "string"}},
            "selector_strategy": {"type": "array", "items": {"type": "string"}},
            "stabilization_guardrails": {"type": "array", "items": {"type": "string"}},
            "must_mock_or_seed": {"type": "array", "items": {"type": "string"}},
            "minimal_file_plan": {"type": "array", "items": {"type": "string"}},
            "rationale": {"type": "string"}
        },
        "required": [
            "recommended_flows",
            "coverage_split",
            "test_data_strategy",
            "selector_strategy",
            "stabilization_guardrails",
            "must_mock_or_seed",
            "minimal_file_plan",
            "rationale"
        ],
        "additionalProperties": False
    }

    payload = {
        "model": "grok-4-0709",
        "temperature": 0.2,
        "messages": [
            {"role": "system", "content": "Eres un arquitecto pragmático de QA y software. Respondes estrictamente JSON válido."},
            {"role": "user", "content": PROMPT}
        ],
        "response_format": {
            "type": "json_schema",
            "json_schema": {
                "name": "bridge_e2e_recommendation",
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
