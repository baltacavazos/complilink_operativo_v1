import json
import os
from pathlib import Path

import requests

brief = Path('/home/ubuntu/complilink_operativo_v1/tmp_worker_case_brief.md').read_text(encoding='utf-8')
out_path = Path('/home/ubuntu/complilink_operativo_v1/tmp_worker_case_multiai.json')

PROMPT = f'''Analiza este caso laboral mexicano y responde solo JSON válido.

{brief}

Quiero validar dos cosas: 1) qué hallazgos debería detectar una plataforma laboral que procesa XML de nómina y contrato, y 2) qué señales indicarían que el flujo de procesamiento está funcionando bien.

Devuelve exactamente este esquema:
{{
  "key_findings": ["..."],
  "possible_inconsistencies": ["..."],
  "expected_working_signals": ["..."],
  "priority_checks": ["..."],
  "short_verdict": "..."
}}

Condiciones: responde en español, no inventes datos, no prometas conclusiones legales finales, enfócate en consistencia documental y funcionamiento del flujo.'''


def call_openai():
    api_key = os.environ.get('OPENAI_API_KEY')
    if not api_key:
        return {'error': 'OPENAI_API_KEY no disponible'}
    r = requests.post(
        'https://api.openai.com/v1/chat/completions',
        headers={'Authorization': f'Bearer {api_key}', 'Content-Type': 'application/json'},
        json={
            'model': 'gpt-4.1-mini',
            'messages': [
                {'role': 'system', 'content': 'Eres un auditor documental laboral. Devuelve solo JSON válido.'},
                {'role': 'user', 'content': PROMPT},
            ],
            'temperature': 0.2,
            'response_format': {'type': 'json_object'},
        },
        timeout=60,
    )
    r.raise_for_status()
    return json.loads(r.json()['choices'][0]['message']['content'])


def call_gemini():
    api_key = os.environ.get('GEMINI_API_KEY')
    if not api_key:
        return {'error': 'GEMINI_API_KEY no disponible'}
    url = f'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}'
    r = requests.post(
        url,
        headers={'Content-Type': 'application/json'},
        json={
            'contents': [{'parts': [{'text': PROMPT}]}],
            'generationConfig': {
                'temperature': 0.2,
                'responseMimeType': 'application/json',
            },
        },
        timeout=60,
    )
    r.raise_for_status()
    text = r.json()['candidates'][0]['content']['parts'][0]['text']
    return json.loads(text)


def call_grok():
    api_key = os.environ.get('XAI_API_KEY')
    if not api_key:
        return {'error': 'XAI_API_KEY no disponible'}
    r = requests.post(
        'https://api.x.ai/v1/chat/completions',
        headers={'Authorization': f'Bearer {api_key}', 'Content-Type': 'application/json'},
        json={
            'model': 'grok-3-mini-fast',
            'messages': [
                {'role': 'system', 'content': 'Eres un auditor documental laboral. Devuelve solo JSON válido.'},
                {'role': 'user', 'content': PROMPT},
            ],
            'temperature': 0.2,
            'max_tokens': 700,
            'response_format': {'type': 'json_object'},
        },
        timeout=45,
    )
    r.raise_for_status()
    return json.loads(r.json()['choices'][0]['message']['content'])

results = {}
for name, fn in [('chatgpt', call_openai), ('gemini', call_gemini), ('grok', call_grok)]:
    try:
        results[name] = fn()
    except Exception as exc:
        results[name] = {'error': str(exc)}

out_path.write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding='utf-8')
print(out_path)
