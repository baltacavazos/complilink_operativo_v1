import json
import os
import re
import time
from pathlib import Path

import requests

BASE_DIR = Path('/home/ubuntu/complilink_operativo_v1')
PROMPT_PATH = BASE_DIR / '.manus-notes' / 'simplificacion_priorizada_prompt.md'
OUTPUT_PATH = BASE_DIR / '.manus-notes' / 'simplificacion_priorizada_multi_ia.json'
PROMPT = PROMPT_PATH.read_text(encoding='utf-8')

OPENAI_API_KEY = os.getenv('OPENAI_API_KEY')
GEMINI_API_KEY = os.getenv('GEMINI_API_KEY')
XAI_API_KEY = os.getenv('XAI_API_KEY')


def extract_json(text: str):
    text = text.strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        match = re.search(r'\{.*\}', text, re.S)
        if match:
            return json.loads(match.group(0))
        raise


def call_openai():
    payload = {
        'model': 'gpt-4.1-mini',
        'temperature': 0.2,
        'response_format': {'type': 'json_object'},
        'messages': [
            {'role': 'system', 'content': 'Eres un auditor senior de UX y producto. Responde únicamente en JSON válido.'},
            {'role': 'user', 'content': PROMPT},
        ],
    }
    response = requests.post(
        'https://api.openai.com/v1/chat/completions',
        headers={'Authorization': f'Bearer {OPENAI_API_KEY}', 'Content-Type': 'application/json'},
        json=payload,
        timeout=180,
    )
    response.raise_for_status()
    data = response.json()
    return extract_json(data['choices'][0]['message']['content'])


def call_xai():
    payload = {
        'model': 'grok-4',
        'temperature': 0.2,
        'response_format': {'type': 'json_object'},
        'messages': [
            {'role': 'system', 'content': 'Eres un auditor senior de UX y producto. Responde únicamente en JSON válido.'},
            {'role': 'user', 'content': PROMPT},
        ],
    }
    response = requests.post(
        'https://api.x.ai/v1/chat/completions',
        headers={'Authorization': f'Bearer {XAI_API_KEY}', 'Content-Type': 'application/json'},
        json=payload,
        timeout=180,
    )
    response.raise_for_status()
    data = response.json()
    return extract_json(data['choices'][0]['message']['content'])


def call_gemini():
    payload = {
        'system_instruction': {'parts': [{'text': 'Eres un auditor senior de UX y producto. Responde únicamente en JSON válido.'}]},
        'contents': [{'role': 'user', 'parts': [{'text': PROMPT}]}],
        'generationConfig': {'temperature': 0.2, 'responseMimeType': 'application/json'},
    }
    response = requests.post(
        f'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={GEMINI_API_KEY}',
        headers={'Content-Type': 'application/json'},
        json=payload,
        timeout=180,
    )
    response.raise_for_status()
    data = response.json()
    return extract_json(data['candidates'][0]['content']['parts'][0]['text'])


def run_call(name, fn):
    started = time.time()
    try:
        parsed = fn()
        return {'ok': True, 'seconds': round(time.time() - started, 2), 'parsed': parsed}
    except Exception as exc:  # noqa: BLE001
        return {'ok': False, 'seconds': round(time.time() - started, 2), 'error': str(exc)}


results = {
    'generated_at': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
    'openai': run_call('openai', call_openai),
    'xai': run_call('xai', call_xai),
    'gemini': run_call('gemini', call_gemini),
}

OUTPUT_PATH.write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps({'output_path': str(OUTPUT_PATH), 'status': {k: {'ok': v.get('ok'), 'seconds': v.get('seconds'), 'error': v.get('error')} for k, v in results.items() if k in {'openai', 'xai', 'gemini'}}}, ensure_ascii=False, indent=2))
