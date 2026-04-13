from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

import requests

PROJECT_ROOT = Path('/home/ubuntu/complilink_operativo_v1')
OUTPUT_PATH = PROJECT_ROOT / 'research' / 'ceo_round11_multi_ai' / 'summary.json'
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


def _safe_json(text: str) -> dict[str, Any]:
    text = text.strip()
    if text.startswith('```'):
        lines = text.splitlines()
        if len(lines) >= 3:
            text = '\n'.join(lines[1:-1]).strip()
    return json.loads(text)


def call_openai() -> dict[str, Any]:
    response = requests.post(
        'https://api.openai.com/v1/chat/completions',
        headers={
            'Authorization': f"Bearer {os.environ['OPENAI_API_KEY']}",
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
    response = requests.post(
        'https://api.x.ai/v1/chat/completions',
        headers={
            'Authorization': f"Bearer {os.environ['XAI_API_KEY']}",
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
    response = requests.post(
        f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={os.environ['GEMINI_API_KEY']}",
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
                'responseMimeType': 'application/json',
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
