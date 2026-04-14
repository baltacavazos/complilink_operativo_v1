import json
import os
import re
from pathlib import Path

import requests

PROJECT_ROOT = Path('/home/ubuntu/complilink_operativo_v1')
NOTES_PATH = PROJECT_ROOT / 'ux_ceo_first_dossier_notes_round1.md'
OUTPUT_PATH = PROJECT_ROOT / 'multi_model_ceo_first_dossier_round1.json'

OPENAI_API_KEY = os.getenv('OPENAI_API_KEY')
XAI_API_KEY = os.getenv('XAI_API_KEY')
GEMINI_API_KEY = os.getenv('GEMINI_API_KEY')

NOTE_TEXT = NOTES_PATH.read_text(encoding='utf-8')

PROMPT = f"""Eres un experto senior en UX de producto y diseño de dashboards ejecutivos para una app de documentos laborales en México.

Tu tarea es analizar el siguiente contexto y responder EXCLUSIVAMENTE con JSON válido, sin markdown ni texto adicional.

Devuelve un objeto JSON con esta estructura exacta:
{{
  "section_name": "string",
  "north_star": "string",
  "recommended_layout": {{
    "hero_metric": "string",
    "supporting_cards": ["string", "string", "string"],
    "mini_funnel": ["string", "string", "string", "string"],
    "insight_block": "string"
  }},
  "priority_metrics": [
    {{"name": "string", "why": "string"}},
    {{"name": "string", "why": "string"}},
    {{"name": "string", "why": "string"}},
    {{"name": "string", "why": "string"}}
  ],
  "auto_insights": ["string", "string", "string"],
  "v1_do": ["string", "string", "string"],
  "v1_avoid": ["string", "string", "string"],
  "copy_tone": "string"
}}

Contexto:
{NOTE_TEXT}
"""


def extract_json(text: str):
    text = text.strip()
    if not text:
        raise ValueError('Empty response')
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        match = re.search(r'\{.*\}', text, re.S)
        if not match:
            raise
        return json.loads(match.group(0))


def call_openai():
    if not OPENAI_API_KEY:
        return {'error': 'OPENAI_API_KEY not set'}
    response = requests.post(
        'https://api.openai.com/v1/chat/completions',
        headers={
            'Authorization': f'Bearer {OPENAI_API_KEY}',
            'Content-Type': 'application/json',
        },
        json={
            'model': 'gpt-4.1-mini',
            'temperature': 0.2,
            'response_format': {'type': 'json_object'},
            'messages': [
                {'role': 'system', 'content': 'Devuelve solo JSON válido.'},
                {'role': 'user', 'content': PROMPT},
            ],
        },
        timeout=90,
    )
    response.raise_for_status()
    data = response.json()
    content = data['choices'][0]['message']['content']
    return extract_json(content)


def call_grok():
    if not XAI_API_KEY:
        return {'error': 'XAI_API_KEY not set'}
    response = requests.post(
        'https://api.x.ai/v1/chat/completions',
        headers={
            'Authorization': f'Bearer {XAI_API_KEY}',
            'Content-Type': 'application/json',
        },
        json={
            'model': 'grok-3-mini',
            'temperature': 0.2,
            'response_format': {'type': 'json_object'},
            'messages': [
                {'role': 'system', 'content': 'Devuelve solo JSON válido.'},
                {'role': 'user', 'content': PROMPT},
            ],
        },
        timeout=90,
    )
    response.raise_for_status()
    data = response.json()
    content = data['choices'][0]['message']['content']
    return extract_json(content)


def call_gemini():
    if not GEMINI_API_KEY:
        return {'error': 'GEMINI_API_KEY not set'}
    candidate_models = [
        'gemini-2.5-flash',
        'gemini-2.0-flash',
        'gemini-1.5-flash',
    ]
    last_error = None
    for model in candidate_models:
        try:
            response = requests.post(
                f'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={GEMINI_API_KEY}',
                headers={'Content-Type': 'application/json'},
                json={
                    'generationConfig': {
                        'temperature': 0.2,
                        'responseMimeType': 'application/json',
                    },
                    'contents': [
                        {
                            'role': 'user',
                            'parts': [{'text': PROMPT}],
                        }
                    ],
                },
                timeout=90,
            )
            response.raise_for_status()
            data = response.json()
            content = data['candidates'][0]['content']['parts'][0]['text']
            parsed = extract_json(content)
            parsed['_gemini_model'] = model
            return parsed
        except Exception as exc:
            last_error = exc
    raise last_error


def safe_call(fn):
    try:
        return {'ok': True, 'result': fn()}
    except Exception as exc:
        return {'ok': False, 'error': f'{type(exc).__name__}: {exc}'}


results = {
    'openai': safe_call(call_openai),
    'grok': safe_call(call_grok),
    'gemini': safe_call(call_gemini),
}

OUTPUT_PATH.write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding='utf-8')
print(str(OUTPUT_PATH))
