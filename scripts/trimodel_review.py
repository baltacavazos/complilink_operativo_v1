from __future__ import annotations

import json
import os
import re
from pathlib import Path
from typing import Any

import requests
from google import genai

ROOT = Path('/home/ubuntu/complilink_operativo_v1')
CONTEXT_PATH = ROOT / '.manus-trimodel-context.md'
OUTPUT_DIR = ROOT / '.manus-trimodel-output'
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

SYSTEM_PROMPT = (
    'Eres un arquitecto de producto y analista técnico senior. '\
    'Debes recomendar el alcance mínimo útil para una ronda de implementación web ya avanzada. '\
    'Responde SOLO JSON válido y sin texto adicional.'
)

USER_PROMPT_TEMPLATE = '''
Analiza el siguiente contexto y responde con JSON estricto con esta forma exacta:
{{
  "implementation_priority": ["string", "string", "string"],
  "minimal_changes": {{
    "telemetry": ["string"],
    "testing": ["string"],
    "ceo_console": ["string"]
  }},
  "critical_kpis": ["string"],
  "avoid_overbuilding": ["string"],
  "must_have_tests": ["string"],
  "top_risks": ["string"],
  "recommended_sequence_rationale": "string"
}}

Contexto:
{context}
'''


def load_context() -> str:
    return CONTEXT_PATH.read_text(encoding='utf-8')


def extract_json(text: str) -> Any:
    text = text.strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    match = re.search(r'\{.*\}', text, re.S)
    if not match:
        raise ValueError('No se encontró JSON válido en la respuesta')
    return json.loads(match.group(0))


def post_json(url: str, headers: dict[str, str], payload: dict[str, Any]) -> dict[str, Any]:
    response = requests.post(url, headers=headers, json=payload, timeout=120)
    response.raise_for_status()
    return response.json()


def call_openai(context: str) -> dict[str, Any]:
    api_key = os.environ['OPENAI_API_KEY']
    url = 'https://api.openai.com/v1/chat/completions'
    models = ['gpt-4.1-mini', 'gpt-4o-mini', 'gpt-4.1']
    last_error = None
    for model in models:
        try:
            payload = {
                'model': model,
                'temperature': 0.2,
                'messages': [
                    {'role': 'system', 'content': SYSTEM_PROMPT},
                    {'role': 'user', 'content': USER_PROMPT_TEMPLATE.format(context=context)},
                ],
                'response_format': {'type': 'json_object'},
            }
            data = post_json(url, {'Authorization': f'Bearer {api_key}', 'Content-Type': 'application/json'}, payload)
            text = data['choices'][0]['message']['content']
            parsed = extract_json(text)
            return {'provider': 'openai', 'model': model, 'raw': data, 'parsed': parsed}
        except Exception as exc:
            last_error = f'{type(exc).__name__}: {exc}'
    raise RuntimeError(f'OpenAI falló con todos los modelos probados: {last_error}')


def call_xai(context: str) -> dict[str, Any]:
    api_key = os.environ['XAI_API_KEY']
    url = 'https://api.x.ai/v1/chat/completions'
    models = ['grok-4', 'grok-3-mini', 'grok-3-beta']
    last_error = None
    for model in models:
        try:
            payload = {
                'model': model,
                'temperature': 0.2,
                'messages': [
                    {'role': 'system', 'content': SYSTEM_PROMPT},
                    {'role': 'user', 'content': USER_PROMPT_TEMPLATE.format(context=context)},
                ],
                'response_format': {'type': 'json_object'},
            }
            data = post_json(url, {'Authorization': f'Bearer {api_key}', 'Content-Type': 'application/json'}, payload)
            text = data['choices'][0]['message']['content']
            parsed = extract_json(text)
            return {'provider': 'xai', 'model': model, 'raw': data, 'parsed': parsed}
        except Exception as exc:
            last_error = f'{type(exc).__name__}: {exc}'
    raise RuntimeError(f'xAI falló con todos los modelos probados: {last_error}')


def call_gemini(context: str) -> dict[str, Any]:
    api_key = os.environ['GEMINI_API_KEY']
    models = ['gemini-flash-latest', 'gemini-2.5-flash-lite', 'gemini-pro-latest']
    last_error = None
    prompt = USER_PROMPT_TEMPLATE.format(context=context)

    for model in models:
        try:
            url = f'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent'
            payload = {
                'systemInstruction': {
                    'parts': [{'text': SYSTEM_PROMPT}]
                },
                'contents': [
                    {
                        'role': 'user',
                        'parts': [{'text': prompt}],
                    }
                ],
                'generationConfig': {
                    'temperature': 0.2,
                    'responseMimeType': 'application/json',
                },
            }
            data = post_json(url, {'Content-Type': 'application/json', 'x-goog-api-key': api_key}, payload)
            text = data['candidates'][0]['content']['parts'][0]['text']
            parsed = extract_json(text)
            return {'provider': 'gemini', 'model': model, 'raw': data, 'parsed': parsed, 'transport': 'rest'}
        except Exception as exc:
            last_error = f'REST {model}: {type(exc).__name__}: {exc}'

    client = genai.Client(api_key=api_key)
    for model in models:
        try:
            response = client.models.generate_content(
                model=model,
                contents=prompt,
                config={
                    'temperature': 0.2,
                    'response_mime_type': 'application/json',
                    'system_instruction': SYSTEM_PROMPT,
                },
            )
            text = response.text or ''
            parsed = extract_json(text)
            return {
                'provider': 'gemini',
                'model': model,
                'raw': response.model_dump(mode='json'),
                'parsed': parsed,
                'transport': 'sdk',
            }
        except Exception as exc:
            last_error = f'SDK {model}: {type(exc).__name__}: {exc}'

    raise RuntimeError(f'Gemini falló con todos los modelos probados: {last_error}')


def write_json(path: Path, value: Any) -> None:
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def main() -> None:
    context = load_context()
    results: dict[str, Any] = {}
    errors: dict[str, str] = {}

    for name, fn in [('openai', call_openai), ('xai', call_xai), ('gemini', call_gemini)]:
        try:
            result = fn(context)
            results[name] = result
            write_json(OUTPUT_DIR / f'{name}.json', result)
        except Exception as exc:
            errors[name] = f'{type(exc).__name__}: {exc}'

    summary = {
        'completed': list(results.keys()),
        'failed': errors,
    }
    write_json(OUTPUT_DIR / 'summary.json', summary)

    if not results:
        raise SystemExit('Ningún proveedor respondió correctamente')

    print(json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
