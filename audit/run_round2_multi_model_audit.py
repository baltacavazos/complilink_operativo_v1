from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Callable

import requests

BASE_DIR = Path('/home/ubuntu/complilink_operativo_v1/audit')
PROMPT_PATH = BASE_DIR / 'round2_audit_prompt.md'
OUTPUT_DIR = BASE_DIR / 'round2_model_outputs'
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

SYSTEM_PROMPT = (
    'Eres un auditor senior de UX/UI y producto digital. '\
    'Debes ser estricto, claro, accionable y honesto. '\
    'No suavices críticas importantes. Responde en español.'
)

USER_PROMPT = PROMPT_PATH.read_text()
TIMEOUT = 180


def save_output(name: str, text: str) -> Path:
    path = OUTPUT_DIR / f'{name}.md'
    path.write_text(text.strip() + '\n')
    return path


def call_openai() -> Path:
    api_key = os.environ['OPENAI_API_KEY']
    url = 'https://api.openai.com/v1/chat/completions'
    payload = {
        'model': 'gpt-4.1',
        'temperature': 0.3,
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
    text = data['choices'][0]['message']['content']
    return save_output('chatgpt_round2', text)


def call_grok() -> Path:
    api_key = os.environ['XAI_API_KEY']
    url = 'https://api.x.ai/v1/chat/completions'
    payload = {
        'model': 'grok-4',
        'temperature': 0.3,
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
    text = data['choices'][0]['message']['content']
    return save_output('grok_round2', text)


def _gemini_text_from_response(data: dict) -> str:
    candidates = data.get('candidates') or []
    parts: list[str] = []
    for candidate in candidates:
        content = candidate.get('content') or {}
        for part in content.get('parts') or []:
            if 'text' in part:
                parts.append(part['text'])
    if not parts:
        raise RuntimeError(f'Respuesta de Gemini sin texto util: {json.dumps(data)[:1000]}')
    return '\n'.join(parts)


def call_gemini() -> Path:
    api_key = os.environ['GEMINI_API_KEY']
    url = (
        'https://generativelanguage.googleapis.com/v1beta/models/'
        f'gemini-2.5-flash:generateContent?key={api_key}'
    )
    payload = {
        'system_instruction': {'parts': [{'text': SYSTEM_PROMPT}]},
        'contents': [{'parts': [{'text': USER_PROMPT}]}],
        'generationConfig': {
            'temperature': 0.3,
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
    text = _gemini_text_from_response(data)
    return save_output('gemini_round2', text)


def run_call(name: str, fn: Callable[[], Path]) -> tuple[str, str]:
    try:
        output = fn()
        return name, str(output)
    except Exception as exc:  # noqa: BLE001
        error_path = OUTPUT_DIR / f'{name}_error.txt'
        error_path.write_text(f'{type(exc).__name__}: {exc}\n')
        return name, f'ERROR::{error_path}'


if __name__ == '__main__':
    results = {
        name: path
        for name, path in [
            run_call('chatgpt_round2', call_openai),
            run_call('grok_round2', call_grok),
            run_call('gemini_round2', call_gemini),
        ]
    }
    print(json.dumps(results, ensure_ascii=False, indent=2))
