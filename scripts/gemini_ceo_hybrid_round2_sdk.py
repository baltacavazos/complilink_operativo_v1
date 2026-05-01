import json
import os
from pathlib import Path

PROJECT_DIR = Path('/home/ubuntu/complilink_operativo_v1')
PROMPT_SOURCE = PROJECT_DIR / '.manus-notes' / 'ceo_hybrid_view_round2_consensus.json'
OUTPUT_PATH = PROJECT_DIR / '.manus-notes' / 'ceo_hybrid_view_round2_gemini_sdk.json'

prompt = json.loads(PROMPT_SOURCE.read_text(encoding='utf-8'))['prompt']
api_key = os.environ.get('GEMINI_API_KEY')
if not api_key:
    raise SystemExit('GEMINI_API_KEY missing')

try:
    from google import genai
except Exception as exc:
    OUTPUT_PATH.write_text(json.dumps({'provider': 'gemini', 'error': f'import_error: {exc}'}, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(str(OUTPUT_PATH))
    raise SystemExit(0)

last_error = None
for model in ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash']:
    try:
        client = genai.Client(api_key=api_key)
        response = client.models.generate_content(
            model=model,
            contents=prompt,
            config={
                'temperature': 0.2,
                'response_mime_type': 'application/json',
                'system_instruction': 'Eres un arquitecto de producto y UX. Responde solo JSON válido.',
            },
        )
        text = response.text
        result = {
            'provider': 'gemini',
            'model': model,
            'raw': text,
            'parsed': json.loads(text),
        }
        OUTPUT_PATH.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
        print(str(OUTPUT_PATH))
        raise SystemExit(0)
    except Exception as exc:
        last_error = f'{type(exc).__name__}: {exc}'

OUTPUT_PATH.write_text(json.dumps({'provider': 'gemini', 'error': last_error}, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(str(OUTPUT_PATH))
