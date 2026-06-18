import json
import os
from pathlib import Path
from typing import Callable

import requests

BASE_DIR = Path('/home/ubuntu/complilink_operativo_v1')
PROMPT_PATH = BASE_DIR / 'mobile_architecture_multi_ai_prompt_2026-06-18.md'
OUTPUT_PATH = BASE_DIR / 'mobile_architecture_multi_ai_output_2026-06-18.json'

SYSTEM_PROMPT = (
    'Eres un arquitecto senior de apps móviles y plataformas. '
    'Debes ser estricto, pragmático y responder en JSON válido exactamente con la forma solicitada. '
    'No agregues texto fuera del JSON.'
)

USER_PROMPT = PROMPT_PATH.read_text()
TIMEOUT = 180


def call_openai() -> dict:
    api_key = os.environ['OPENAI_API_KEY']
    url = 'https://api.openai.com/v1/chat/completions'
    payload = {
        'model': 'gpt-4.1',
        'temperature': 0.2,
        'response_format': {'type': 'json_object'},
        'messages': [
            {'role': 'system', 'content': SYSTEM_PROMPT},
            {'role': 'user', 'content': USER_PROMPT},
        ],
    }
    response = requests.post(
        url,
        headers={
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json',
        },
        json=payload,
        timeout=TIMEOUT,
    )
    response.raise_for_status()
    data = response.json()
    return json.loads(data['choices'][0]['message']['content'])


def call_grok() -> dict:
    api_key = os.environ['XAI_API_KEY']
    url = 'https://api.x.ai/v1/chat/completions'
    payload = {
        'model': 'grok-4',
        'temperature': 0.2,
        'response_format': {'type': 'json_object'},
        'messages': [
            {'role': 'system', 'content': SYSTEM_PROMPT},
            {'role': 'user', 'content': USER_PROMPT},
        ],
    }
    response = requests.post(
        url,
        headers={
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json',
        },
        json=payload,
        timeout=TIMEOUT,
    )
    response.raise_for_status()
    data = response.json()
    return json.loads(data['choices'][0]['message']['content'])


def _gemini_text_from_response(data: dict) -> str:
    candidates = data.get('candidates') or []
    parts: list[str] = []
    for candidate in candidates:
        content = candidate.get('content') or {}
        for part in content.get('parts') or []:
            if 'text' in part:
                parts.append(part['text'])
    if not parts:
        raise RuntimeError(f'Respuesta de Gemini sin texto útil: {json.dumps(data)[:1000]}')
    return '\n'.join(parts)


def call_gemini() -> dict:
    api_key = os.environ['GEMINI_API_KEY']
    url = (
        'https://generativelanguage.googleapis.com/v1beta/models/'
        f'gemini-2.5-flash:generateContent?key={api_key}'
    )
    payload = {
        'system_instruction': {'parts': [{'text': SYSTEM_PROMPT}]},
        'contents': [{'parts': [{'text': USER_PROMPT}]}],
        'generationConfig': {
            'temperature': 0.2,
            'responseMimeType': 'application/json',
        },
    }
    response = requests.post(
        url,
        headers={'Content-Type': 'application/json'},
        json=payload,
        timeout=TIMEOUT,
    )
    response.raise_for_status()
    data = response.json()
    return json.loads(_gemini_text_from_response(data))


def run_call(name: str, fn: Callable[[], dict]) -> tuple[str, dict]:
    try:
        return name, fn()
    except Exception as exc:  # noqa: BLE001
        return name, {'error': f'{type(exc).__name__}: {exc}'}


if __name__ == '__main__':
    results = {
        name: result
        for name, result in [
            run_call('chatgpt', call_openai),
            run_call('grok', call_grok),
            run_call('gemini', call_gemini),
        ]
    }
    payload = {
        'prompt_file': str(PROMPT_PATH),
        'results': results,
    }
    OUTPUT_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + '\n')
    print(str(OUTPUT_PATH))
    print(json.dumps(payload, ensure_ascii=False, indent=2))
