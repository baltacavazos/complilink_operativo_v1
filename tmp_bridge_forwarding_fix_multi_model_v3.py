import json
import os
from pathlib import Path

import requests

PROJECT = Path('/home/ubuntu/complilink_operativo_v1')
OUT = PROJECT / 'tmp_bridge_forwarding_fix_multi_model_v3_output.json'

context = {
    'observed_facts': {
        'client_loopback_rule': 'buildLoopbackWebhookUrl intentionally converts configured /api/auditapatron/webhook targets on allowed hosts into http://127.0.0.1:${PORT}/api/auditapatron/webhook.',
        'candidate_order': 'remote configured URL is considered, but local loopback is also a first-class candidate and is what succeeded in the controlled revalidation.',
        'intake_handler_current_behavior': 'handleAuditaPatronIncomingWebhook validates signed document.uploaded payloads and only returns 202 accepted; it does not forward to any remote bridge or processor.',
        'final_return_handler_behavior': 'handleCompliLinkReturnWebhook is the only path that persists compliLinkWebhookEvents and updates documents.',
        'runtime_evidence': 'After fixing the configured host, the controlled revalidation still dispatched successfully only to 127.0.0.1:3000/api/auditapatron/webhook and webhook events remained absent.',
        'remote_contract_hint': 'The canonical remote host is https://complilink.mx and it warns to avoid www redirects. Existing tests historically expect https://complilink.mx/api/auditapatron/webhook as the public bridge endpoint.'
    },
    'goal': 'Decide the most likely definitive fix: add forwarding in the local intake handler, disable loopback, or some combination.',
    'constraints': {
        'must_keep_health_contract': True,
        'must_preserve_existing_signature_contract': True,
        'must_work_in_dev_and_prod': True,
        'must_be_minimal_but_reliable': True,
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
        'primary_action': 'string',
        'secondary_actions': ['string'],
        'why': ['string'],
    },
    'implementation_outline': ['string'],
    'test_plan': ['string'],
    'one_sentence_verdict': 'string',
}

prompt = (
    'You are a senior backend integration architect. Return valid JSON only using this schema: '
    + json.dumps(schema, ensure_ascii=False)
    + '. Decide the definitive fix from the factual context: '
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
            {'role': 'system', 'content': 'Return only valid JSON. Prefer fixes that preserve contracts and explain causal flow.'},
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
            {'role': 'system', 'content': 'Return only valid JSON. Prefer fixes that preserve contracts and explain causal flow.'},
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
