import json
import os
from pathlib import Path

import requests

BASE = Path('/home/ubuntu/complilink_operativo_v1/audit')
PROMPT_FILE = BASE / 'consensus_outputs' / 'shared_consensus_prompt.md'
OUT_DIR = BASE / 'consensus_outputs'
OUT_DIR.mkdir(parents=True, exist_ok=True)

SYSTEM_MSG = (
    'Eres un moderador de consenso entre auditores senior de producto digital. '
    'Debes reconciliar posturas, identificar coincidencias sólidas y priorizar con enfoque mobile-first.'
)


def main() -> None:
    api_key = os.environ['GEMINI_API_KEY']
    prompt = PROMPT_FILE.read_text(encoding='utf-8')
    url = f'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}'
    payload = {
        'system_instruction': {'parts': [{'text': SYSTEM_MSG}]},
        'contents': [{'role': 'user', 'parts': [{'text': prompt}]}],
        'generationConfig': {'temperature': 0.1},
    }
    response = requests.post(url, headers={'Content-Type': 'application/json'}, json=payload, timeout=180)
    response.raise_for_status()
    data = response.json()
    parts = data['candidates'][0]['content']['parts']
    text = '\n'.join(part.get('text', '') for part in parts if 'text' in part).strip()
    (OUT_DIR / 'gemini_consensus.json').write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding='utf-8')
    (OUT_DIR / 'gemini_consensus.md').write_text(text, encoding='utf-8')
    print('saved', OUT_DIR / 'gemini_consensus.md')


if __name__ == '__main__':
    main()
