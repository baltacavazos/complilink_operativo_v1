import json
import os
from pathlib import Path

import requests

ROOT = Path('/home/ubuntu/complilink_operativo_v1')
PROMPT_PATH = ROOT / 'research' / 'final_closure_master_brief_2026-05-15.md'
OUT_PATH = ROOT / 'research' / 'final_closure_multi_ai_results_2026-05-15.json'
TIMEOUT = 120

SYSTEM = 'Eres un comité senior de producto, UX, QA, arquitectura y operación. Responde únicamente con JSON válido y útil en español.'


def read_prompt() -> str:
    return PROMPT_PATH.read_text(encoding='utf-8')


def safe_json_loads(text: str):
    text = text.strip()
    if text.startswith('```'):
        parts = text.split('```')
        for part in parts:
            part = part.strip()
            if part.startswith('json'):
                part = part[4:].strip()
            if part.startswith('{') and part.endswith('}'):
                text = part
                break
    return json.loads(text)


def call_openai(prompt: str):
    key = os.environ.get('OPENAI_API_KEY')
    if not key:
        return {'error': 'OPENAI_API_KEY no configurada'}
    response = requests.post(
        'https://api.openai.com/v1/chat/completions',
        headers={
            'Authorization': f'Bearer {key}',
            'Content-Type': 'application/json',
        },
        json={
            'model': 'gpt-4.1-mini',
            'temperature': 0.2,
            'response_format': {'type': 'json_object'},
            'messages': [
                {'role': 'system', 'content': SYSTEM},
                {'role': 'user', 'content': prompt},
            ],
        },
        timeout=TIMEOUT,
    )
    response.raise_for_status()
    text = response.json()['choices'][0]['message']['content']
    return safe_json_loads(text)


def call_grok(prompt: str):
    key = os.environ.get('XAI_API_KEY')
    if not key:
        return {'error': 'XAI_API_KEY no configurada'}
    response = requests.post(
        'https://api.x.ai/v1/chat/completions',
        headers={
            'Authorization': f'Bearer {key}',
            'Content-Type': 'application/json',
        },
        json={
            'model': 'grok-4',
            'temperature': 0.2,
            'response_format': {'type': 'json_object'},
            'messages': [
                {'role': 'system', 'content': SYSTEM},
                {'role': 'user', 'content': prompt},
            ],
        },
        timeout=TIMEOUT,
    )
    response.raise_for_status()
    text = response.json()['choices'][0]['message']['content']
    return safe_json_loads(text)


def call_gemini(prompt: str):
    key = os.environ.get('GEMINI_API_KEY')
    if not key:
        return {'error': 'GEMINI_API_KEY no configurada'}
    response = requests.post(
        f'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={key}',
        headers={'Content-Type': 'application/json'},
        json={
            'system_instruction': {
                'parts': [{'text': SYSTEM}],
            },
            'contents': [
                {
                    'parts': [{'text': prompt}],
                }
            ],
            'generationConfig': {
                'temperature': 0.2,
                'responseMimeType': 'application/json',
            },
        },
        timeout=TIMEOUT,
    )
    response.raise_for_status()
    text = response.json()['candidates'][0]['content']['parts'][0]['text']
    return safe_json_loads(text)


def main():
    prompt = read_prompt()
    results = {
        'prompt_path': str(PROMPT_PATH),
        'models': {},
    }

    for name, fn in (
        ('openai', call_openai),
        ('grok', call_grok),
        ('gemini', call_gemini),
    ):
        try:
            results['models'][name] = fn(prompt)
        except Exception as exc:
            results['models'][name] = {'error': str(exc)}

    OUT_PATH.write_text(json.dumps(results, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(str(OUT_PATH))


if __name__ == '__main__':
    main()
