from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

import requests

BASE_DIR = Path('/home/ubuntu/complilink_operativo_v1')
PROMPT_PATH = BASE_DIR / 'tmp_ronda8_tri_ai_prompt.md'
OUTPUT_PATH = BASE_DIR / 'tmp_ronda8_tri_ai_results.json'


def extract_json_candidate(text: str) -> Any:
    text = text.strip()
    if not text:
        return {"raw": text, "error": "empty_response"}
    try:
        return json.loads(text)
    except Exception:
        start = text.find('{')
        end = text.rfind('}')
        if start != -1 and end != -1 and end > start:
            try:
                return json.loads(text[start:end + 1])
            except Exception as exc:
                return {"raw": text, "error": f"json_parse_failed: {exc}"}
        return {"raw": text, "error": "no_json_object_found"}


def call_openai(prompt: str) -> dict[str, Any]:
    api_key = os.environ.get('OPENAI_API_KEY')
    if not api_key:
        return {"ok": False, "error": "missing OPENAI_API_KEY"}

    response = requests.post(
        'https://api.openai.com/v1/chat/completions',
        headers={
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json',
        },
        json={
            'model': 'gpt-4.1-mini',
            'temperature': 0.2,
            'response_format': {'type': 'json_object'},
            'messages': [
                {
                    'role': 'system',
                    'content': 'Eres un especialista en UX móvil para productos legales y documentales en México. Responde solo JSON válido.',
                },
                {'role': 'user', 'content': prompt},
            ],
        },
        timeout=120,
    )
    response.raise_for_status()
    data = response.json()
    content = data['choices'][0]['message']['content']
    return {"ok": True, "model": data.get('model'), "parsed": extract_json_candidate(content), "raw": content}


def call_grok(prompt: str) -> dict[str, Any]:
    api_key = os.environ.get('XAI_API_KEY')
    if not api_key:
        return {"ok": False, "error": "missing XAI_API_KEY"}

    response = requests.post(
        'https://api.x.ai/v1/chat/completions',
        headers={
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json',
        },
        json={
            'model': 'grok-3-mini',
            'temperature': 0.2,
            'response_format': {'type': 'json_object'},
            'messages': [
                {
                    'role': 'system',
                    'content': 'Eres un especialista en UX móvil para productos legales y documentales en México. Responde solo JSON válido.',
                },
                {'role': 'user', 'content': prompt},
            ],
        },
        timeout=120,
    )
    response.raise_for_status()
    data = response.json()
    content = data['choices'][0]['message']['content']
    return {"ok": True, "model": data.get('model'), "parsed": extract_json_candidate(content), "raw": content}


def call_gemini(prompt: str) -> dict[str, Any]:
    api_key = os.environ.get('GEMINI_API_KEY')
    if not api_key:
        return {"ok": False, "error": "missing GEMINI_API_KEY"}

    response = requests.post(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
        params={'key': api_key},
        headers={'Content-Type': 'application/json'},
        json={
            'generationConfig': {
                'temperature': 0.2,
                'responseMimeType': 'application/json',
            },
            'contents': [
                {
                    'role': 'user',
                    'parts': [
                        {
                            'text': 'Eres un especialista en UX móvil para productos legales y documentales en México. Responde solo JSON válido.\n\n' + prompt
                        }
                    ],
                }
            ],
        },
        timeout=120,
    )
    response.raise_for_status()
    data = response.json()
    content = data['candidates'][0]['content']['parts'][0]['text']
    return {"ok": True, "model": 'gemini-2.5-flash', "parsed": extract_json_candidate(content), "raw": content}


def safe_call(name: str, fn, prompt: str) -> dict[str, Any]:
    try:
        result = fn(prompt)
        result['provider'] = name
        return result
    except Exception as exc:
        return {"provider": name, "ok": False, "error": str(exc)}


if __name__ == '__main__':
    prompt = PROMPT_PATH.read_text(encoding='utf-8')
    results = {
        'prompt_path': str(PROMPT_PATH),
        'results': [
            safe_call('openai', call_openai, prompt),
            safe_call('grok', call_grok, prompt),
            safe_call('gemini', call_gemini, prompt),
        ],
    }
    OUTPUT_PATH.write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding='utf-8')
    print(str(OUTPUT_PATH))
