from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

import requests

PROJECT_ROOT = Path('/home/ubuntu/complilink_operativo_v1')
OUTPUT_PATH = PROJECT_ROOT / 'research' / 'ceo_round12_multi_ai' / 'summary.json'
OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)

PROMPT = """
Eres un revisor técnico senior de un proyecto web TypeScript ya funcional. Necesito una recomendación MINIMA, incremental y validada, sin over-engineering.

Contexto heredado:
- Proyecto: AuditaPatron dentro de una app web Manus con servidor corriendo y TypeScript sin errores.
- La ronda previa ya añadió en la Consola CEO: tarjeta ejecutiva con abandono del gate legal y tiempo medio de resolución, drill-down mínimo de casos afectados, tendencia semanal de abandono legal y ranking accionable de causas de `guardrail_rejected`.
- Próxima ronda aprobada por el usuario, en este orden:
  1) enlazar cada caso del drill-down legal a una vista filtrada o contextual del expediente/feed;
  2) añadir umbrales visuales para semanas con abandono legal fuera de rango;
  3) convertir el ranking de causas de `guardrail_rejected` en acciones sugeridas por motivo.

Restricciones:
- Mantener el cambio mínimo posible.
- Reutilizar navegación, contratos y bitácora existentes.
- No inventar backend nuevo si basta con estado/UI derivada.
- El servidor debe seguir corriendo.
- TypeScript debe permanecer sin errores.
- La recomendación debe favorecer una implementación incremental con pruebas.
- Preferir cambios de interacción y render pequeños antes que rediseños.

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
