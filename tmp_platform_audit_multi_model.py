import json
import os
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

import requests

BASE_DIR = Path('/home/ubuntu/complilink_operativo_v1')
CONTEXT_PATH = BASE_DIR / 'platform_audit_multi_ai_context_2026-06-14.md'
OUTPUT_PATH = BASE_DIR / 'tmp_platform_audit_multi_model_output.json'

with open(CONTEXT_PATH, 'r', encoding='utf-8') as f:
    CONTEXT = f.read()

SCHEMA = {
    'name': 'platform_audit',
    'schema': {
        'type': 'object',
        'properties': {
            'model': {'type': 'string'},
            'global_score': {'type': 'number'},
            'dimension_scores': {
                'type': 'object',
                'properties': {
                    'ux': {'type': 'number'},
                    'copy': {'type': 'number'},
                    'frontend_architecture': {'type': 'number'},
                    'visual_consistency': {'type': 'number'},
                    'human_feeling': {'type': 'number'},
                },
                'required': ['ux', 'copy', 'frontend_architecture', 'visual_consistency', 'human_feeling'],
                'additionalProperties': False,
            },
            'strengths': {'type': 'array', 'items': {'type': 'string'}},
            'live_coded_signals': {'type': 'array', 'items': {'type': 'string'}},
            'repetition_signals': {'type': 'array', 'items': {'type': 'string'}},
            'visual_consistency_findings': {'type': 'array', 'items': {'type': 'string'}},
            'frontend_architecture_findings': {'type': 'array', 'items': {'type': 'string'}},
            'top_3_changes': {'type': 'array', 'items': {'type': 'string'}, 'minItems': 3, 'maxItems': 3},
            'what_to_preserve': {'type': 'array', 'items': {'type': 'string'}},
            'path_to_nine': {'type': 'string'},
            'confidence': {'type': 'string'},
            'notable_quotes': {'type': 'array', 'items': {'type': 'string'}},
        },
        'required': [
            'model',
            'global_score',
            'dimension_scores',
            'strengths',
            'live_coded_signals',
            'repetition_signals',
            'visual_consistency_findings',
            'frontend_architecture_findings',
            'top_3_changes',
            'what_to_preserve',
            'path_to_nine',
            'confidence',
            'notable_quotes',
        ],
        'additionalProperties': False,
    },
}

SYSTEM_PROMPT = (
    'Eres un director crítico de producto y diseño con criterio senior en UX writing, arquitectura frontend '
    'y percepción de software premium. Debes auditar una plataforma real con mirada independiente. '
    'Tu misión es detectar exactamente qué se siente live coded, repetitivo, ensamblado o poco humano, '
    'sin caer en vaguedades. Debes ser específico, accionable y justo: reconoce lo que ya funciona y '
    'prioriza cambios de alto impacto sin pedir reescritura total salvo que sea estrictamente necesario. '
    'Debes responder únicamente con JSON válido que cumpla el esquema solicitado.'
)

USER_PROMPT = (
    'Analiza el siguiente dossier de auditoría de plataforma y responde estrictamente con un objeto JSON '\
    'que siga el esquema provisto. Evalúa UX, copy, arquitectura frontend, consistencia visual y feeling humano. '\
    'Señala qué se siente live coded, qué se repite, qué preservarías y qué tres cambios harías primero para llevar '\
    'el producto hacia 9/10.\n\n' + CONTEXT
)


def extract_openai_text(payload: dict) -> str:
    return payload['choices'][0]['message']['content']


def call_openai() -> dict:
    api_key = os.environ['OPENAI_API_KEY']
    response = requests.post(
        'https://api.openai.com/v1/chat/completions',
        headers={
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json',
        },
        json={
            'model': 'gpt-4.1',
            'temperature': 0.2,
            'messages': [
                {'role': 'system', 'content': SYSTEM_PROMPT},
                {'role': 'user', 'content': USER_PROMPT},
            ],
            'response_format': {
                'type': 'json_schema',
                'json_schema': {
                    'name': SCHEMA['name'],
                    'strict': True,
                    'schema': SCHEMA['schema'],
                },
            },
        },
        timeout=180,
    )
    response.raise_for_status()
    data = json.loads(extract_openai_text(response.json()))
    data['source_api'] = 'openai'
    return data


def call_grok() -> dict:
    api_key = os.environ['XAI_API_KEY']
    response = requests.post(
        'https://api.x.ai/v1/chat/completions',
        headers={
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json',
        },
        json={
            'model': 'grok-4',
            'temperature': 0.2,
            'messages': [
                {'role': 'system', 'content': SYSTEM_PROMPT},
                {'role': 'user', 'content': USER_PROMPT},
            ],
            'response_format': {
                'type': 'json_schema',
                'json_schema': {
                    'name': SCHEMA['name'],
                    'strict': True,
                    'schema': SCHEMA['schema'],
                },
            },
        },
        timeout=180,
    )
    response.raise_for_status()
    data = json.loads(extract_openai_text(response.json()))
    data['source_api'] = 'xai'
    return data


def extract_gemini_text(payload: dict) -> str:
    return payload['candidates'][0]['content']['parts'][0]['text']


def call_gemini() -> dict:
    api_key = os.environ['GEMINI_API_KEY']
    url = (
        'https://generativelanguage.googleapis.com/v1beta/models/'
        'gemini-2.5-flash:generateContent'
    )
    response = requests.post(
        url,
        params={'key': api_key},
        headers={'Content-Type': 'application/json'},
        json={
            'systemInstruction': {
                'parts': [{'text': SYSTEM_PROMPT}]
            },
            'contents': [
                {
                    'role': 'user',
                    'parts': [{'text': USER_PROMPT}],
                }
            ],
            'generationConfig': {
                'temperature': 0.2,
                'responseMimeType': 'application/json',
                'responseSchema': SCHEMA['schema'],
            },
        },
        timeout=180,
    )
    response.raise_for_status()
    data = json.loads(extract_gemini_text(response.json()))
    data['source_api'] = 'gemini'
    return data


def main() -> None:
    jobs = {
        'chatgpt': call_openai,
        'grok': call_grok,
        'gemini': call_gemini,
    }
    results = {}
    errors = {}

    with ThreadPoolExecutor(max_workers=3) as executor:
        future_map = {executor.submit(func): name for name, func in jobs.items()}
        for future in as_completed(future_map):
            name = future_map[future]
            try:
                results[name] = future.result()
            except Exception as exc:
                errors[name] = {'error': str(exc)}

    output = {
        'context_file': str(CONTEXT_PATH),
        'results': results,
        'errors': errors,
    }
    with open(OUTPUT_PATH, 'w', encoding='utf-8') as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print(str(OUTPUT_PATH))
    print(json.dumps({'completed': list(results.keys()), 'errors': errors}, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
