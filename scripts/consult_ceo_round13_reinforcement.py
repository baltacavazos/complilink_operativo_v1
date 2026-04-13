from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

import requests

PROJECT_ROOT = Path('/home/ubuntu/complilink_operativo_v1')
OUTPUT_DIR = PROJECT_ROOT / 'research' / 'ceo_round13_reinforcement_multi_ai'
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
OUTPUT_PATH = OUTPUT_DIR / 'summary.json'

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
- El servidor debe seguir corriendo.
- TypeScript debe permanecer sin errores.
- La recomendación debe favorecer implementación incremental con pruebas.
- Preferir pequeños refuerzos de comportamiento, estado y lectura antes que rediseños.

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
