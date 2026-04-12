import json
import os
import time
from pathlib import Path

import requests

ROOT = Path('/home/ubuntu/complilink_operativo_v1')
PROMPT_PATH = ROOT / '.analysis' / 'multi_ai_bridge_next_three_prompt.md'
OUTPUT_PATH = ROOT / '.analysis' / 'multi_ai_bridge_next_three_raw.json'

prompt = PROMPT_PATH.read_text(encoding='utf-8')

SYSTEM_PROMPT = (
    'Eres un arquitecto de software senior. Responde en español. '
    'Prioriza cambios mínimos, reutilización máxima, trazabilidad y bajo riesgo. '
    'No propongas refactors grandes salvo que sean estrictamente necesarios.'
)


def call_openai():
    api_key = os.getenv('OPENAI_API_KEY')
    if not api_key:
        return {'provider': 'openai', 'status': 'missing_key'}

    url = 'https://api.openai.com/v1/chat/completions'
    headers = {
        'Authorization': f'Bearer {api_key}',
        'Content-Type': 'application/json',
    }
    model_candidates = ['gpt-4.1-mini', 'gpt-4o-mini', 'gpt-4.1']
    last_error = None
    for model in model_candidates:
        try:
            response = requests.post(
                url,
                headers=headers,
                json={
                    'model': model,
                    'temperature': 0.2,
                    'messages': [
                        {'role': 'system', 'content': SYSTEM_PROMPT},
                        {'role': 'user', 'content': prompt},
                    ],
                },
                timeout=120,
            )
            if response.ok:
                data = response.json()
                content = data['choices'][0]['message']['content']
                return {
                    'provider': 'openai',
                    'status': 'ok',
                    'model': model,
                    'content': content,
                }
            last_error = {'status_code': response.status_code, 'body': response.text[:2000], 'model': model}
        except Exception as exc:  # noqa: BLE001
            last_error = {'error': str(exc), 'model': model}
    return {'provider': 'openai', 'status': 'error', 'detail': last_error}


def call_gemini():
    api_key = os.getenv('GEMINI_API_KEY')
    if not api_key:
        return {'provider': 'gemini', 'status': 'missing_key'}

    model_candidates = ['gemini-2.5-flash', 'gemini-2.0-flash']
    last_error = None
    for model in model_candidates:
        url = f'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}'
        try:
            response = requests.post(
                url,
                headers={'Content-Type': 'application/json'},
                json={
                    'systemInstruction': {
                        'parts': [{'text': SYSTEM_PROMPT}],
                    },
                    'contents': [
                        {
                            'role': 'user',
                            'parts': [{'text': prompt}],
                        }
                    ],
                    'generationConfig': {
                        'temperature': 0.2,
                    },
                },
                timeout=120,
            )
            if response.ok:
                data = response.json()
                candidates = data.get('candidates') or []
                parts = []
                for candidate in candidates:
                    for part in candidate.get('content', {}).get('parts', []):
                        text = part.get('text')
                        if text:
                            parts.append(text)
                return {
                    'provider': 'gemini',
                    'status': 'ok',
                    'model': model,
                    'content': '\n'.join(parts).strip(),
                }
            last_error = {'status_code': response.status_code, 'body': response.text[:2000], 'model': model}
        except Exception as exc:  # noqa: BLE001
            last_error = {'error': str(exc), 'model': model}
    return {'provider': 'gemini', 'status': 'error', 'detail': last_error}


def call_xai():
    api_key = os.getenv('XAI_API_KEY')
    if not api_key:
        return {'provider': 'xai', 'status': 'missing_key'}

    url = 'https://api.x.ai/v1/chat/completions'
    headers = {
        'Authorization': f'Bearer {api_key}',
        'Content-Type': 'application/json',
    }
    model_candidates = ['grok-3-mini', 'grok-3-beta', 'grok-4']
    last_error = None
    for model in model_candidates:
        try:
            response = requests.post(
                url,
                headers=headers,
                json={
                    'model': model,
                    'temperature': 0.2,
                    'messages': [
                        {'role': 'system', 'content': SYSTEM_PROMPT},
                        {'role': 'user', 'content': prompt},
                    ],
                },
                timeout=120,
            )
            if response.ok:
                data = response.json()
                content = data['choices'][0]['message']['content']
                return {
                    'provider': 'xai',
                    'status': 'ok',
                    'model': model,
                    'content': content,
                }
            last_error = {'status_code': response.status_code, 'body': response.text[:2000], 'model': model}
        except Exception as exc:  # noqa: BLE001
            last_error = {'error': str(exc), 'model': model}
    return {'provider': 'xai', 'status': 'error', 'detail': last_error}


results = {
    'generated_at': int(time.time()),
    'prompt_path': str(PROMPT_PATH),
    'results': [call_openai(), call_gemini(), call_xai()],
}

OUTPUT_PATH.write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding='utf-8')
print(str(OUTPUT_PATH))
