import json
import os
from pathlib import Path

import requests

PROJECT_ROOT = Path('/home/ubuntu/complilink_operativo_v1')
BRIEF_PATH = PROJECT_ROOT / 'v1_scalability_audit_brief.md'
OUTPUT_PATH = PROJECT_ROOT / 'v1_scalability_audit_results.json'
TIMEOUT = 120

brief = BRIEF_PATH.read_text(encoding='utf-8')

SYSTEM_PROMPT = (
    'Eres un auditor senior de producto SaaS con criterio estricto de release V1 y escalabilidad prudente. '
    'Debes priorizar estabilidad, permisos, claridad operativa, riesgo real y preparación básica para crecimiento. '
    'No propongas expansión de alcance, rediseños grandes ni features cosméticas.'
)

USER_PROMPT = brief


def call_openai():
    api_key = os.environ.get('OPENAI_API_KEY')
    if not api_key:
        return {'status': 'missing_key', 'error': 'OPENAI_API_KEY no disponible'}

    response = requests.post(
        'https://api.openai.com/v1/chat/completions',
        headers={
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json',
        },
        json={
            'model': 'gpt-4.1-mini',
            'temperature': 0.2,
            'messages': [
                {'role': 'system', 'content': SYSTEM_PROMPT},
                {'role': 'user', 'content': USER_PROMPT},
            ],
        },
        timeout=TIMEOUT,
    )
    response.raise_for_status()
    data = response.json()
    return {
        'status': 'ok',
        'model': data.get('model'),
        'content': data['choices'][0]['message']['content'],
    }


def call_grok():
    api_key = os.environ.get('XAI_API_KEY')
    if not api_key:
        return {'status': 'missing_key', 'error': 'XAI_API_KEY no disponible'}

    response = requests.post(
        'https://api.x.ai/v1/chat/completions',
        headers={
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json',
        },
        json={
            'model': 'grok-4-0709',
            'temperature': 0.2,
            'messages': [
                {'role': 'system', 'content': SYSTEM_PROMPT},
                {'role': 'user', 'content': USER_PROMPT},
            ],
        },
        timeout=TIMEOUT,
    )
    response.raise_for_status()
    data = response.json()
    return {
        'status': 'ok',
        'model': data.get('model'),
        'content': data['choices'][0]['message']['content'],
    }


def call_gemini():
    api_key = os.environ.get('GEMINI_API_KEY')
    if not api_key:
        return {'status': 'missing_key', 'error': 'GEMINI_API_KEY no disponible'}

    response = requests.post(
        f'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}',
        headers={'Content-Type': 'application/json'},
        json={
            'system_instruction': {'parts': [{'text': SYSTEM_PROMPT}]},
            'contents': [{'role': 'user', 'parts': [{'text': USER_PROMPT}]}],
            'generationConfig': {'temperature': 0.2},
        },
        timeout=TIMEOUT,
    )
    if response.status_code >= 400:
        try:
            error_data = response.json()
        except Exception:
            error_data = {'raw': response.text}
        return {'status': 'error', 'http_status': response.status_code, 'error': error_data}

    data = response.json()
    text_parts = []
    for candidate in data.get('candidates', []):
        content = candidate.get('content', {})
        for part in content.get('parts', []):
            if 'text' in part:
                text_parts.append(part['text'])
    return {
        'status': 'ok',
        'model': 'gemini-2.5-flash',
        'content': '\n'.join(text_parts).strip(),
    }


results = {}
for provider, fn in [('openai', call_openai), ('grok', call_grok), ('gemini', call_gemini)]:
    try:
        results[provider] = fn()
    except Exception as exc:
        results[provider] = {'status': 'error', 'error': str(exc)}

OUTPUT_PATH.write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding='utf-8')
print(str(OUTPUT_PATH))
