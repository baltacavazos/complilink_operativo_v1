import json
import os
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

import requests

BASE_DIR = Path('/home/ubuntu/complilink_operativo_v1')
CONTEXT_PATH = BASE_DIR / 'product_extreme_closeout_multi_ai_context_2026-06-14.md'
OUTPUT_PATH = BASE_DIR / 'tmp_product_extreme_closeout_multi_model_output.json'
CONTEXT = CONTEXT_PATH.read_text(encoding='utf-8')

SCHEMA = {
    'name': 'extreme_closeout_review',
    'schema': {
        'type': 'object',
        'properties': {
            'model': {'type': 'string'},
            'strict_score_now': {'type': 'number'},
            'trust_score_now': {'type': 'number'},
            'verdict': {'type': 'string'},
            'ship_now_strict': {'type': 'boolean'},
            'highest_leverage_changes': {
                'type': 'array',
                'items': {
                    'type': 'object',
                    'properties': {
                        'surface': {'type': 'string'},
                        'change': {'type': 'string'},
                        'why_it_matters': {'type': 'string'},
                        'impact': {'type': 'string', 'enum': ['high', 'medium', 'low']},
                        'effort': {'type': 'string', 'enum': ['high', 'medium', 'low']},
                    },
                    'required': ['surface', 'change', 'why_it_matters', 'impact', 'effort'],
                    'additionalProperties': False,
                },
                'minItems': 1,
                'maxItems': 3,
            },
            'single_best_move': {'type': 'string'},
            'confidence': {'type': 'string'},
        },
        'required': [
            'model', 'strict_score_now', 'trust_score_now', 'verdict', 'ship_now_strict',
            'highest_leverage_changes', 'single_best_move', 'confidence'
        ],
        'additionalProperties': False,
    },
}

SYSTEM_PROMPT = (
    'Eres un director de producto obsesivo y extremadamente estricto. Evalúas cierres finales con foco en confianza, '
    'claridad comercial y sensación de producto terminado. Responde solo con JSON válido y prioriza cambios pequeños o medianos '
    'de altísimo retorno.'
)
USER_PROMPT = 'Analiza el siguiente contexto y responde exclusivamente con el JSON solicitado.\n\n' + CONTEXT


def parse_chat_payload(payload: dict) -> str:
    return payload['choices'][0]['message']['content']


def call_openai() -> dict:
    response = requests.post(
        'https://api.openai.com/v1/chat/completions',
        headers={'Authorization': f"Bearer {os.environ['OPENAI_API_KEY']}", 'Content-Type': 'application/json'},
        json={
            'model': 'gpt-4.1',
            'temperature': 0.2,
            'messages': [
                {'role': 'system', 'content': SYSTEM_PROMPT},
                {'role': 'user', 'content': USER_PROMPT},
            ],
            'response_format': {
                'type': 'json_schema',
                'json_schema': {'name': SCHEMA['name'], 'strict': True, 'schema': SCHEMA['schema']},
            },
        },
        timeout=180,
    )
    response.raise_for_status()
    data = json.loads(parse_chat_payload(response.json()))
    data['source_api'] = 'openai'
    return data


def call_grok() -> dict:
    response = requests.post(
        'https://api.x.ai/v1/chat/completions',
        headers={'Authorization': f"Bearer {os.environ['XAI_API_KEY']}", 'Content-Type': 'application/json'},
        json={
            'model': 'grok-4',
            'temperature': 0.2,
            'messages': [
                {'role': 'system', 'content': SYSTEM_PROMPT},
                {'role': 'user', 'content': USER_PROMPT},
            ],
            'response_format': {
                'type': 'json_schema',
                'json_schema': {'name': SCHEMA['name'], 'strict': True, 'schema': SCHEMA['schema']},
            },
        },
        timeout=180,
    )
    response.raise_for_status()
    data = json.loads(parse_chat_payload(response.json()))
    data['source_api'] = 'xai'
    return data


def call_gemini() -> dict:
    response = requests.post(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
        params={'key': os.environ['GEMINI_API_KEY']},
        headers={'Content-Type': 'application/json'},
        json={
            'systemInstruction': {'parts': [{'text': SYSTEM_PROMPT}]},
            'contents': [{'role': 'user', 'parts': [{'text': USER_PROMPT}]}],
            'generationConfig': {'temperature': 0.2, 'responseMimeType': 'application/json'},
        },
        timeout=180,
    )
    response.raise_for_status()
    data = json.loads(response.json()['candidates'][0]['content']['parts'][0]['text'])
    data['source_api'] = 'gemini'
    return data


def main() -> None:
    jobs = {'chatgpt': call_openai, 'grok': call_grok, 'gemini': call_gemini}
    results = {}
    errors = {}
    with ThreadPoolExecutor(max_workers=3) as executor:
        future_map = {executor.submit(fn): name for name, fn in jobs.items()}
        for future in as_completed(future_map):
            name = future_map[future]
            try:
                results[name] = future.result()
            except Exception as exc:
                errors[name] = {'error': str(exc)}

    OUTPUT_PATH.write_text(json.dumps({'context_file': str(CONTEXT_PATH), 'results': results, 'errors': errors}, ensure_ascii=False, indent=2), encoding='utf-8')
    print(str(OUTPUT_PATH))
    print(json.dumps({'completed': list(results.keys()), 'errors': errors}, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
