from __future__ import annotations

import json
import os
from pathlib import Path

import requests

PROJECT_ROOT = Path('/home/ubuntu/complilink_operativo_v1')
OUTPUT_PATH = PROJECT_ROOT / 'research' / 'ceo_round11_multi_ai' / 'gemini_retry.json'
OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)

PROMPT = """
Eres un revisor técnico senior de un proyecto web TypeScript ya funcional. Necesito una recomendación MINIMA, incremental y sin over-engineering.

Contexto heredado:
- Proyecto: AuditaPatron dentro de una app web Manus con servidor corriendo y TypeScript sin errores.
- La ronda anterior ya corrigió la consolidación de `guardrail_rejected` en la Consola CEO, añadió una tarjeta ejecutiva con abandono del gate legal y tiempo medio de resolución, y cubrió `/auditar` con una prueba específica de rechazo por guardrails.
- Nueva ronda aprobada por el usuario, en este orden:
  1) añadir drill-down desde esa tarjeta ejecutiva hacia los casos afectados;
  2) mostrar tendencia semanal del abandono legal en la Consola CEO;
  3) convertir los motivos de `guardrail_rejected` en un ranking accionable por causa.

Restricciones:
- Mantener el cambio mínimo posible.
- Reutilizar la telemetría, audit trail y contratos de monitoreo existentes.
- No introducir infraestructura nueva si los eventos actuales bastan.
- Priorizar cambios pequeños en helpers, queries derivadas y render de UI.
- Favorecer aserciones deterministas y pruebas pequeñas.
- Evitar dashboards recargados: la Consola CEO debe seguir siendo escaneable de un vistazo.

Responde SOLO JSON válido con esta forma exacta:
{
  "model_view": "nombre corto del modelo",
  "drilldown": {
    "summary": "frase breve",
    "recommended_scope": "texto",
    "ui_shape": "texto",
    "minimal_data_needed": ["campo1", "campo2"],
    "why_minimal": "texto"
  },
  "weekly_trend": {
    "summary": "frase breve",
    "recommended_bucket": "texto",
    "recommended_visual": "texto",
    "minimal_data_needed": ["campo1", "campo2"],
    "why_minimal": "texto"
  },
  "guardrail_ranking": {
    "summary": "frase breve",
    "grouping_key": "texto",
    "recommended_limit": "texto",
    "minimal_data_needed": ["campo1", "campo2"],
    "why_minimal": "texto"
  },
  "test_strategy": {
    "summary": "frase breve",
    "priority_tests": ["test1", "test2", "test3"],
    "why_minimal": "texto"
  },
  "risks": ["riesgo1", "riesgo2"],
  "consensus_candidate": "propuesta integral en 2 o 3 frases"
}
""".strip()

SCHEMA = {
    "type": "OBJECT",
    "properties": {
        "model_view": {"type": "STRING"},
        "drilldown": {
            "type": "OBJECT",
            "properties": {
                "summary": {"type": "STRING"},
                "recommended_scope": {"type": "STRING"},
                "ui_shape": {"type": "STRING"},
                "minimal_data_needed": {"type": "ARRAY", "items": {"type": "STRING"}},
                "why_minimal": {"type": "STRING"},
            },
            "required": ["summary", "recommended_scope", "ui_shape", "minimal_data_needed", "why_minimal"],
        },
        "weekly_trend": {
            "type": "OBJECT",
            "properties": {
                "summary": {"type": "STRING"},
                "recommended_bucket": {"type": "STRING"},
                "recommended_visual": {"type": "STRING"},
                "minimal_data_needed": {"type": "ARRAY", "items": {"type": "STRING"}},
                "why_minimal": {"type": "STRING"},
            },
            "required": ["summary", "recommended_bucket", "recommended_visual", "minimal_data_needed", "why_minimal"],
        },
        "guardrail_ranking": {
            "type": "OBJECT",
            "properties": {
                "summary": {"type": "STRING"},
                "grouping_key": {"type": "STRING"},
                "recommended_limit": {"type": "STRING"},
                "minimal_data_needed": {"type": "ARRAY", "items": {"type": "STRING"}},
                "why_minimal": {"type": "STRING"},
            },
            "required": ["summary", "grouping_key", "recommended_limit", "minimal_data_needed", "why_minimal"],
        },
        "test_strategy": {
            "type": "OBJECT",
            "properties": {
                "summary": {"type": "STRING"},
                "priority_tests": {"type": "ARRAY", "items": {"type": "STRING"}},
                "why_minimal": {"type": "STRING"},
            },
            "required": ["summary", "priority_tests", "why_minimal"],
        },
        "risks": {"type": "ARRAY", "items": {"type": "STRING"}},
        "consensus_candidate": {"type": "STRING"},
    },
    "required": [
        "model_view",
        "drilldown",
        "weekly_trend",
        "guardrail_ranking",
        "test_strategy",
        "risks",
        "consensus_candidate"
    ],
}

models = ["gemini-2.5-flash", "gemini-2.0-flash"]
api_key = os.environ["GEMINI_API_KEY"]
result = {"attempts": []}

for model in models:
    try:
        response = requests.post(
            f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}",
            headers={"Content-Type": "application/json"},
            json={
                "contents": [{"parts": [{"text": PROMPT}]}],
                "generationConfig": {
                    "temperature": 0.2,
                    "responseMimeType": "application/json",
                    "responseSchema": SCHEMA,
                },
            },
            timeout=90,
        )
        response.raise_for_status()
        payload = response.json()
        text = payload["candidates"][0]["content"]["parts"][0]["text"]
        parsed = json.loads(text)
        result["success_model"] = model
        result["data"] = parsed
        break
    except Exception as exc:
        result["attempts"].append({"model": model, "error": f"{type(exc).__name__}: {exc}"})

OUTPUT_PATH.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(str(OUTPUT_PATH))
print(json.dumps(result, ensure_ascii=False))
