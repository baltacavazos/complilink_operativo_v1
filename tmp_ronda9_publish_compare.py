#!/usr/bin/env python3
import json
import os
import re
from pathlib import Path

import requests

ROOT = Path('/home/ubuntu/complilink_operativo_v1')
PROMPT_PATH = ROOT / 'tmp_ronda9_publish_prompt.md'
OUTPUT_PATH = ROOT / 'tmp_ronda9_publish_compare.json'
TIMEOUT = 120


def load_prompt() -> str:
    return PROMPT_PATH.read_text(encoding='utf-8')


def extract_json_block(text: str):
    text = (text or '').strip()
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


def call_openai(prompt: str):
    api_key = os.environ.get('OPENAI_API_KEY')
    if not api_key:
        return {'provider': 'openai', 'error': 'OPENAI_API_KEY missing'}
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
                {
                    'role': 'system',
                    'content': 'Responde únicamente JSON válido siguiendo exactamente el esquema solicitado por el usuario.'
                },
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


def call_xai(prompt: str):
    api_key = os.environ.get('XAI_API_KEY')
    if not api_key:
        return {'provider': 'xai', 'error': 'XAI_API_KEY missing'}
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
                {
                    'role': 'system',
                    'content': 'Responde únicamente JSON válido siguiendo exactamente el esquema solicitado por el usuario.'
                },
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


def summarize(results: dict):
    parsed = {
        provider: payload.get('parsed')
        for provider, payload in results.items()
        if isinstance(payload, dict) and payload.get('parsed')
    }

    scores = []
    recommendations = []
    blockers = []
    next_actions = []

    for payload in parsed.values():
        publish = payload.get('overall_publish_readiness', {})
        if isinstance(publish.get('score'), (int, float)):
            scores.append(publish['score'])
        if publish.get('recommendation'):
            recommendations.append(publish['recommendation'])
        if publish.get('reason'):
            blockers.append(publish['reason'])
        if payload.get('next_best_action'):
            next_actions.append(payload['next_best_action'])

    return {
        'parsed_providers': list(parsed.keys()),
        'average_score': round(sum(scores) / len(scores), 2) if scores else None,
        'recommendations': recommendations,
        'reasons': blockers,
        'next_actions': next_actions,
    }


def main():
    prompt = load_prompt()
    results = {
        'openai': call_openai(prompt),
        'xai': call_xai(prompt),
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
