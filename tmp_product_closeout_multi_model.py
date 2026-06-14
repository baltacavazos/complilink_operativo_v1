import json
import os
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

import requests

BASE_DIR = Path('/home/ubuntu/complilink_operativo_v1')
CONTEXT_PATH = BASE_DIR / 'product_closeout_multi_ai_context_2026-06-14.md'
OUTPUT_PATH = BASE_DIR / 'tmp_product_closeout_multi_model_output.json'

CONTEXT = CONTEXT_PATH.read_text(encoding='utf-8')

SCHEMA = {
    'name': 'product_closeout',
    'schema': {
        'type': 'object',
        'properties': {
            'model': {'type': 'string'},
            'global_finish_score': {'type': 'number'},
            'conversion_score': {'type': 'number'},
            'trust_score': {'type': 'number'},
            'premium_feel_score': {'type': 'number'},
            'top_5_changes': {'type': 'array', 'items': {'type': 'string'}, 'minItems': 5, 'maxItems': 5},
            'home_keep': {'type': 'array', 'items': {'type': 'string'}},
            'home_cut_or_merge': {'type': 'array', 'items': {'type': 'string'}},
            'home_new_hierarchy': {'type': 'array', 'items': {'type': 'string'}},
            'home_copy_upgrades': {'type': 'array', 'items': {'type': 'string'}},
            'trust_mechanisms': {'type': 'array', 'items': {'type': 'string'}},
            'access_upgrades': {'type': 'array', 'items': {'type': 'string'}},
            'auditar_upgrades': {'type': 'array', 'items': {'type': 'string'}},
            'must_fix_now': {'type': 'array', 'items': {'type': 'string'}},
            'must_preserve': {'type': 'array', 'items': {'type': 'string'}},
            'north_star': {'type': 'string'},
            'confidence': {'type': 'string'},
        },
        'required': [
            'model', 'global_finish_score', 'conversion_score', 'trust_score', 'premium_feel_score',
            'top_5_changes', 'home_keep', 'home_cut_or_merge', 'home_new_hierarchy', 'home_copy_upgrades',
            'trust_mechanisms', 'access_upgrades', 'auditar_upgrades', 'must_fix_now', 'must_preserve',
            'north_star', 'confidence'
        ],
        'additionalProperties': False,
    }
}

SYSTEM_PROMPT = (
    'Eres un director de producto, diseño y conversión obsesionado con cerrar la distancia entre un producto útil '
    'y un producto irresistible. Debes proponer una ronda ejecutable de cierre total para una plataforma real, '
    'sin reescritura completa, sin vaguedades y sin prueba social falsa. Debes responder solo con JSON válido.'
)

USER_PROMPT = (
    'Analiza este dossier y devuelve exclusivamente un objeto JSON que cumpla el esquema pedido. Prioriza cambios '
    'de alto impacto y máxima ejecutabilidad para que el producto se sienta terminado, confiable, premium y fácil de comprar.\n\n'
    + CONTEXT
)


def extract_text_from_openai_style(payload: dict) -> str:
    return payload['choices'][0]['message']['content']


def call_openai() -> dict:
    response = requests.post(
        'https://api.openai.com/v1/chat/completions',
        headers={
            'Authorization': f"Bearer {os.environ['OPENAI_API_KEY']}",
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
    data = json.loads(extract_text_from_openai_style(response.json()))
    data['source_api'] = 'openai'
    return data


def call_grok() -> dict:
    response = requests.post(
        'https://api.x.ai/v1/chat/completions',
        headers={
            'Authorization': f"Bearer {os.environ['XAI_API_KEY']}",
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
    data = json.loads(extract_text_from_openai_style(response.json()))
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
            'generationConfig': {
                'temperature': 0.2,
                'responseMimeType': 'application/json',
            },
        },
        timeout=180,
    )
    response.raise_for_status()
    data = json.loads(response.json()['candidates'][0]['content']['parts'][0]['text'])
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
        future_map = {executor.submit(fn): name for name, fn in jobs.items()}
        for future in as_completed(future_map):
            name = future_map[future]
            try:
                results[name] = future.result()
            except Exception as exc:
                errors[name] = {'error': str(exc)}

    OUTPUT_PATH.write_text(
        json.dumps({'context_file': str(CONTEXT_PATH), 'results': results, 'errors': errors}, ensure_ascii=False, indent=2),
        encoding='utf-8',
    )
    print(str(OUTPUT_PATH))
    print(json.dumps({'completed': list(results.keys()), 'errors': errors}, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
