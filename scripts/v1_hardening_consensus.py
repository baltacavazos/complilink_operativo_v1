#!/usr/bin/env python3
import json
import os
import re
import time
from pathlib import Path

import requests
from requests import HTTPError

BASE = Path('/home/ubuntu/complilink_operativo_v1')
CONTEXT_PATH = BASE / '.manus-ai' / 'v1_hardening_context.md'
OUT_DIR = BASE / '.manus-ai'
OUT_DIR.mkdir(parents=True, exist_ok=True)

PROMPT = CONTEXT_PATH.read_text(encoding='utf-8')
SYSTEM = (
    'Eres un arquitecto principal de software y producto. '
    'Debes priorizar una V1 pilotable con foco en seguridad, operación, pruebas e integración. '
    'Devuelve únicamente JSON válido, sin markdown ni texto adicional.'
)


def extract_json(text: str):
    text = text.strip()
    if not text:
        raise ValueError('Respuesta vacía')
    try:
        return json.loads(text)
    except Exception:
        pass

    fenced = re.search(r'```json\s*(\{.*\})\s*```', text, re.S)
    if fenced:
        return json.loads(fenced.group(1))

    start = text.find('{')
    end = text.rfind('}')
    if start != -1 and end != -1 and end > start:
        return json.loads(text[start:end+1])
    raise ValueError(f'No se pudo extraer JSON de: {text[:400]}')


def save(name: str, payload):
    path = OUT_DIR / name
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding='utf-8')
    return str(path)


def call_openai():
    api_key = os.environ.get('OPENAI_API_KEY')
    if not api_key:
        raise RuntimeError('OPENAI_API_KEY no disponible')
    url = 'https://api.openai.com/v1/chat/completions'
    body = {
        'model': 'gpt-4.1-mini',
        'temperature': 0.2,
        'messages': [
            {'role': 'system', 'content': SYSTEM},
            {'role': 'user', 'content': PROMPT},
        ],
        'response_format': {'type': 'json_object'},
    }
    response = requests.post(
        url,
        headers={'Authorization': f'Bearer {api_key}', 'Content-Type': 'application/json'},
        json=body,
        timeout=180,
    )
    response.raise_for_status()
    data = response.json()
    content = data['choices'][0]['message']['content']
    parsed = extract_json(content)
    save('v1_priority_openai_raw.json', data)
    save('v1_priority_openai.json', parsed)
    return parsed


def post_with_retries(url, headers, body, timeout=180, attempts=4, retry_statuses=None):
    retry_statuses = retry_statuses or {429, 500, 502, 503, 504}
    last_error = None
    for attempt in range(1, attempts + 1):
        try:
            response = requests.post(url, headers=headers, json=body, timeout=timeout)
            if response.status_code in retry_statuses and attempt < attempts:
                time.sleep(min(20, 3 * attempt))
                continue
            response.raise_for_status()
            return response
        except Exception as exc:
            last_error = exc
            status_code = None
            if isinstance(exc, HTTPError) and exc.response is not None:
                status_code = exc.response.status_code
            if attempt >= attempts or (status_code is not None and status_code not in retry_statuses):
                raise
            time.sleep(min(20, 3 * attempt))
    if last_error:
        raise last_error
    raise RuntimeError('Fallo inesperado en post_with_retries')


def call_xai():
    api_key = os.environ.get('XAI_API_KEY')
    if not api_key:
        raise RuntimeError('XAI_API_KEY no disponible')
    url = 'https://api.x.ai/v1/chat/completions'
    candidate_models = ['grok-4', 'grok-3-mini-beta', 'grok-3-mini']
    last_error = None
    for model in candidate_models:
        try:
            body = {
                'model': model,
                'temperature': 0.2,
                'messages': [
                    {'role': 'system', 'content': SYSTEM},
                    {'role': 'user', 'content': PROMPT},
                ],
                'response_format': {'type': 'json_object'},
            }
            response = post_with_retries(
                url,
                headers={'Authorization': f'Bearer {api_key}', 'Content-Type': 'application/json'},
                body=body,
                timeout=180,
                attempts=4,
            )
            data = response.json()
            content = data['choices'][0]['message']['content']
            parsed = extract_json(content)
            save('v1_priority_grok_raw.json', {'model': model, 'response': data})
            save('v1_priority_grok.json', parsed)
            return parsed
        except Exception as exc:
            last_error = exc
            save('v1_priority_grok_last_attempt.json', {'model': model, 'error': str(exc)})
    raise last_error


def call_gemini():
    api_key = os.environ.get('GEMINI_API_KEY')
    if not api_key:
        raise RuntimeError('GEMINI_API_KEY no disponible')
    schema = {
        'type': 'OBJECT',
        'properties': {
            'top_priorities': {
                'type': 'ARRAY',
                'items': {
                    'type': 'OBJECT',
                    'properties': {
                        'rank': {'type': 'INTEGER'},
                        'name': {'type': 'STRING'},
                        'why_now': {'type': 'STRING'},
                        'scope': {'type': 'ARRAY', 'items': {'type': 'STRING'}},
                        'dependencies': {'type': 'ARRAY', 'items': {'type': 'STRING'}},
                        'risk_if_skipped': {'type': 'STRING'},
                        'pilot_impact': {'type': 'STRING'},
                    },
                    'required': ['rank', 'name', 'why_now', 'scope', 'dependencies', 'risk_if_skipped', 'pilot_impact'],
                },
            },
            'recommended_next_block': {
                'type': 'OBJECT',
                'properties': {
                    'name': {'type': 'STRING'},
                    'why': {'type': 'STRING'},
                    'deliverables': {'type': 'ARRAY', 'items': {'type': 'STRING'}},
                    'tests': {'type': 'ARRAY', 'items': {'type': 'STRING'}},
                    'not_now': {'type': 'ARRAY', 'items': {'type': 'STRING'}},
                },
                'required': ['name', 'why', 'deliverables', 'tests', 'not_now'],
            },
            'mobile_transition': {
                'type': 'OBJECT',
                'properties': {
                    'recommendation': {'type': 'STRING'},
                    'rationale': {'type': 'STRING'},
                    'prerequisites': {'type': 'ARRAY', 'items': {'type': 'STRING'}},
                    'anti_patterns': {'type': 'ARRAY', 'items': {'type': 'STRING'}},
                },
                'required': ['recommendation', 'rationale', 'prerequisites', 'anti_patterns'],
            },
            'v1_exit_criteria': {'type': 'ARRAY', 'items': {'type': 'STRING'}},
            'warnings': {'type': 'ARRAY', 'items': {'type': 'STRING'}},
        },
        'required': ['top_priorities', 'recommended_next_block', 'mobile_transition', 'v1_exit_criteria', 'warnings'],
    }
    body = {
        'system_instruction': {'parts': [{'text': SYSTEM}]},
        'contents': [{'parts': [{'text': PROMPT}]}],
        'generationConfig': {
            'temperature': 0.2,
            'responseMimeType': 'application/json',
            'responseSchema': schema,
        },
    }
    candidate_models = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash']
    last_error = None
    for model in candidate_models:
        try:
            url = f'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}'
            response = post_with_retries(
                url,
                headers={'Content-Type': 'application/json'},
                body=body,
                timeout=180,
                attempts=4,
            )
            data = response.json()
            text = data['candidates'][0]['content']['parts'][0]['text']
            parsed = extract_json(text)
            save('v1_priority_gemini_raw.json', {'model': model, 'response': data})
            save('v1_priority_gemini.json', parsed)
            return parsed
        except Exception as exc:
            last_error = exc
            save('v1_priority_gemini_last_attempt.json', {'model': model, 'error': str(exc)})
    raise last_error


def classify_priority(item):
    text = ' '.join([
        str(item.get('name', '')),
        str(item.get('why_now', '')),
        ' '.join(item.get('scope', []) if isinstance(item.get('scope'), list) else []),
    ]).lower()
    if any(k in text for k in ['hash', 'audit', 'rbac', 'access', 'trace', 'validacion', 'validation', 'security', 'seguridad']):
        return 'security_traceability'
    if any(k in text for k in ['alert', 'backup', 'monitor', 'bitácora', 'bitacora', 'operat', 'resilien', 'recovery']):
        return 'ops_resilience'
    if any(k in text for k in ['test', 'qa', 'pilot', 'prueba']):
        return 'testing_pilot'
    if any(k in text for k in ['integrat', 'webhook', 'helios', 'complilink', 'auditapatron']):
        return 'integration_stabilization'
    if any(k in text for k in ['simplif', 'ux', 'experience', 'flujo', 'autoexplicativo', 'onboarding']):
        return 'ux_simplification'
    if any(k in text for k in ['mobile', 'android', 'ios', 'react native', 'capacitor']):
        return 'mobile_foundation'
    return 'other'


def build_consensus(results):
    category_scores = {}
    per_model_top = {}
    next_blocks = {}
    mobile = {}
    exits = {}
    warnings = {}

    for model_name, payload in results.items():
        top = payload.get('top_priorities', [])[:5]
        per_model_top[model_name] = top
        for item in top:
            category = classify_priority(item)
            score = 6 - int(item.get('rank', 5))
            category_scores[category] = category_scores.get(category, 0) + score
        next_blocks[model_name] = payload.get('recommended_next_block', {})
        mobile[model_name] = payload.get('mobile_transition', {})
        exits[model_name] = payload.get('v1_exit_criteria', [])
        warnings[model_name] = payload.get('warnings', [])

    ranked_categories = sorted(category_scores.items(), key=lambda x: (-x[1], x[0]))
    consensus = {
        'generated_at': int(time.time()),
        'ranked_priority_categories': [
            {'category': category, 'score': score}
            for category, score in ranked_categories
        ],
        'per_model_top_priorities': per_model_top,
        'recommended_next_blocks': next_blocks,
        'mobile_transition': mobile,
        'v1_exit_criteria': exits,
        'warnings': warnings,
    }
    save('v1_priority_consensus_summary.json', consensus)
    return consensus


def main():
    results = {}
    errors = {}
    for name, fn in [('openai', call_openai), ('grok', call_xai), ('gemini', call_gemini)]:
        try:
            results[name] = fn()
        except Exception as exc:
            errors[name] = str(exc)
            save(f'v1_priority_{name}_error.json', {'error': str(exc)})

    summary = build_consensus(results) if results else {'error': 'No se obtuvo ninguna respuesta útil'}
    final = {
        'results_obtained': list(results.keys()),
        'errors': errors,
        'consensus_summary_path': str(OUT_DIR / 'v1_priority_consensus_summary.json'),
        'summary': summary,
    }
    print(json.dumps(final, ensure_ascii=False, indent=2))
    save('v1_priority_run_summary.json', final)


if __name__ == '__main__':
    main()
