import json
import os
from pathlib import Path

import requests

PROJECT_DIR = Path('/home/ubuntu/complilink_operativo_v1')
PROMPT_SOURCE = PROJECT_DIR / '.manus-notes' / 'ceo_hybrid_view_round2_consensus.json'
OUTPUT_PATH = PROJECT_DIR / '.manus-notes' / 'ceo_hybrid_view_round2_gemini_retry.json'

prompt = json.loads(PROMPT_SOURCE.read_text(encoding='utf-8'))['prompt']
api_key = os.environ.get('GEMINI_API_KEY')
if not api_key:
    raise SystemExit('GEMINI_API_KEY missing')

models = ['gemini-2.5-flash', 'gemini-1.5-flash']
last_error = None
for model in models:
    try:
        response = requests.post(
            f'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}',
            headers={'Content-Type': 'application/json'},
            json={
                'generationConfig': {
                    'temperature': 0.2,
                    'responseMimeType': 'application/json',
                },
                'systemInstruction': {
                    'parts': [{'text': 'Eres un arquitecto de producto y UX. Responde solo JSON válido.'}]
                },
                'contents': [
                    {
                        'role': 'user',
                        'parts': [{'text': prompt}],
                    }
                ],
            },
            timeout=90,
        )
        response.raise_for_status()
        data = response.json()
        content = data['candidates'][0]['content']['parts'][0]['text']
        result = {
            'provider': 'gemini',
            'model': model,
            'raw': content,
            'parsed': json.loads(content),
        }
        OUTPUT_PATH.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
        print(str(OUTPUT_PATH))
        raise SystemExit(0)
    except Exception as exc:
        last_error = f'{type(exc).__name__}: {exc}'

OUTPUT_PATH.write_text(json.dumps({'provider': 'gemini', 'error': last_error}, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(str(OUTPUT_PATH))
