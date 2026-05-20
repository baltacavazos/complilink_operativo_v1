import json
import os
import re
import time
from pathlib import Path

import requests

BASE = Path('/home/ubuntu/complilink_operativo_v1')
INPUT_PATH = BASE / 'tmp_round2_worker_lens_input.md'
OUTPUT_PATH = BASE / 'tmp_worker_lens_multi_ai_results.json'

prompt_input = INPUT_PATH.read_text()

system_prompt = (
    'Eres un auditor experto en UX para productos dirigidos a trabajadores de a pie en México. '
    'Debes leer una plataforma como si fueras una persona común, no técnica, con poco tiempo, '
    'posible nerviosismo laboral y baja tolerancia a palabras complicadas. '
    'Tu misión es detectar fricción, lenguaje técnico, redundancia, pasos no elementales, '
    'promesas poco claras y cualquier cosa que haga pensar demasiado. '
    'Responde SOLO JSON válido.'
)

user_prompt = f'''Analiza el siguiente insumo de Auditapatron y responde como si fueras un cliente trabajador de a pie en México.

Quiero una auditoría brutalmente práctica enfocada en simplicidad extrema.

Devuelve SOLO un JSON con esta estructura exacta:
{{
  "verdict": "si_no_entiendo_rapido" | "entiendo_pero_sobra_ruido" | "muy_claro",
  "top_confusions": [
    {{"surface": "landing|auditar|acceso", "issue": "...", "why_it_confuses": "...", "severity": 1-5}}
  ],
  "remove_or_hide": [
    {{"surface": "landing|auditar|acceso", "element": "...", "reason": "..."}}
  ],
  "rewrite_now": [
    {{"surface": "landing|auditar|acceso", "from": "...", "to": "...", "reason": "..."}}
  ],
  "one_sentence_test": "Explica en una sola frase qué hace la plataforma usando lenguaje de trabajador no técnico",
  "ideal_first_screen": "Describe cómo debería sentirse y verse el primer pantallazo ideal",
  "priority_actions": ["...", "...", "..."],
  "score_clarity_0_10": 0
}}

Insumo:
{prompt_input}
'''


def extract_json(text: str):
    text = text.strip()
    if text.startswith('```'):
        text = re.sub(r'^```(?:json)?\s*', '', text)
        text = re.sub(r'\s*```$', '', text)
    start = text.find('{')
    end = text.rfind('}')
    if start == -1 or end == -1 or end <= start:
        raise ValueError('No JSON object found')
    return json.loads(text[start:end+1])


def call_openai():
    api_key = os.environ.get('OPENAI_API_KEY')
    if not api_key:
        return {'error': 'OPENAI_API_KEY missing'}
    url = 'https://api.openai.com/v1/chat/completions'
    payload = {
        'model': 'gpt-4.1-mini',
        'temperature': 0.2,
        'response_format': {'type': 'json_object'},
        'messages': [
            {'role': 'system', 'content': system_prompt},
            {'role': 'user', 'content': user_prompt},
        ],
    }
    r = requests.post(url, headers={
        'Authorization': f'Bearer {api_key}',
        'Content-Type': 'application/json',
    }, json=payload, timeout=90)
    r.raise_for_status()
    content = r.json()['choices'][0]['message']['content']
    return extract_json(content)


def call_grok():
    api_key = os.environ.get('XAI_API_KEY')
    if not api_key:
        return {'error': 'XAI_API_KEY missing'}
    url = 'https://api.x.ai/v1/chat/completions'
    models = ['grok-3-mini-beta', 'grok-3-beta', 'grok-2-1212']
    last_error = None
    for model in models:
        try:
            payload = {
                'model': model,
                'temperature': 0.2,
                'response_format': {'type': 'json_object'},
                'messages': [
                    {'role': 'system', 'content': system_prompt},
                    {'role': 'user', 'content': user_prompt},
                ],
            }
            r = requests.post(url, headers={
                'Authorization': f'Bearer {api_key}',
                'Content-Type': 'application/json',
            }, json=payload, timeout=90)
            if r.status_code >= 400:
                last_error = {'model': model, 'status': r.status_code, 'body': r.text[:500]}
                continue
            content = r.json()['choices'][0]['message']['content']
            result = extract_json(content)
            result['_model'] = model
            return result
        except Exception as exc:
            last_error = {'model': model, 'error': str(exc)}
            time.sleep(1)
    return {'error': 'grok_failed', 'details': last_error}


def call_gemini():
    api_key = os.environ.get('GEMINI_API_KEY')
    if not api_key:
        return {'error': 'GEMINI_API_KEY missing'}
    models = ['gemini-2.5-flash', 'gemini-flash-latest', 'gemini-2.0-flash-001', 'gemini-2.5-flash-lite']
    last_error = None
    for model in models:
        try:
            url = f'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}'
            payload = {
                'system_instruction': {
                    'parts': [{'text': system_prompt}]
                },
                'contents': [
                    {
                        'role': 'user',
                        'parts': [{'text': user_prompt}],
                    }
                ],
                'generationConfig': {
                    'temperature': 0.2,
                    'responseMimeType': 'application/json',
                },
            }
            r = requests.post(url, headers={'Content-Type': 'application/json'}, json=payload, timeout=90)
            if r.status_code >= 400:
                last_error = {'model': model, 'status': r.status_code, 'body': r.text[:500]}
                continue
            data = r.json()
            content = data['candidates'][0]['content']['parts'][0]['text']
            result = extract_json(content)
            result['_model'] = model
            return result
        except Exception as exc:
            last_error = {'model': model, 'error': str(exc)}
            time.sleep(1)
    return {'error': 'gemini_failed', 'details': last_error}


results = {
    'chatgpt': call_openai(),
    'grok': call_grok(),
    'gemini': call_gemini(),
}

OUTPUT_PATH.write_text(json.dumps(results, ensure_ascii=False, indent=2))
print(str(OUTPUT_PATH))
