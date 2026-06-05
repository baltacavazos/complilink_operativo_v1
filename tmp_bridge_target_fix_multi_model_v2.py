import json
import os
from pathlib import Path

import requests

PROJECT = Path('/home/ubuntu/complilink_operativo_v1')
OUT = PROJECT / 'tmp_bridge_target_fix_multi_model_v2_output.json'

context = {
    'observed_facts': {
        'configured_dispatch_url': 'https://auditapatron.com/api/auditapatron/webhook',
        'client_contract_meaning': 'AUDITAPATRON_ENGINE_WEBHOOK_URL is used by sendDocumentToAuditaPatronEngine as the outbound dispatch target after health preflight.',
        'payload_has_no_callback_url': True,
        'current_target_behavior': 'The route /api/auditapatron/webhook only validates document.uploaded and returns accepted; it does not create compliLinkWebhookEvents or perform final processing.',
        'final_return_handler_routes': ['/api/auditapatron/complilink-webhook', '/api/internal/helios/bridge', '/api/integrations/auditapatron/bridge'],
        'runtime_symptom': 'Dispatch returns HTTP 202 with correlationId but final webhook events remain empty.',
        'historical_test_expectation': 'A bridge secret test expects https://www.complilink.mx/api/auditapatron/webhook as the configured bridge endpoint.',
        'conflicting_local_test': 'Another secret test currently expects https://auditapatron.com/api/auditapatron/webhook, which may be stale or wrong.'
    },
    'goal': 'Determine the most likely real fix to restore end-to-end processing and asynchronous final webhook persistence.',
    'constraints': {
        'must_be_safe': True,
        'must_be_minimal': True,
        'must_be_revalidated': True,
        'user_requires_reliability': '100% working target behavior',
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
        'should_add_compatibility_fallback': True,
        'why': ['string'],
    },
    'test_reconciliation': {
        'which_test_is_probably_stale': 'string',
        'how_to_update_tests': ['string'],
    },
    'validation_plan': {
        'checks': ['string'],
        'expected_success_signal': ['string'],
    },
    'one_sentence_verdict': 'string',
}

prompt = (
    'You are a senior backend integration architect. Respond with valid JSON only using this schema: '
    + json.dumps(schema, ensure_ascii=False)
    + '. Analyze the factual context and identify the most likely real fix. Context: '
    + json.dumps(context, ensure_ascii=False)
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
            {'role': 'system', 'content': 'Return only valid JSON. Prefer causal diagnosis over superficial route matching.'},
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
            {'role': 'system', 'content': 'Return only valid JSON. Prefer causal diagnosis over superficial route matching.'},
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
