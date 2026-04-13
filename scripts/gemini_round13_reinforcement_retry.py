from __future__ import annotations

import json
import os
from pathlib import Path

import requests

PROJECT_ROOT = Path('/home/ubuntu/complilink_operativo_v1')
OUTPUT_PATH = PROJECT_ROOT / 'research' / 'ceo_round13_reinforcement_multi_ai' / 'gemini_retry.json'
OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)

PROMPT = """
Eres un revisor técnico senior de un proyecto web TypeScript ya funcional. Necesito una recomendación MINIMA enfocada en reforzar una Consola CEO ya existente, no en agregar funciones nuevas por agregar.

Contexto heredado:
- Proyecto: AuditaPatron dentro de una app web Manus con servidor corriendo y TypeScript sin errores.
- La ronda previa ya permitió: abrir casos del drill-down legal hacia feed filtrado o expediente documental, resaltar semanas fuera de rango en abandono legal y mostrar acciones sugeridas por motivo de guardrail.
- El usuario pidió que la siguiente ronda se enfoque explícitamente en reforzar lo ya construido.

Candidatos de refuerzo ya aprobados para evaluar:
1) reforzar la persistencia del contexto al aterrizar desde enlaces del drill-down legal, manteniendo tenant y caso filtrados;
2) reforzar el ranking ejecutivo permitiendo seguimiento operativo de causas sugeridas sin perder simplicidad visual;
3) reforzar la lectura semanal con comparación contra la semana previa para distinguir picos puntuales de deterioro sostenido.

Restricciones:
- Mantener el cambio mínimo posible.
- Reutilizar rutas, filtros, helpers y telemetría existentes.
- No crear infraestructura nueva si se puede resolver en frontend o con contratos ya existentes.
- Priorizar pequeños refuerzos de comportamiento, estado y lectura antes que rediseños.
- Favorecer implementación incremental con pruebas.

Responde SOLO JSON válido con esta forma exacta:
{
  "model_view": "nombre corto del modelo",
  "context_persistence": {
    "summary": "frase breve",
    "minimal_approach": "texto",
    "state_to_preserve": ["campo1", "campo2"],
    "why_reinforcement": "texto"
  },
  "operational_followup": {
    "summary": "frase breve",
    "minimal_approach": "texto",
    "ui_shape": "texto",
    "why_reinforcement": "texto"
  },
  "weekly_comparison": {
    "summary": "frase breve",
    "minimal_approach": "texto",
    "key_signals": ["senal1", "senal2"],
    "why_reinforcement": "texto"
  },
  "recommended_test_focus": ["test1", "test2", "test3"],
  "risks": ["riesgo1", "riesgo2"],
  "consensus_candidate": "propuesta integral en 2 o 3 frases"
}
""".strip()

SCHEMA = {
    "type": "OBJECT",
    "properties": {
        "model_view": {"type": "STRING"},
        "context_persistence": {
            "type": "OBJECT",
            "properties": {
                "summary": {"type": "STRING"},
                "minimal_approach": {"type": "STRING"},
                "state_to_preserve": {"type": "ARRAY", "items": {"type": "STRING"}},
                "why_reinforcement": {"type": "STRING"},
            },
            "required": ["summary", "minimal_approach", "state_to_preserve", "why_reinforcement"],
        },
        "operational_followup": {
            "type": "OBJECT",
            "properties": {
                "summary": {"type": "STRING"},
                "minimal_approach": {"type": "STRING"},
                "ui_shape": {"type": "STRING"},
                "why_reinforcement": {"type": "STRING"},
            },
            "required": ["summary", "minimal_approach", "ui_shape", "why_reinforcement"],
        },
        "weekly_comparison": {
            "type": "OBJECT",
            "properties": {
                "summary": {"type": "STRING"},
                "minimal_approach": {"type": "STRING"},
                "key_signals": {"type": "ARRAY", "items": {"type": "STRING"}},
                "why_reinforcement": {"type": "STRING"},
            },
            "required": ["summary", "minimal_approach", "key_signals", "why_reinforcement"],
        },
        "recommended_test_focus": {"type": "ARRAY", "items": {"type": "STRING"}},
        "risks": {"type": "ARRAY", "items": {"type": "STRING"}},
        "consensus_candidate": {"type": "STRING"},
    },
    "required": [
        "model_view",
        "context_persistence",
        "operational_followup",
        "weekly_comparison",
        "recommended_test_focus",
        "risks",
        "consensus_candidate",
    ],
}

api_key = os.environ["GEMINI_API_KEY"]
models = ["gemini-2.5-flash", "gemini-2.0-flash"]
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
        candidate = payload["candidates"][0]["content"]
        text = candidate[0]["parts"][0]["text"] if isinstance(candidate, list) else candidate["parts"][0]["text"]
        result["success_model"] = model
        result["data"] = json.loads(text)
        break
    except Exception as exc:
        result["attempts"].append({"model": model, "error": f"{type(exc).__name__}: {exc}"})

OUTPUT_PATH.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(str(OUTPUT_PATH))
print(json.dumps(result, ensure_ascii=False))
