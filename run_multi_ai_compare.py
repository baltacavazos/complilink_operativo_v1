#!/usr/bin/env python3
import json
import os
import re
import sys
from pathlib import Path

import requests

ROOT = Path('/home/ubuntu/complilink_operativo_v1')
PROMPT_PATH = ROOT / 'tmp_multi_ai_v1_robustness_prompt.md'
OUTPUT_PATH = ROOT / 'tmp_multi_ai_v1_robustness_compare.json'
TIMEOUT = 120


def load_prompt() -> str:
    return PROMPT_PATH.read_text(encoding='utf-8')


def extract_json_block(text: str):
    text = text.strip()
    if not text:
        return None
    try:
        return json.loads(text)
    except Exception:
        pass
    match = re.search(r'```json\s*(\{.*?\})\s*```', text, re.S)
    if match:
        try:
            return json.loads(match.group(1))
        except Exception:
            pass
    match = re.search(r'(\{.*\})', text, re.S)
    if match:
        try:
            return json.loads(match.group(1))
        except Exception:
            return None
    return None


def openai_call(prompt: str):
    api_key = os.environ.get('OPENAI_API_KEY')
    if not api_key:
        return {"provider": "openai", "error": "OPENAI_API_KEY missing"}

    url = 'https://api.openai.com/v1/chat/completions'
    headers = {
        'Authorization': f'Bearer {api_key}',
        'Content-Type': 'application/json',
    }
    models = ['gpt-4.1-mini', 'gpt-4o-mini', 'gpt-4.1']
    last_error = None
    for model in models:
        payload = {
            'model': model,
            'temperature': 0.1,
            'response_format': {'type': 'json_object'},
            'messages': [
                {'role': 'system', 'content': 'Responde únicamente JSON válido siguiendo exactamente el esquema solicitado por el usuario.'},
                {'role': 'user', 'content': prompt},
            ],
        }
        try:
            response = requests.post(url, headers=headers, json=payload, timeout=TIMEOUT)
            if response.ok:
                data = response.json()
                content = data['choices'][0]['message']['content']
                return {
                    'provider': 'openai',
                    'model': model,
                    'raw': content,
                    'parsed': extract_json_block(content),
                }
            last_error = {'status': response.status_code, 'body': response.text[:4000], 'model': model}
        except Exception as exc:
            last_error = {'model': model, 'exception': str(exc)}
    return {'provider': 'openai', 'error': last_error}


def xai_call(prompt: str):
    api_key = os.environ.get('XAI_API_KEY')
    if not api_key:
        return {"provider": "xai", "error": "XAI_API_KEY missing"}

    url = 'https://api.x.ai/v1/chat/completions'
    headers = {
        'Authorization': f'Bearer {api_key}',
        'Content-Type': 'application/json',
    }
    models = ['grok-3-mini', 'grok-4', 'grok-3']
    last_error = None
    for model in models:
        payload = {
            'model': model,
            'temperature': 0.1,
            'response_format': {'type': 'json_object'},
            'messages': [
                {'role': 'system', 'content': 'Responde únicamente JSON válido siguiendo exactamente el esquema solicitado por el usuario.'},
                {'role': 'user', 'content': prompt},
            ],
        }
        try:
            response = requests.post(url, headers=headers, json=payload, timeout=TIMEOUT)
            if response.ok:
                data = response.json()
                content = data['choices'][0]['message']['content']
                return {
                    'provider': 'xai',
                    'model': model,
                    'raw': content,
                    'parsed': extract_json_block(content),
                }
            last_error = {'status': response.status_code, 'body': response.text[:4000], 'model': model}
        except Exception as exc:
            last_error = {'model': model, 'exception': str(exc)}
    return {'provider': 'xai', 'error': last_error}


def gemini_call(prompt: str):
    api_key = os.environ.get('GEMINI_API_KEY')
    if not api_key:
        return {"provider": "gemini", "error": "GEMINI_API_KEY missing"}

    models = ['gemini-2.5-flash', 'gemini-2.0-flash']
    last_error = None
    for model in models:
        url = f'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}'
        payload = {
            'systemInstruction': {
                'parts': [{'text': 'Responde únicamente JSON válido siguiendo exactamente el esquema solicitado por el usuario.'}]
            },
            'contents': [
                {
                    'role': 'user',
                    'parts': [{'text': prompt}],
                }
            ],
            'generationConfig': {
                'temperature': 0.1,
                'responseMimeType': 'application/json',
            },
        }
        try:
            response = requests.post(url, json=payload, timeout=TIMEOUT)
            if response.ok:
                data = response.json()
                content = data['candidates'][0]['content']['parts'][0]['text']
                return {
                    'provider': 'gemini',
                    'model': model,
                    'raw': content,
                    'parsed': extract_json_block(content),
                }
            last_error = {'status': response.status_code, 'body': response.text[:4000], 'model': model}
        except Exception as exc:
            last_error = {'model': model, 'exception': str(exc)}
    return {'provider': 'gemini', 'error': last_error}


def summarize(results: dict):
    parsed = {k: v.get('parsed') for k, v in results.items() if isinstance(v, dict) and v.get('parsed')}
    recommended = {}
    for provider, payload in parsed.items():
        decision = payload.get('decision_ceo_bridge', {})
        option = decision.get('opcion_recomendada')
        if option:
            recommended[provider] = option
    plan_steps = []
    for provider, payload in parsed.items():
        for step in payload.get('plan_minimo_robusto', []):
            if step not in plan_steps:
                plan_steps.append(step)
    return {
        'parsed_providers': list(parsed.keys()),
        'ceo_bridge_recommendations': recommended,
        'consensus_plan_minimo_robusto': plan_steps,
    }


def main():
    prompt = load_prompt()
    results = {
        'openai': openai_call(prompt),
        'xai': xai_call(prompt),
        'gemini': gemini_call(prompt),
    }
    output = {
        'prompt_path': str(PROMPT_PATH),
        'results': results,
        'summary': summarize(results),
    }
    OUTPUT_PATH.write_text(json.dumps(output, ensure_ascii=False, indent=2), encoding='utf-8')
    print(str(OUTPUT_PATH))


if __name__ == '__main__':
    main()
