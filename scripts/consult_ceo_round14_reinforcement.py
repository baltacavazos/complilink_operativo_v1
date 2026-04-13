from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

import requests

PROJECT_ROOT = Path('/home/ubuntu/complilink_operativo_v1')
OUTPUT_DIR = PROJECT_ROOT / 'research' / 'ceo_round14_reinforcement_multi_ai'
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
OUTPUT_PATH = OUTPUT_DIR / 'summary.json'

PROMPT = """
Eres un revisor técnico senior de un proyecto web TypeScript ya funcional. Necesito una recomendación MINIMA y validada, sin over-engineering.

Contexto heredado:
- Proyecto: AuditaPatron dentro de una app web Manus con servidor corriendo y TypeScript sin errores.
- La Consola CEO ya tiene drill-down legal, tendencia semanal, ranking de causas de `guardrail_rejected`, acciones sugeridas por motivo y refuerzo de contexto persistente con comparación semanal vs semana previa.
- El usuario pidió que la siguiente ronda se enfoque en REFORZAR, no en agregar por agregar.
- Siguiente ronda candidata, siempre con cambio mínimo y utilitario:
  1) reforzar el retorno desde vistas contextuales al resumen ejecutivo sin perder filtros activos;
  2) reforzar la trazabilidad del seguimiento operativo mostrando el último estado visible por causa, sin backend nuevo;
  3) reforzar la comparación semanal destacando cambio neto y dirección de tendencia en la Consola CEO.

Restricciones:
- Mantener el cambio mínimo posible.
- No inventar infraestructura nueva si el estado local, la URL o la bitácora actual ya sirven.
- El servidor debe seguir corriendo.
- TypeScript debe permanecer sin errores.
- La recomendación debe favorecer una implementación incremental con pruebas.
- Preferir cambios pequeños de contrato y render antes que rediseños.

Responde SOLO JSON válido con esta forma exacta:
{
  "model_view": "nombre corto del modelo",
  "navigation_reinforcement": {
    "summary": "frase breve",
    "minimal_approach": "texto",
    "state_to_preserve": ["campo1", "campo2"],
    "why_minimal": "texto"
  },
  "operational_traceability": {
    "summary": "frase breve",
    "minimal_approach": "texto",
    "visible_state": ["estado1", "estado2"],
    "why_minimal": "texto"
  },
  "weekly_signal": {
    "summary": "frase breve",
    "minimal_approach": "texto",
    "derived_metrics": ["metrica1", "metrica2"],
    "why_minimal": "texto"
  },
  "tests": {
    "summary": "frase breve",
    "priority_assertions": ["assert1", "assert2", "assert3"]
  },
  "risks": ["riesgo1", "riesgo2"],
  "consensus_candidate": "propuesta integral en 2 o 3 frases"
}
""".strip()


def _safe_json(text: str) -> dict[str, Any]:
    text = text.strip()
    if text.startswith('```'):
        lines = text.splitlines()
        if len(lines) >= 3:
            text = '\n'.join(lines[1:-1]).strip()
    return json.loads(text)



def call_openai() -> dict[str, Any]:
    api_key = os.environ['OPENAI_API_KEY']
    response = requests.post(
        'https://api.openai.com/v1/chat/completions',
        headers={
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json',
        },
        json={
            'model': 'gpt-4.1-mini',
            'temperature': 0.2,
            'response_format': {'type': 'json_object'},
            'messages': [
                {'role': 'system', 'content': 'Devuelve únicamente JSON válido.'},
                {'role': 'user', 'content': PROMPT},
            ],
        },
        timeout=120,
    )
    response.raise_for_status()
    payload = response.json()
    return _safe_json(payload['choices'][0]['message']['content'])



def call_grok() -> dict[str, Any]:
    api_key = os.environ['XAI_API_KEY']
    response = requests.post(
        'https://api.x.ai/v1/chat/completions',
        headers={
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json',
        },
        json={
            'model': 'grok-3-mini',
            'temperature': 0.2,
            'response_format': {'type': 'json_object'},
            'messages': [
                {'role': 'system', 'content': 'Devuelve únicamente JSON válido.'},
                {'role': 'user', 'content': PROMPT},
            ],
        },
        timeout=120,
    )
    response.raise_for_status()
    payload = response.json()
    return _safe_json(payload['choices'][0]['message']['content'])



def call_gemini() -> dict[str, Any]:
    api_key = os.environ['GEMINI_API_KEY']
    url = f'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}'
    response = requests.post(
        url,
        headers={'Content-Type': 'application/json'},
        json={
            'contents': [
                {
                    'parts': [
                        {'text': 'Devuelve únicamente JSON válido.'},
                        {'text': PROMPT},
                    ]
                }
            ],
            'generationConfig': {
                'temperature': 0.2,
                'topP': 0.9,
                'topK': 32,
                'maxOutputTokens': 2048,
            },
        },
        timeout=120,
    )
    response.raise_for_status()
    payload = response.json()
    text = payload['candidates'][0]['content']['parts'][0]['text']
    return _safe_json(text)



def main() -> None:
    results: dict[str, Any] = {}
    failures: dict[str, str] = {}

    for name, fn in (('chatgpt', call_openai), ('grok', call_grok), ('gemini', call_gemini)):
        try:
            results[name] = fn()
        except Exception as exc:
            failures[name] = f'{type(exc).__name__}: {exc}'

    OUTPUT_PATH.write_text(
        json.dumps(
            {
                'prompt': PROMPT,
                'results': results,
                'failures': failures,
            },
            ensure_ascii=False,
            indent=2,
        ) + '\n',
        encoding='utf-8',
    )

    print(str(OUTPUT_PATH))
    print(json.dumps({'results': list(results.keys()), 'failures': failures}, ensure_ascii=False))


if __name__ == '__main__':
    main()
