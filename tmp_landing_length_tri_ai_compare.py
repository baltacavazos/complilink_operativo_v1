#!/usr/bin/env python3
import base64
import json
import os
import re
from pathlib import Path

import requests

ROOT = Path('/home/ubuntu/complilink_operativo_v1')
IMAGE_PATH = Path('/home/ubuntu/upload/pasted_file_h5tbxv_image.webp')
PROMPT_PATH = ROOT / 'tmp_landing_length_tri_ai_prompt.md'
OUTPUT_PATH = ROOT / 'tmp_landing_length_tri_ai_compare.json'
TIMEOUT = 180


def parse_json(text: str):
    text = (text or '').strip()
    if not text:
        return None
    try:
        return json.loads(text)
    except Exception:
        pass
    m = re.search(r'```json\s*(\{.*?\})\s*```', text, re.S)
    if m:
        try:
            return json.loads(m.group(1))
        except Exception:
            return None
    m = re.search(r'(\{.*\})', text, re.S)
    if m:
        try:
            return json.loads(m.group(1))
        except Exception:
            return None
    return None


def image_b64() -> str:
    return base64.b64encode(IMAGE_PATH.read_bytes()).decode('utf-8')


def call_openai(prompt: str, img64: str):
    api_key = os.environ.get('OPENAI_API_KEY')
    if not api_key:
        return {'provider': 'openai', 'error': 'OPENAI_API_KEY missing'}
    headers = {'Authorization': f'Bearer {api_key}', 'Content-Type': 'application/json'}
    payload = {
        'model': 'gpt-4.1-mini',
        'temperature': 0.1,
        'response_format': {'type': 'json_object'},
        'messages': [
            {'role': 'system', 'content': 'Responde únicamente JSON válido con el esquema solicitado.'},
            {
                'role': 'user',
                'content': [
                    {'type': 'text', 'text': prompt},
                    {'type': 'image_url', 'image_url': {'url': f'data:image/webp;base64,{img64}', 'detail': 'high'}},
                ],
            },
        ],
    }
    r = requests.post('https://api.openai.com/v1/chat/completions', headers=headers, json=payload, timeout=TIMEOUT)
    if not r.ok:
        return {'provider': 'openai', 'status': r.status_code, 'error': r.text[:4000]}
    content = r.json()['choices'][0]['message']['content']
    return {'provider': 'openai', 'status': 200, 'raw': content, 'parsed': parse_json(content)}


def call_xai(prompt: str, img64: str):
    api_key = os.environ.get('XAI_API_KEY')
    if not api_key:
        return {'provider': 'xai', 'error': 'XAI_API_KEY missing'}
    headers = {'Authorization': f'Bearer {api_key}', 'Content-Type': 'application/json'}
    models = ['grok-4', 'grok-2-vision-1212', 'grok-3-mini']
    last_error = None
    for model in models:
        payload = {
            'model': model,
            'temperature': 0.1,
            'response_format': {'type': 'json_object'},
            'messages': [
                {'role': 'system', 'content': 'Responde únicamente JSON válido con el esquema solicitado.'},
                {
                    'role': 'user',
                    'content': [
                        {'type': 'text', 'text': prompt},
                        {'type': 'image_url', 'image_url': {'url': f'data:image/webp;base64,{img64}', 'detail': 'high'}},
                    ],
                },
            ],
        }
        r = requests.post('https://api.x.ai/v1/chat/completions', headers=headers, json=payload, timeout=TIMEOUT)
        if r.ok:
            content = r.json()['choices'][0]['message']['content']
            return {'provider': 'xai', 'model': model, 'status': 200, 'raw': content, 'parsed': parse_json(content)}
        last_error = {'model': model, 'status': r.status_code, 'error': r.text[:4000]}
    return {'provider': 'xai', **(last_error or {'error': 'unknown xai error'})}


def call_gemini(prompt: str, img64: str):
    api_key = os.environ.get('GEMINI_API_KEY')
    if not api_key:
        return {'provider': 'gemini', 'error': 'GEMINI_API_KEY missing'}
    url = f'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}'
    headers = {'Content-Type': 'application/json'}
    payload = {
        'contents': [
            {
                'parts': [
                    {'text': prompt + '\n\nResponde SOLO con JSON válido.'},
                    {'inline_data': {'mime_type': 'image/webp', 'data': img64}},
                ]
            }
        ],
        'generationConfig': {
            'temperature': 0.1,
            'responseMimeType': 'application/json'
        }
    }
    r = requests.post(url, headers=headers, json=payload, timeout=TIMEOUT)
    if not r.ok:
        return {'provider': 'gemini', 'status': r.status_code, 'error': r.text[:4000]}
    data = r.json()
    try:
        content = data['candidates'][0]['content']['parts'][0]['text']
    except Exception:
        return {'provider': 'gemini', 'status': 200, 'raw': data, 'parsed': None}
    return {'provider': 'gemini', 'status': 200, 'raw': content, 'parsed': parse_json(content)}


def summarize(results: dict):
    parsed = {k: v.get('parsed') for k, v in results.items() if isinstance(v, dict) and v.get('parsed')}
    verdicts = {}
    actions = {}
    hurting = {}
    for k, p in parsed.items():
        verdicts[k] = p.get('overall_verdict')
        actions[k] = p.get('recommended_action')
        hurting[k] = p.get('is_length_hurting_conversion')
    return {
        'providers_with_valid_json': list(parsed.keys()),
        'verdicts': verdicts,
        'recommended_actions': actions,
        'hurting_conversion_flags': hurting,
    }


def main():
    prompt = PROMPT_PATH.read_text(encoding='utf-8')
    img64 = image_b64()
    results = {
        'openai': call_openai(prompt, img64),
        'xai': call_xai(prompt, img64),
        'gemini': call_gemini(prompt, img64),
    }
    output = {'prompt_path': str(PROMPT_PATH), 'image_path': str(IMAGE_PATH), 'results': results, 'summary': summarize(results)}
    OUTPUT_PATH.write_text(json.dumps(output, ensure_ascii=False, indent=2), encoding='utf-8')
    print(str(OUTPUT_PATH))


if __name__ == '__main__':
    main()
