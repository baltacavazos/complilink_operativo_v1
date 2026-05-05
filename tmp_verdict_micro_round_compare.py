#!/usr/bin/env python3
import json
import os
import re
from pathlib import Path

import requests

ROOT = Path('/home/ubuntu/complilink_operativo_v1')
PROMPT = (ROOT / 'tmp_verdict_micro_round_prompt.md').read_text(encoding='utf-8')
OUT = ROOT / 'tmp_verdict_micro_round_compare.json'
TIMEOUT = 120


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


def call_openai():
    api_key = os.environ.get('OPENAI_API_KEY')
    headers = {'Authorization': f'Bearer {api_key}', 'Content-Type': 'application/json'}
    payload = {
        'model': 'gpt-4.1-mini',
        'temperature': 0.1,
        'response_format': {'type': 'json_object'},
        'messages': [
            {'role': 'system', 'content': 'Responde únicamente JSON válido con el esquema solicitado.'},
            {'role': 'user', 'content': PROMPT},
        ],
    }
    r = requests.post('https://api.openai.com/v1/chat/completions', headers=headers, json=payload, timeout=TIMEOUT)
    return {'status': r.status_code, 'raw': r.text, 'parsed': parse_json(r.json()['choices'][0]['message']['content']) if r.ok else None}


def call_xai():
    api_key = os.environ.get('XAI_API_KEY')
    headers = {'Authorization': f'Bearer {api_key}', 'Content-Type': 'application/json'}
    payload = {
        'model': 'grok-3-mini',
        'temperature': 0.1,
        'response_format': {'type': 'json_object'},
        'messages': [
            {'role': 'system', 'content': 'Responde únicamente JSON válido con el esquema solicitado.'},
            {'role': 'user', 'content': PROMPT},
        ],
    }
    r = requests.post('https://api.x.ai/v1/chat/completions', headers=headers, json=payload, timeout=TIMEOUT)
    return {'status': r.status_code, 'raw': r.text, 'parsed': parse_json(r.json()['choices'][0]['message']['content']) if r.ok else None}


results = {'openai': call_openai(), 'xai': call_xai()}
OUT.write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding='utf-8')
print(str(OUT))
