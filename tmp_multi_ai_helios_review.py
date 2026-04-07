import json
import os
import sys
import time
from pathlib import Path

import requests

BASE_DIR = Path('/home/ubuntu/complilink_operativo_v1')
OUT_DIR = BASE_DIR / 'research' / 'helios_multi_ai'
OUT_DIR.mkdir(parents=True, exist_ok=True)

ARCHITECTURE_CONTEXT = {
    'project': 'Auditapatron / CompliLink Operativo',
    'current_state': {
        'frontend_page': '/auditar',
        'ux_direction': 'mobile-first, low-scroll, subtle microanimations, reduced motion support',
        'backend_stack': 'React + TypeScript frontend, Express + tRPC backend, Drizzle/MySQL data layer',
        'document_flow': [
            'uploadDocument receives tenantId, caseId, file, textHint, visibility and consentStatus',
            'backend stores file in S3-compatible storage',
            'backend classifies Mexican labor document type and builds preliminary labor analysis',
            'backend stores canonical contracts for document, classification and shared_engine',
            'backend builds a Helios opinion contract with requestedOpinionType labor_preliminary_opinion',
            'backend persists Helios opinion as canonical contract type audit schema helios_v1',
            'backend returns heliosOpinion and heliosOpinionContract in uploadDocument mutation response',
            'backend also dispatches document to the broader AuditaPatron/CompliLink engine and stores dispatch events'
        ],
        'frontend_gap': [
            'The upload flow can access heliosOpinion immediately after upload, but the case detail query does not expose persisted Helios opinions per document',
            'The documents list currently returns document rows only, without a joined persisted legal opinion',
            'The /auditar page emphasizes simple explanations, contribution of the uploaded document, next suggested document and engine status, but does not yet visibly surface the Helios legal opinion block as a persistent dossier capability'
        ],
        'integration_constraints': [
            'Spanish-speaking end users',
            'must feel simple, human and non-intimidating',
            'legal content must be clearly labeled as assisted preliminary opinion, not final legal advice',
            'future remote Helios mode will come later; for now local mock contract exists and should guide the UI/API design',
            'user wants robust architecture and multi-AI validation before implementation'
        ]
    }
}

PROMPT = f"""
Eres un revisor senior de arquitectura de producto legal con enfoque mobile-first y lenguaje humano.

Analiza esta arquitectura real de Auditapatron y recomienda cómo integrar visiblemente Helios (motor de opinión jurídica asistida) de la forma más robusta, simple y escalable.

Contexto de arquitectura:
{json.dumps(ARCHITECTURE_CONTEXT, ensure_ascii=False, indent=2)}

Necesito una respuesta ESTRICTAMENTE en JSON válido con esta forma exacta:
{{
  "model_position": "string breve",
  "recommended_mvp": {{
    "summary": "string",
    "backend_shape": ["string", "string"],
    "frontend_shape": ["string", "string"],
    "data_contract": ["string", "string"]
  }},
  "preferred_ui_pattern": {{
    "name": "string",
    "why": "string",
    "sections": ["string", "string", "string"]
  }},
  "error_handling": ["string", "string", "string"],
  "trust_and_legal_safeguards": ["string", "string", "string"],
  "future_remote_mode": ["string", "string", "string"],
  "top_risks": [
    {{"risk": "string", "impact": "string", "mitigation": "string"}},
    {{"risk": "string", "impact": "string", "mitigation": "string"}},
    {{"risk": "string", "impact": "string", "mitigation": "string"}}
  ],
  "recommended_next_step_order": ["string", "string", "string", "string", "string"],
  "what_not_to_do": ["string", "string", "string"]
}}

Criterios obligatorios:
1. Prioriza simplicidad extrema para el usuario final.
2. Evita duplicar información técnica innecesaria.
3. Propón un patrón que funcione hoy con opinión mock persistida y mañana con Helios remoto.
4. Piensa como cliente exigente: detecta lo que falta y lo que podría salir mal.
5. Responde en español.
""".strip()


def write_json(path: Path, data):
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding='utf-8')


def parse_json_from_text(text: str):
    text = text.strip()
    if text.startswith('```'):
        parts = text.split('```')
        for part in parts:
            part = part.strip()
            if part.startswith('json'):
                candidate = part[4:].strip()
                return json.loads(candidate)
        text = text.replace('```json', '').replace('```', '').strip()
    return json.loads(text)


def call_openai():
    api_key = os.environ.get('OPENAI_API_KEY')
    if not api_key:
        raise RuntimeError('OPENAI_API_KEY missing')
    url = 'https://api.openai.com/v1/chat/completions'
    payload = {
        'model': 'gpt-4.1-mini',
        'temperature': 0.2,
        'response_format': {'type': 'json_object'},
        'messages': [
            {'role': 'system', 'content': 'Eres un arquitecto principal de producto legal y software. Responde solo JSON válido.'},
            {'role': 'user', 'content': PROMPT},
        ],
    }
    r = requests.post(url, headers={'Authorization': f'Bearer {api_key}', 'Content-Type': 'application/json'}, json=payload, timeout=90)
    r.raise_for_status()
    raw = r.json()
    content = raw['choices'][0]['message']['content']
    return {'provider': 'openai', 'model': 'gpt-4.1-mini', 'parsed': parse_json_from_text(content), 'raw': raw}


def call_grok():
    api_key = os.environ.get('XAI_API_KEY')
    if not api_key:
        raise RuntimeError('XAI_API_KEY missing')
    url = 'https://api.x.ai/v1/chat/completions'
    payload = {
        'model': 'grok-4',
        'temperature': 0.2,
        'response_format': {'type': 'json_object'},
        'messages': [
            {'role': 'system', 'content': 'Eres un arquitecto principal de producto legal y software. Responde solo JSON válido.'},
            {'role': 'user', 'content': PROMPT},
        ],
    }
    r = requests.post(url, headers={'Authorization': f'Bearer {api_key}', 'Content-Type': 'application/json'}, json=payload, timeout=90)
    r.raise_for_status()
    raw = r.json()
    content = raw['choices'][0]['message']['content']
    return {'provider': 'grok', 'model': 'grok-4', 'parsed': parse_json_from_text(content), 'raw': raw}


def call_gemini():
    api_key = os.environ.get('GEMINI_API_KEY')
    if not api_key:
        raise RuntimeError('GEMINI_API_KEY missing')
    url = f'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}'
    schema = {
        'type': 'OBJECT',
        'properties': {
            'model_position': {'type': 'STRING'},
            'recommended_mvp': {
                'type': 'OBJECT',
                'properties': {
                    'summary': {'type': 'STRING'},
                    'backend_shape': {'type': 'ARRAY', 'items': {'type': 'STRING'}},
                    'frontend_shape': {'type': 'ARRAY', 'items': {'type': 'STRING'}},
                    'data_contract': {'type': 'ARRAY', 'items': {'type': 'STRING'}},
                },
                'required': ['summary', 'backend_shape', 'frontend_shape', 'data_contract'],
            },
            'preferred_ui_pattern': {
                'type': 'OBJECT',
                'properties': {
                    'name': {'type': 'STRING'},
                    'why': {'type': 'STRING'},
                    'sections': {'type': 'ARRAY', 'items': {'type': 'STRING'}},
                },
                'required': ['name', 'why', 'sections'],
            },
            'error_handling': {'type': 'ARRAY', 'items': {'type': 'STRING'}},
            'trust_and_legal_safeguards': {'type': 'ARRAY', 'items': {'type': 'STRING'}},
            'future_remote_mode': {'type': 'ARRAY', 'items': {'type': 'STRING'}},
            'top_risks': {
                'type': 'ARRAY',
                'items': {
                    'type': 'OBJECT',
                    'properties': {
                        'risk': {'type': 'STRING'},
                        'impact': {'type': 'STRING'},
                        'mitigation': {'type': 'STRING'},
                    },
                    'required': ['risk', 'impact', 'mitigation'],
                },
            },
            'recommended_next_step_order': {'type': 'ARRAY', 'items': {'type': 'STRING'}},
            'what_not_to_do': {'type': 'ARRAY', 'items': {'type': 'STRING'}},
        },
        'required': [
            'model_position',
            'recommended_mvp',
            'preferred_ui_pattern',
            'error_handling',
            'trust_and_legal_safeguards',
            'future_remote_mode',
            'top_risks',
            'recommended_next_step_order',
            'what_not_to_do'
        ],
    }
    payload = {
        'contents': [
            {
                'parts': [
                    {'text': 'Eres un arquitecto principal de producto legal y software. Responde solo JSON válido.'},
                    {'text': PROMPT},
                ]
            }
        ],
        'generationConfig': {
            'temperature': 0.2,
            'responseMimeType': 'application/json',
            'responseSchema': schema,
        },
    }
    r = requests.post(url, headers={'Content-Type': 'application/json'}, json=payload, timeout=90)
    r.raise_for_status()
    raw = r.json()
    text = raw['candidates'][0]['content']['parts'][0]['text']
    return {'provider': 'gemini', 'model': 'gemini-2.5-flash', 'parsed': parse_json_from_text(text), 'raw': raw}


def main():
    started = time.time()
    results = {}
    errors = {}
    for name, func in [('openai', call_openai), ('grok', call_grok), ('gemini', call_gemini)]:
        try:
            result = func()
            results[name] = result['parsed']
            write_json(OUT_DIR / f'{name}_response.json', result)
        except Exception as exc:
            errors[name] = {'error': str(exc)}
            write_json(OUT_DIR / f'{name}_error.json', errors[name])
    summary = {
        'created_at': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
        'duration_seconds': round(time.time() - started, 2),
        'results_present': sorted(results.keys()),
        'errors_present': errors,
    }
    write_json(OUT_DIR / 'run_summary.json', summary)
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    if not results:
        sys.exit(1)


if __name__ == '__main__':
    main()
