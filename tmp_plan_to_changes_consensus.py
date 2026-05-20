#!/usr/bin/env python3
import json
import os
from pathlib import Path
import requests

ROOT = Path('/home/ubuntu/complilink_operativo_v1')
FILES = [
    ROOT / 'platform_improvement_plan.md',
    ROOT / 'client/src/pages/Home.tsx',
    ROOT / 'client/src/pages/Auditar.tsx',
    ROOT / 'client/src/pages/Access.tsx',
]


def load_context() -> str:
    chunks = []
    for path in FILES:
        try:
            text = path.read_text(encoding='utf-8')
        except Exception as exc:
            text = f'[error leyendo {path.name}: {exc}]'
        if len(text) > 18000:
            text = text[:18000] + '\n...[truncado]'
        chunks.append(f'## FILE: {path.name}\n{text}')
    return '\n\n'.join(chunks)


SYSTEM = (
    'Actúa como consultor senior de producto y UX para México. '
    'Tu tarea es revisar Auditapatron como producto móvil para trabajadores de a pie en México. '
    'Debes priorizar cambios de alto impacto para simplificar, aumentar confianza y mejorar conversión. '
    'Responde SOLO JSON válido.'
)


def prompt(context: str) -> str:
    return f'''
Revisa el contexto actual de Auditapatron y responde como si fueras un cliente y estratega de producto.

Quiero que priorices los SIGUIENTES CAMBIOS de muy corto plazo:
1. Hero y confianza visible.
2. Mensajes de carga y continuidad en /auditar.
3. Casos cotidianos o ayudas que expliquen mejor para quién sirve.
4. Qué NO tocar todavía para no meter fricción.

Entrega SOLO un JSON con esta estructura exacta:
{{
  "veredicto_general": "string",
  "top_3_cambios": [
    {{"titulo": "string", "por_que": "string", "impacto": "alto|medio|bajo"}}
  ],
  "microcopies_sugeridos": {{
    "hero": "string",
    "privacidad": "string",
    "carga": "string",
    "whatsapp": "string"
  }},
  "cosas_que_no_tocaria": ["string"],
  "riesgo_principal": "string"
}}

Contexto actual:
{context}
'''



def call_openai(user_prompt: str):
    api_key = os.environ.get('OPENAI_API_KEY')
    if not api_key:
        return {'error': 'OPENAI_API_KEY missing'}
    url = 'https://api.openai.com/v1/chat/completions'
    payload = {
        'model': 'gpt-4.1-mini',
        'messages': [
            {'role': 'system', 'content': SYSTEM},
            {'role': 'user', 'content': user_prompt},
        ],
        'temperature': 0.2,
        'response_format': {'type': 'json_object'},
    }
    resp = requests.post(url, headers={
        'Authorization': f'Bearer {api_key}',
        'Content-Type': 'application/json',
    }, json=payload, timeout=90)
    resp.raise_for_status()
    data = resp.json()
    content = data['choices'][0]['message']['content']
    return json.loads(content)



def call_grok(user_prompt: str):
    api_key = os.environ.get('XAI_API_KEY')
    if not api_key:
        return {'error': 'XAI_API_KEY missing'}
    url = 'https://api.x.ai/v1/chat/completions'
    payload = {
        'model': 'grok-3-mini',
        'messages': [
            {'role': 'system', 'content': SYSTEM},
            {'role': 'user', 'content': user_prompt},
        ],
        'temperature': 0.2,
        'response_format': {'type': 'json_object'},
    }
    resp = requests.post(url, headers={
        'Authorization': f'Bearer {api_key}',
        'Content-Type': 'application/json',
    }, json=payload, timeout=90)
    resp.raise_for_status()
    data = resp.json()
    content = data['choices'][0]['message']['content']
    return json.loads(content)



def call_gemini(user_prompt: str):
    api_key = os.environ.get('GEMINI_API_KEY')
    if not api_key:
        return {'error': 'GEMINI_API_KEY missing'}
    model = 'gemini-2.5-flash'
    url = f'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}'
    schema = {
        'type': 'OBJECT',
        'properties': {
            'veredicto_general': {'type': 'STRING'},
            'top_3_cambios': {
                'type': 'ARRAY',
                'items': {
                    'type': 'OBJECT',
                    'properties': {
                        'titulo': {'type': 'STRING'},
                        'por_que': {'type': 'STRING'},
                        'impacto': {'type': 'STRING'},
                    },
                    'required': ['titulo', 'por_que', 'impacto'],
                },
            },
            'microcopies_sugeridos': {
                'type': 'OBJECT',
                'properties': {
                    'hero': {'type': 'STRING'},
                    'privacidad': {'type': 'STRING'},
                    'carga': {'type': 'STRING'},
                    'whatsapp': {'type': 'STRING'},
                },
                'required': ['hero', 'privacidad', 'carga', 'whatsapp'],
            },
            'cosas_que_no_tocaria': {
                'type': 'ARRAY',
                'items': {'type': 'STRING'},
            },
            'riesgo_principal': {'type': 'STRING'},
        },
        'required': [
            'veredicto_general',
            'top_3_cambios',
            'microcopies_sugeridos',
            'cosas_que_no_tocaria',
            'riesgo_principal',
        ],
    }
    payload = {
        'systemInstruction': {'parts': [{'text': SYSTEM}]},
        'contents': [{'parts': [{'text': user_prompt}]}],
        'generationConfig': {
            'temperature': 0.2,
            'responseMimeType': 'application/json',
            'responseSchema': schema,
        },
    }
    resp = requests.post(url, headers={'Content-Type': 'application/json'}, json=payload, timeout=90)
    resp.raise_for_status()
    data = resp.json()
    content = data['candidates'][0]['content']['parts'][0]['text']
    return json.loads(content)



def main():
    context = load_context()
    user_prompt = prompt(context)
    results = {}
    for name, fn in [('chatgpt', call_openai), ('grok', call_grok), ('gemini', call_gemini)]:
        try:
            results[name] = fn(user_prompt)
        except Exception as exc:
            results[name] = {'error': str(exc)}
    out = ROOT / 'tmp_plan_to_changes_consensus_results.json'
    out.write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding='utf-8')
    print(str(out))


if __name__ == '__main__':
    main()
