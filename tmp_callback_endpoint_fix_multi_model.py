import json
import os
from pathlib import Path

import requests

PROJECT = Path('/home/ubuntu/complilink_operativo_v1')
OUT = PROJECT / 'tmp_callback_endpoint_fix_multi_model_output.json'

context = {
    'observed_facts': {
        'configured_webhook_url': 'https://auditapatron.com/api/auditapatron/webhook',
        'initial_intake_route': '/api/auditapatron/webhook',
        'final_return_route': '/api/auditapatron/complilink-webhook',
        'aliases_for_final_return': ['/api/internal/helios/bridge', '/api/integrations/auditapatron/bridge'],
        'runtime_evidence': 'Los dispatches del bridge regresan HTTP 202 y queda correlationId auditado, pero webhookEvents permanece vacío en las corridas controladas.',
        'final_handler_behavior': 'Solo handleCompliLinkReturnWebhook inserta compliLinkWebhookEvents, actualiza documentos y agrega eventos finales al caso.',
        'initial_handler_behavior': 'handleAuditaPatronIncomingWebhook solo valida el evento document.uploaded y responde accepted.'
    },
    'goal': 'Confirmar si la causa más probable del callback faltante es un endpoint mal configurado y cuál es la corrección mínima y más segura.',
    'constraints': {
        'must_be_minimal': True,
        'must_preserve_existing_dispatch_flow': True,
        'must_be_validated_after_change': True,
        'project_type': 'Node web app with env-managed configuration',
    },
}

schema = {
    'root_cause_assessment': {
        'most_likely_root_cause': 'string',
        'confidence': 'high|medium|low',
        'why': ['string'],
    },
    'recommended_fix': {
        'change_type': 'config_only|code_and_config|code_only',
        'target_url': 'string',
        'need_backward_compatibility': True,
        'why': ['string'],
    },
    'validation_plan': {
        'checks': ['string'],
        'expected_success_signal': ['string'],
        'rollback_condition': ['string'],
    },
    'risks': ['string'],
    'one_sentence_verdict': 'string',
}

prompt = (
    'Eres un arquitecto senior de integraciones backend. Analiza un problema de webhook asíncrono. '
    'Debes responder solo JSON válido siguiendo este esquema: ' + json.dumps(schema, ensure_ascii=False) + '. '
    'Contexto factual: ' + json.dumps(context, ensure_ascii=False)
)


def call_openai(prompt: str) -> dict:
    api_key = os.environ.get('OPENAI_API_KEY')
    if not api_key:
        return {'error': 'OPENAI_API_KEY missing'}
    headers = {'Authorization': f'Bearer {api_key}', 'Content-Type': 'application/json'}
    payload = {
        'model': 'gpt-4.1-mini',
        'temperature': 0.1,
        'response_format': {'type': 'json_object'},
        'messages': [
            {'role': 'system', 'content': 'Devuelve únicamente JSON válido. Prioriza diagnóstico causal y corrección mínima segura.'},
            {'role': 'user', 'content': prompt},
        ],
    }
    response = requests.post('https://api.openai.com/v1/chat/completions', headers=headers, json=payload, timeout=120)
    return {'status_code': response.status_code, 'body': response.json()}


def call_grok(prompt: str) -> dict:
    api_key = os.environ.get('XAI_API_KEY')
    if not api_key:
        return {'error': 'XAI_API_KEY missing'}
    headers = {'Authorization': f'Bearer {api_key}', 'Content-Type': 'application/json'}
    payload = {
        'model': 'grok-4',
        'temperature': 0.1,
        'response_format': {'type': 'json_object'},
        'messages': [
            {'role': 'system', 'content': 'Devuelve únicamente JSON válido. Prioriza diagnóstico causal y corrección mínima segura.'},
            {'role': 'user', 'content': prompt},
        ],
    }
    response = requests.post('https://api.x.ai/v1/chat/completions', headers=headers, json=payload, timeout=120)
    return {'status_code': response.status_code, 'body': response.json()}


def call_gemini(prompt: str) -> dict:
    api_key = os.environ.get('GEMINI_API_KEY')
    if not api_key:
        return {'error': 'GEMINI_API_KEY missing'}
    url = f'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}'
    payload = {
        'contents': [{'parts': [{'text': prompt}]}],
        'generationConfig': {'temperature': 0.1, 'responseMimeType': 'application/json'},
    }
    response = requests.post(url, json=payload, timeout=120)
    return {'status_code': response.status_code, 'body': response.json()}


def extract_text(result: dict, vendor: str):
    try:
        if vendor == 'openai':
            return result['body']['choices'][0]['message']['content']
        if vendor == 'grok':
            return result['body']['choices'][0]['message']['content']
        if vendor == 'gemini':
            return result['body']['candidates'][0]['content']['parts'][0]['text']
    except Exception as exc:
        return f'__parse_error__: {exc}'


def try_json(text: str):
    try:
        return json.loads(text)
    except Exception:
        return {'raw': text}


raw = {
    'context': context,
    'prompt': prompt,
    'responses': {
        'chatgpt': call_openai(prompt),
        'grok': call_grok(prompt),
        'gemini': call_gemini(prompt),
    },
}
parsed = {}
for key, vendor in [('chatgpt', 'openai'), ('grok', 'grok'), ('gemini', 'gemini')]:
    response = raw['responses'][key]
    if 'error' in response:
        parsed[key] = response
        continue
    text = extract_text(response, vendor)
    parsed[key] = {'text': text, 'json': try_json(text)}
raw['parsed'] = parsed
OUT.write_text(json.dumps(raw, ensure_ascii=False, indent=2), encoding='utf-8')
print(str(OUT))
