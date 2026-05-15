import base64
import json
import mimetypes
import os
from pathlib import Path

import requests

ROOT = Path('/home/ubuntu/complilink_operativo_v1')
PROMPT_PATH = ROOT / 'research' / 'final_ux_simplification_brief_2026-05-15.md'
OUT_PATH = ROOT / 'research' / 'final_ux_simplification_multi_ai_results_2026-05-15.json'
TIMEOUT = 180

IMAGES = {
    'home': ROOT / 'ui-audit' / 'home-mobile-fixed-3.png',
    'acceso': ROOT / 'ui-audit' / 'acceso-mobile-loaded.png',
    'auditar': ROOT / 'ui-audit' / 'auditar-mobile-polish-fixed.png',
    'ceo': ROOT / 'ui-audit' / 'ceo-desktop-polish-fixed.png',
}

SYSTEM = 'Eres un comité senior de UX, producto, operaciones y claridad. Responde únicamente con JSON válido y accionable en español.'


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


def encode_image(path: Path) -> tuple[str, str]:
    mime_type = mimetypes.guess_type(path.name)[0] or 'image/png'
    encoded = base64.b64encode(path.read_bytes()).decode('utf-8')
    return mime_type, encoded


def openai_content(prompt: str):
    content = [{'type': 'text', 'text': prompt}]
    for name, path in IMAGES.items():
        mime, encoded = encode_image(path)
        content.append({'type': 'text', 'text': f'Pantalla: {name}'})
        content.append({'type': 'image_url', 'image_url': {'url': f'data:{mime};base64,{encoded}', 'detail': 'high'}})
    return content


def xai_content(prompt: str):
    content = [{'type': 'text', 'text': prompt}]
    for name, path in IMAGES.items():
        mime, encoded = encode_image(path)
        content.append({'type': 'text', 'text': f'Pantalla: {name}'})
        content.append({'type': 'image_url', 'image_url': {'url': f'data:{mime};base64,{encoded}'}})
    return content


def gemini_parts(prompt: str):
    parts = [{'text': prompt}]
    for name, path in IMAGES.items():
        mime, encoded = encode_image(path)
        parts.append({'text': f'Pantalla: {name}'})
        parts.append({'inline_data': {'mime_type': mime, 'data': encoded}})
    return parts


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
                {'role': 'user', 'content': openai_content(prompt)},
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
                {'role': 'user', 'content': xai_content(prompt)},
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
                    'parts': gemini_parts(prompt),
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
        'images': {name: str(path) for name, path in IMAGES.items()},
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
