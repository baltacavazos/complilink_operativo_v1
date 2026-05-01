import json
import os
from pathlib import Path

from google import genai

PROJECT_DIR = Path('/home/ubuntu/complilink_operativo_v1')
OUTPUT_PATH = PROJECT_DIR / '.manus-notes' / 'gemini_models_list.json'

api_key = os.environ.get('GEMINI_API_KEY')
if not api_key:
    raise SystemExit('GEMINI_API_KEY missing')

client = genai.Client(api_key=api_key)
models = []
for model in client.models.list():
    item = {
        'name': getattr(model, 'name', None),
        'display_name': getattr(model, 'display_name', None),
        'description': getattr(model, 'description', None),
        'supported_actions': getattr(model, 'supported_actions', None),
    }
    models.append(item)

OUTPUT_PATH.write_text(json.dumps(models, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(str(OUTPUT_PATH))
