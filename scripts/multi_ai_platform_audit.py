import base64
import json
import os
import re
import sys
import time
from pathlib import Path

import requests

BASE_DIR = Path('/home/ubuntu/complilink_operativo_v1')
NOTES_DIR = BASE_DIR / '.manus-notes'
OUTPUT_PATH = NOTES_DIR / 'auditoria_multi_ia_raw.json'
PROMPT_PATH = NOTES_DIR / 'auditoria_integral_prompt.md'

IMAGE_PATHS = [
    Path('/home/ubuntu/screenshots/3000-it0vzwdi5evut30_2026-04-29_23-16-09_6037.webp'),
    Path('/home/ubuntu/screenshots/3000-it0vzwdi5evut30_2026-04-29_23-16-32_8118.webp'),
    Path('/home/ubuntu/screenshots/3000-it0vzwdi5evut30_2026-04-29_23-17-20_5661.webp'),
]

OPENAI_API_KEY = os.getenv('OPENAI_API_KEY')
GEMINI_API_KEY = os.getenv('GEMINI_API_KEY')
XAI_API_KEY = os.getenv('XAI_API_KEY')

if not (OPENAI_API_KEY and GEMINI_API_KEY and XAI_API_KEY):
    missing = [
        name
        for name, value in [
            ('OPENAI_API_KEY', OPENAI_API_KEY),
            ('GEMINI_API_KEY', GEMINI_API_KEY),
            ('XAI_API_KEY', XAI_API_KEY),
        ]
        if not value
    ]
    raise SystemExit(f'Faltan credenciales: {", ".join(missing)}')

PROMPT = PROMPT_PATH.read_text(encoding='utf-8')


def image_to_data_url(path: Path) -> str:
    mime = 'image/webp'
    encoded = base64.b64encode(path.read_bytes()).decode('ascii')
    return f'data:{mime};base64,{encoded}'


def extract_json(text: str):
    text = text.strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    match = re.search(r'\{.*\}', text, re.S)
    if match:
        return json.loads(match.group(0))
    raise ValueError(f'No pude extraer JSON válido de la respuesta: {text[:500]}')


def build_multimodal_parts_for_openai():
    parts = [{'type': 'text', 'text': PROMPT}]
    for path in IMAGE_PATHS:
        parts.append(
            {
                'type': 'image_url',
                'image_url': {
                    'url': image_to_data_url(path),
                    'detail': 'high',
                },
            }
        )
    return parts


def call_openai():
    payload = {
        'model': 'gpt-4.1-mini',
        'temperature': 0.2,
        'response_format': {'type': 'json_object'},
        'messages': [
            {
                'role': 'system',
                'content': 'Eres un auditor senior de UX, producto y arquitectura de información. Responde únicamente en JSON válido.',
            },
            {
                'role': 'user',
                'content': build_multimodal_parts_for_openai(),
            },
        ],
    }
    response = requests.post(
        'https://api.openai.com/v1/chat/completions',
        headers={
            'Authorization': f'Bearer {OPENAI_API_KEY}',
            'Content-Type': 'application/json',
        },
        json=payload,
        timeout=180,
    )
    response.raise_for_status()
    data = response.json()
    content = data['choices'][0]['message']['content']
    return extract_json(content), data


def call_xai():
    payload = {
        'model': 'grok-4',
        'temperature': 0.2,
        'response_format': {'type': 'json_object'},
        'messages': [
            {
                'role': 'system',
                'content': 'Eres un auditor senior de UX, producto y arquitectura de información. Responde únicamente en JSON válido.',
            },
            {
                'role': 'user',
                'content': build_multimodal_parts_for_openai(),
            },
        ],
    }
    response = requests.post(
        'https://api.x.ai/v1/chat/completions',
        headers={
            'Authorization': f'Bearer {XAI_API_KEY}',
            'Content-Type': 'application/json',
        },
        json=payload,
        timeout=180,
    )
    response.raise_for_status()
    data = response.json()
    content = data['choices'][0]['message']['content']
    return extract_json(content), data


def call_gemini():
    parts = [{'text': PROMPT}]
    for path in IMAGE_PATHS:
        parts.append(
            {
                'inline_data': {
                    'mime_type': 'image/webp',
                    'data': base64.b64encode(path.read_bytes()).decode('ascii'),
                }
            }
        )

    payload = {
        'system_instruction': {
            'parts': [
                {
                    'text': 'Eres un auditor senior de UX, producto y arquitectura de información. Responde únicamente en JSON válido.'
                }
            ]
        },
        'contents': [
            {
                'role': 'user',
                'parts': parts,
            }
        ],
        'generationConfig': {
            'temperature': 0.2,
            'responseMimeType': 'application/json',
        },
    }
    response = requests.post(
        f'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={GEMINI_API_KEY}',
        headers={'Content-Type': 'application/json'},
        json=payload,
        timeout=180,
    )
    response.raise_for_status()
    data = response.json()
    content = data['candidates'][0]['content']['parts'][0]['text']
    return extract_json(content), data


def run_call(label, fn):
    started = time.time()
    try:
        parsed, raw = fn()
        return {
            'ok': True,
            'seconds': round(time.time() - started, 2),
            'parsed': parsed,
            'raw': raw,
        }
    except Exception as exc:  # noqa: BLE001
        return {
            'ok': False,
            'seconds': round(time.time() - started, 2),
            'error': str(exc),
        }


results = {
    'generated_at': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
    'prompt_path': str(PROMPT_PATH),
    'images': [str(path) for path in IMAGE_PATHS],
    'openai': run_call('openai', call_openai),
    'xai': run_call('xai', call_xai),
    'gemini': run_call('gemini', call_gemini),
}

OUTPUT_PATH.write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps({
    'output_path': str(OUTPUT_PATH),
    'status': {
        key: {'ok': value.get('ok'), 'seconds': value.get('seconds'), 'error': value.get('error')}
        for key, value in results.items()
        if key in {'openai', 'xai', 'gemini'}
    }
}, ensure_ascii=False, indent=2))
