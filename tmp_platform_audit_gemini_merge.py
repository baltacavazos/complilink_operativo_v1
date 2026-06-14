import json
import os
from pathlib import Path

import requests

BASE_DIR = Path('/home/ubuntu/complilink_operativo_v1')
CONTEXT_PATH = BASE_DIR / 'platform_audit_multi_ai_context_2026-06-14.md'
OUTPUT_PATH = BASE_DIR / 'tmp_platform_audit_multi_model_output.json'

REQUIRED_KEYS = [
    'model',
    'global_score',
    'dimension_scores',
    'strengths',
    'live_coded_signals',
    'repetition_signals',
    'visual_consistency_findings',
    'frontend_architecture_findings',
    'top_3_changes',
    'what_to_preserve',
    'path_to_nine',
    'confidence',
    'notable_quotes',
]

SYSTEM_PROMPT = (
    'Eres un director crítico de producto y diseño con criterio senior en UX writing, arquitectura frontend '
    'y percepción de software premium. Debes auditar una plataforma real con mirada independiente. '
    'Tu misión es detectar exactamente qué se siente live coded, repetitivo, ensamblado o poco humano. '
    'Responde únicamente con JSON válido, sin markdown y sin texto adicional.'
)

TEMPLATE = {
    'model': 'Gemini',
    'global_score': 0,
    'dimension_scores': {
        'ux': 0,
        'copy': 0,
        'frontend_architecture': 0,
        'visual_consistency': 0,
        'human_feeling': 0,
    },
    'strengths': ['string'],
    'live_coded_signals': ['string'],
    'repetition_signals': ['string'],
    'visual_consistency_findings': ['string'],
    'frontend_architecture_findings': ['string'],
    'top_3_changes': ['string', 'string', 'string'],
    'what_to_preserve': ['string'],
    'path_to_nine': 'string',
    'confidence': 'string',
    'notable_quotes': ['string'],
}

context = CONTEXT_PATH.read_text(encoding='utf-8')
user_prompt = (
    'Analiza el siguiente dossier de auditoría de plataforma y responde estrictamente con un objeto JSON con esta forma aproximada:\n\n'
    + json.dumps(TEMPLATE, ensure_ascii=False, indent=2)
    + '\n\nUsa números reales del 1 al 10 para los scores. Da exactamente tres elementos en top_3_changes. '
      'La crítica debe ser concreta y accionable.\n\n'
    + context
)

resp = requests.post(
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
    params={'key': os.environ['GEMINI_API_KEY']},
    headers={'Content-Type': 'application/json'},
    json={
        'systemInstruction': {'parts': [{'text': SYSTEM_PROMPT}]},
        'contents': [{'role': 'user', 'parts': [{'text': user_prompt}]}],
        'generationConfig': {
            'temperature': 0.2,
            'responseMimeType': 'application/json',
        },
    },
    timeout=180,
)
resp.raise_for_status()
raw = resp.json()['candidates'][0]['content']['parts'][0]['text']
data = json.loads(raw)

missing = [key for key in REQUIRED_KEYS if key not in data]
if missing:
    raise RuntimeError(f'Gemini devolvió JSON incompleto. Faltan claves: {missing}')

data['source_api'] = 'gemini'

merged = json.loads(OUTPUT_PATH.read_text(encoding='utf-8'))
merged.setdefault('results', {})['gemini'] = data
merged.setdefault('errors', {}).pop('gemini', None)
OUTPUT_PATH.write_text(json.dumps(merged, ensure_ascii=False, indent=2), encoding='utf-8')

print(str(OUTPUT_PATH))
print(json.dumps({'gemini_added': True, 'missing': missing}, ensure_ascii=False, indent=2))
