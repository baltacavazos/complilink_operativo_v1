#!/usr/bin/env python3
import json
import os
import time
from pathlib import Path

import requests

BASE = Path('/home/ubuntu/complilink_operativo_v1')
OUT = BASE / '.manus-ai'
OUT.mkdir(exist_ok=True)

PROMPT = '''
Contexto resumido:
- Ecosistema SaaS: AuditaPatron + CompliLink + Helios.
- Meta: cerrar V1 robusta para piloto web.
- Restricción: NO agregar features; solo robustecer.
- Flujo validado: login -> /auditar -> aceptación legal -> carga documental.
- Pendientes agrupados: seguridad/trazabilidad, operación/resiliencia, integración Helios, simplificación UX, pruebas críticas, preparación móvil sin rehacer arquitectura.

Tarea:
Devuelve JSON con esta forma exacta:
{
  "top_5": [
    {"rank":1,"name":"...","category":"security|ops|integration|ux|testing|mobile","why":"..."}
  ],
  "next_block": {
    "name":"...",
    "why":"...",
    "deliverables":["..."],
    "tests":["..."]
  },
  "warnings":["..."],
  "mobile_note":"..."
}

Criterio: prioriza lo indispensable para un piloto confiable y seguro. Responde solo JSON.
'''.strip()


def post_json(url, headers, body, attempts=3, timeout=120):
    last_error = None
    for attempt in range(1, attempts + 1):
        try:
            r = requests.post(url, headers=headers, json=body, timeout=timeout)
            if r.status_code in {429, 500, 502, 503, 504} and attempt < attempts:
                time.sleep(10 * attempt)
                continue
            r.raise_for_status()
            return r.json()
        except Exception as exc:
            last_error = exc
            if attempt < attempts:
                time.sleep(10 * attempt)
            else:
                raise
    raise last_error


def extract_text_maybe_json(value):
    if isinstance(value, dict):
        return value
    text = value.strip()
    return json.loads(text)


def call_xai():
    api_key = os.environ['XAI_API_KEY']
    data = post_json(
        'https://api.x.ai/v1/chat/completions',
        {'Authorization': f'Bearer {api_key}', 'Content-Type': 'application/json'},
        {
            'model': 'grok-4',
            'temperature': 0.1,
            'messages': [
                {'role': 'system', 'content': 'Eres un arquitecto de producto SaaS B2B. Devuelve solo JSON válido.'},
                {'role': 'user', 'content': PROMPT},
            ],
            'response_format': {'type': 'json_object'},
        },
    )
    content = data['choices'][0]['message']['content']
    parsed = extract_text_maybe_json(content)
    (OUT / 'v1_priority_grok_light.json').write_text(json.dumps(parsed, ensure_ascii=False, indent=2))
    return parsed


def call_gemini():
    api_key = os.environ['GEMINI_API_KEY']
    model_candidates = ['gemini-2.5-flash', 'gemini-2.0-flash-lite', 'gemini-2.0-flash']
    last_error = None
    for model in model_candidates:
        try:
            data = post_json(
                f'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}',
                {'Content-Type': 'application/json'},
                {
                    'contents': [{'parts': [{'text': PROMPT}]}],
                    'system_instruction': {'parts': [{'text': 'Eres un arquitecto de producto SaaS B2B. Devuelve solo JSON válido.'}]},
                    'generationConfig': {
                        'temperature': 0.1,
                        'responseMimeType': 'application/json'
                    }
                },
            )
            text = data['candidates'][0]['content']['parts'][0]['text']
            parsed = extract_text_maybe_json(text)
            (OUT / 'v1_priority_gemini_light.json').write_text(json.dumps({'model': model, 'result': parsed}, ensure_ascii=False, indent=2))
            return parsed
        except Exception as exc:
            last_error = exc
            (OUT / 'v1_priority_gemini_light_last_error.txt').write_text(f'{model}: {exc}')
    raise last_error


if __name__ == '__main__':
    results = {}
    errors = {}
    for name, fn in [('grok', call_xai), ('gemini', call_gemini)]:
        try:
            results[name] = fn()
        except Exception as exc:
            errors[name] = str(exc)
    summary = {'results': results, 'errors': errors}
    (OUT / 'v1_priority_light_summary.json').write_text(json.dumps(summary, ensure_ascii=False, indent=2))
    print(json.dumps(summary, ensure_ascii=False, indent=2))
