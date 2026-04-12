import json
import os
import textwrap
from pathlib import Path

import requests

ROOT = Path('/home/ubuntu/complilink_operativo_v1')
MAP_PATH = ROOT / '.manus-phase1-bridge-map.md'
OUT_PATH = ROOT / '.manus-phase1-multi-ai.json'

SYSTEM_PROMPT = (
    'Eres un arquitecto senior de integraciones backend. '
    'Debes evaluar una fase 1 de integración bidireccional entre AuditaPatrón y CompliLink. '
    'Tu objetivo es detectar vacíos de idempotencia, trazabilidad, consistencia operativa, riesgo de duplicados, '
    'persistencia faltante, y proponer el cambio mínimo pero correcto para endurecer la fase 1. '
    'Responde únicamente JSON válido con las llaves: summary, strengths, risks, recommended_changes, '
    'db_changes_needed, router_changes_needed, webhook_changes_needed, integration_service_changes_needed, '
    'tests_needed, confidence. Cada lista debe contener strings concisos.'
)

USER_PROMPT_TEMPLATE = '''
Analiza el siguiente mapa backend real ya auditado y recomienda el diseño técnico de fase 1.

Contexto:
{context}

Necesito que evalúes específicamente:
1. Si hay un hueco real de idempotencia en el webhook de retorno.
2. Si conviene agregar una tabla o usar un mecanismo existente.
3. Si los dos puntos de salida del router deben consolidarse en una sola rutina.
4. Qué metadatos mínimos deberían persistirse para reintentos, deduplicación y trazabilidad.
5. Qué pruebas automatizadas son indispensables antes de cerrar la fase 1.

Responde solo JSON válido y no incluyas markdown.
'''


def load_context() -> str:
    return MAP_PATH.read_text(encoding='utf-8')


def extract_json_text(content):
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = []
        for item in content:
            if isinstance(item, dict):
                if item.get('type') == 'text' and isinstance(item.get('text'), str):
                    parts.append(item['text'])
                elif 'text' in item and isinstance(item['text'], str):
                    parts.append(item['text'])
        return '\n'.join(parts)
    return json.dumps(content, ensure_ascii=False)


def maybe_parse_json(raw_text: str):
    raw_text = raw_text.strip()
    if raw_text.startswith('```'):
        raw_text = raw_text.split('\n', 1)[1]
        if raw_text.endswith('```'):
            raw_text = raw_text[:-3]
    raw_text = raw_text.strip()
    try:
        return json.loads(raw_text)
    except Exception:
        return {'raw_text': raw_text}


def call_openai(model: str, api_key: str, system_prompt: str, user_prompt: str):
    response = requests.post(
        'https://api.openai.com/v1/chat/completions',
        headers={
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json',
        },
        json={
            'model': model,
            'temperature': 0.2,
            'response_format': {'type': 'json_object'},
            'messages': [
                {'role': 'system', 'content': system_prompt},
                {'role': 'user', 'content': user_prompt},
            ],
        },
        timeout=120,
    )
    response.raise_for_status()
    payload = response.json()
    text = payload['choices'][0]['message']['content']
    return maybe_parse_json(text)


def call_xai(model: str, api_key: str, system_prompt: str, user_prompt: str):
    response = requests.post(
        'https://api.x.ai/v1/chat/completions',
        headers={
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json',
        },
        json={
            'model': model,
            'temperature': 0.2,
            'response_format': {'type': 'json_object'},
            'messages': [
                {'role': 'system', 'content': system_prompt},
                {'role': 'user', 'content': user_prompt},
            ],
        },
        timeout=120,
    )
    response.raise_for_status()
    payload = response.json()
    text = payload['choices'][0]['message']['content']
    return maybe_parse_json(text)


def call_gemini(model: str, api_key: str, system_prompt: str, user_prompt: str):
    response = requests.post(
        f'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}',
        headers={'Content-Type': 'application/json'},
        json={
            'system_instruction': {'parts': [{'text': system_prompt}]},
            'contents': [
                {'role': 'user', 'parts': [{'text': user_prompt}]},
            ],
            'generationConfig': {
                'temperature': 0.2,
                'responseMimeType': 'application/json',
            },
        },
        timeout=120,
    )
    response.raise_for_status()
    payload = response.json()
    text = payload['candidates'][0]['content']['parts'][0]['text']
    return maybe_parse_json(text)


def main():
    context = load_context()
    user_prompt = textwrap.dedent(USER_PROMPT_TEMPLATE.format(context=context)).strip()

    outputs = {}
    errors = {}

    openai_key = os.getenv('OPENAI_API_KEY')
    xai_key = os.getenv('XAI_API_KEY')
    gemini_key = os.getenv('GEMINI_API_KEY')

    if openai_key:
        try:
            outputs['chatgpt'] = call_openai('gpt-4.1', openai_key, SYSTEM_PROMPT, user_prompt)
        except Exception as exc:
            errors['chatgpt'] = str(exc)
    else:
        errors['chatgpt'] = 'OPENAI_API_KEY no disponible'

    if xai_key:
        try:
            outputs['grok'] = call_xai('grok-4', xai_key, SYSTEM_PROMPT, user_prompt)
        except Exception as exc:
            errors['grok'] = str(exc)
    else:
        errors['grok'] = 'XAI_API_KEY no disponible'

    if gemini_key:
        try:
            outputs['gemini'] = call_gemini('gemini-2.5-flash', gemini_key, SYSTEM_PROMPT, user_prompt)
        except Exception as exc:
            errors['gemini'] = str(exc)
    else:
        errors['gemini'] = 'GEMINI_API_KEY no disponible'

    result = {
        'system_prompt': SYSTEM_PROMPT,
        'user_prompt': user_prompt,
        'outputs': outputs,
        'errors': errors,
    }
    OUT_PATH.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
    print(OUT_PATH)


if __name__ == '__main__':
    main()
