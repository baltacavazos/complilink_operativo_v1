import json
import os
from pathlib import Path

import requests

PROJECT = Path('/home/ubuntu/complilink_operativo_v1')
OUT = PROJECT / 'tmp_alert_callback_multi_model_output.json'

context = {
    'current_state': {
        'salary_discrepancy_detection': 'No existe una alerta automática específica al comparar contrato vs CFDI/SBC-SDI. Solo existen alertas operativas genéricas.',
        'bridge_callback_persistence': 'Existe tabla compliLinkWebhookEvents y webhook de retorno autenticado; registra eventos recibidos, pero no hay timeout visible cuando el callback no llega tras el dispatch inicial.',
        'existing_observability': 'El upload registra case_events, audit_logs, canonical contracts y operational alerts. El dispatch al bridge ya genera audit log document.engine_dispatch con correlationId, dispatchId y httpStatus.',
        'case_detail_surface': 'getCaseDetailForUser ya devuelve events, documents, consents, alerts y policies, por lo que una alerta backend visible en alerts/events sería suficiente para una primera versión.',
        'test_state': 'Existe suite auditaPatronReturnWebhook.test.ts con cobertura de autenticación, duplicados, retries y fallas de procesamiento.'
    },
    'constraints': {
        'goal': 'Implementación mínima, robusta, sin rediseño grande de UI, aprovechando alertas y eventos existentes.',
        'preference': 'Backend-first, trazabilidad fuerte, UX clara, sin sobrecargar el flujo de carga documental.',
        'runtime': 'Node-only, sin workers persistentes; se prefiere solución síncrona o derivada de datos ya persistidos.'
    },
    'document_pattern': {
        'observed_case': 'Hector y otros casos previos muestran identidad consistente entre contrato y CFDI pero discrepancia entre salario contractual y SBC/SDI.',
        'desired_behavior': 'Generar warning claro con timestamp y contexto de valores comparados, sin bloquear la carga.'
    },
    'callback_pattern': {
        'observed_case': 'El dispatch inicial responde HTTP 202 y queda auditado, pero en ventana corta puede no llegar ningún registro a compliLinkWebhookEvents.',
        'desired_behavior': 'Mostrar de forma explícita que el callback sigue pendiente y elevar warning/critical si vence un timeout razonable.'
    }
}

prompt = (
    'Eres un arquitecto senior de producto y backend para una app legal-documental mexicana. '
    'Propón la mejor implementación mínima y robusta para dos mejoras: '
    '1) alerta automática de discrepancia salarial entre contrato y CFDI/SBC-SDI; '
    '2) monitoreo visible del callback asíncrono del bridge cuando el dispatch ya fue aceptado pero no llega retorno. '
    'Responde JSON estricto con este esquema: '
    '{"salary_alert_strategy":{"where_to_compute":"string","severity":"string","blocking":"boolean","fields_to_include":["string"],"event_or_alerts":["string"]},'
    '"callback_monitoring_strategy":{"where_to_compute":"string","pending_state_source":"string","timeout_rule":"string","event_or_alerts":["string"],"ui_surface":"string"},'
    '"implementation_notes":["string"],'
    '"test_cases":["string"],'
    '"recommended_scope":"string"}. '
    'Contexto: ' + json.dumps(context, ensure_ascii=False)
)


def call_openai(prompt: str) -> dict:
    api_key = os.environ.get('OPENAI_API_KEY')
    if not api_key:
        return {'error': 'OPENAI_API_KEY missing'}
    headers = {'Authorization': f'Bearer {api_key}', 'Content-Type': 'application/json'}
    payload = {
        'model': 'gpt-4.1-mini',
        'temperature': 0.2,
        'response_format': {'type': 'json_object'},
        'messages': [
            {'role': 'system', 'content': 'Devuelve solo JSON válido y prioriza soluciones mínimas, robustas y trazables.'},
            {'role': 'user', 'content': prompt},
        ],
    }
    r = requests.post('https://api.openai.com/v1/chat/completions', headers=headers, json=payload, timeout=120)
    return {'status_code': r.status_code, 'body': r.json()}


def call_grok(prompt: str) -> dict:
    api_key = os.environ.get('XAI_API_KEY')
    if not api_key:
        return {'error': 'XAI_API_KEY missing'}
    headers = {'Authorization': f'Bearer {api_key}', 'Content-Type': 'application/json'}
    payload = {
        'model': 'grok-4',
        'temperature': 0.2,
        'response_format': {'type': 'json_object'},
        'messages': [
            {'role': 'system', 'content': 'Devuelve solo JSON válido y prioriza soluciones mínimas, robustas y trazables.'},
            {'role': 'user', 'content': prompt},
        ],
    }
    r = requests.post('https://api.x.ai/v1/chat/completions', headers=headers, json=payload, timeout=120)
    return {'status_code': r.status_code, 'body': r.json()}


def call_gemini(prompt: str) -> dict:
    api_key = os.environ.get('GEMINI_API_KEY')
    if not api_key:
        return {'error': 'GEMINI_API_KEY missing'}
    url = f'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}'
    payload = {
        'contents': [{'parts': [{'text': prompt}]}],
        'generationConfig': {'temperature': 0.2, 'responseMimeType': 'application/json'},
    }
    r = requests.post(url, json=payload, timeout=120)
    return {'status_code': r.status_code, 'body': r.json()}


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
