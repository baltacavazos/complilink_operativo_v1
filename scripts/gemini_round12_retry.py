from __future__ import annotations

import json
import os
from pathlib import Path

import requests

PROJECT_ROOT = Path('/home/ubuntu/complilink_operativo_v1')
OUTPUT_PATH = PROJECT_ROOT / 'research' / 'ceo_round12_multi_ai' / 'gemini_retry.json'
OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)

PROMPT = """
Eres un revisor técnico senior de un proyecto web TypeScript ya funcional. Necesito una recomendación MINIMA, incremental y validada, sin over-engineering.

Contexto heredado:
- Proyecto: AuditaPatron dentro de una app web Manus con servidor corriendo y TypeScript sin errores.
- La ronda previa ya añadió en la Consola CEO una tarjeta ejecutiva con abandono del gate legal y tiempo medio de resolución, drill-down mínimo de casos afectados, tendencia semanal de abandono legal y ranking accionable de causas de `guardrail_rejected`.
- Nueva ronda aprobada por el usuario, en este orden:
  1) enlazar cada caso del drill-down legal a una vista filtrada o contextual del expediente/feed;
  2) añadir umbrales visuales para semanas con abandono legal fuera de rango;
  3) convertir el ranking de causas de `guardrail_rejected` en acciones sugeridas por motivo.

Restricciones:
- Mantener el cambio mínimo posible.
- Reutilizar navegación, contratos y bitácora existentes.
- No inventar backend nuevo si basta con estado/UI derivada.
- Priorizar cambios pequeños en helpers, estados y render de UI.
- Favorecer aserciones deterministas y pruebas pequeñas.

Responde SOLO JSON válido con esta forma exacta:
{
  "model_view": "nombre corto del modelo",
  "drilldown_navigation": {
    "summary": "frase breve",
    "recommended_pattern": "texto",
    "minimal_state_or_params": ["campo1", "campo2"],
    "why_minimal": "texto"
  },
  "weekly_thresholds": {
    "summary": "frase breve",
    "recommended_threshold_logic": "texto",
    "visual_treatment": "texto",
    "why_minimal": "texto"
  },
  "guardrail_actions": {
    "summary": "frase breve",
    "mapping_strategy": "texto",
    "example_actions": ["accion1", "accion2", "accion3"],
    "why_minimal": "texto"
  },
  "tests": {
    "summary": "frase breve",
    "priority_assertions": ["assert1", "assert2", "assert3"],
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
        "drilldown_navigation": {
            "type": "OBJECT",
            "properties": {
                "summary": {"type": "STRING"},
                "recommended_pattern": {"type": "STRING"},
                "minimal_state_or_params": {"type": "ARRAY", "items": {"type": "STRING"}},
                "why_minimal": {"type": "STRING"},
            },
            "required": ["summary", "recommended_pattern", "minimal_state_or_params", "why_minimal"],
        },
        "weekly_thresholds": {
            "type": "OBJECT",
            "properties": {
                "summary": {"type": "STRING"},
                "recommended_threshold_logic": {"type": "STRING"},
                "visual_treatment": {"type": "STRING"},
                "why_minimal": {"type": "STRING"},
            },
            "required": ["summary", "recommended_threshold_logic", "visual_treatment", "why_minimal"],
        },
        "guardrail_actions": {
            "type": "OBJECT",
            "properties": {
                "summary": {"type": "STRING"},
                "mapping_strategy": {"type": "STRING"},
                "example_actions": {"type": "ARRAY", "items": {"type": "STRING"}},
                "why_minimal": {"type": "STRING"},
            },
            "required": ["summary", "mapping_strategy", "example_actions", "why_minimal"],
        },
        "tests": {
            "type": "OBJECT",
            "properties": {
                "summary": {"type": "STRING"},
                "priority_assertions": {"type": "ARRAY", "items": {"type": "STRING"}},
                "why_minimal": {"type": "STRING"},
            },
            "required": ["summary", "priority_assertions", "why_minimal"],
        },
        "risks": {"type": "ARRAY", "items": {"type": "STRING"}},
        "consensus_candidate": {"type": "STRING"},
    },
    "required": [
        "model_view",
        "drilldown_navigation",
        "weekly_thresholds",
        "guardrail_actions",
        "tests",
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
        text = payload["candidates"][0]["content"][0]["parts"][0]["text"] if isinstance(payload["candidates"][0]["content"], list) else payload["candidates"][0]["content"]["parts"][0]["text"]
        parsed = json.loads(text)
        result["success_model"] = model
        result["data"] = parsed
        break
    except Exception as exc:
        result["attempts"].append({"model": model, "error": f"{type(exc).__name__}: {exc}"})

OUTPUT_PATH.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(str(OUTPUT_PATH))
print(json.dumps(result, ensure_ascii=False))
