import json
import os
from pathlib import Path

import requests

BASE = Path('/home/ubuntu/complilink_operativo_v1/audit')
OUT = BASE / 'outputs'
CONS_OUT = BASE / 'consensus_outputs'
CONS_OUT.mkdir(parents=True, exist_ok=True)

PROMPT_TEMPLATE = BASE / 'consensus_deliberation_prompt.md'
CHATGPT_FILE = OUT / 'chatgpt_audit.md'
GROK_FILE = OUT / 'grok_audit.md'
GEMINI_FILE = OUT / 'gemini_audit.md'

SYSTEM_MSG = (
    'Eres un moderador de consenso entre auditores senior de producto digital. '
    'Debes reconciliar posturas, identificar coincidencias sólidas y priorizar con enfoque mobile-first.'
)


def safe_read(path: Path) -> str:
    return path.read_text(encoding='utf-8')


def build_prompt() -> str:
    text = safe_read(PROMPT_TEMPLATE)
    text = text.replace('<!-- CHATGPT_AUDIT -->', safe_read(CHATGPT_FILE))
    text = text.replace('<!-- GROK_AUDIT -->', safe_read(GROK_FILE))
    text = text.replace('<!-- GEMINI_AUDIT -->', safe_read(GEMINI_FILE))
    return text


def call_openai(full_prompt: str) -> dict:
    api_key = os.environ.get('OPENAI_API_KEY')
    if not api_key:
        return {'error': 'OPENAI_API_KEY no disponible'}
    url = 'https://api.openai.com/v1/chat/completions'
    payload = {
        'model': 'gpt-4.1',
        'temperature': 0.1,
        'messages': [
            {'role': 'system', 'content': SYSTEM_MSG},
            {'role': 'user', 'content': full_prompt},
        ],
    }
    r = requests.post(url, headers={'Authorization': f'Bearer {api_key}', 'Content-Type': 'application/json'}, json=payload, timeout=180)
    r.raise_for_status()
    data = r.json()
    return {'model': 'gpt-4.1', 'content': data['choices'][0]['message']['content'], 'raw': data}


def call_grok(full_prompt: str) -> dict:
    api_key = os.environ.get('XAI_API_KEY')
    if not api_key:
        return {'error': 'XAI_API_KEY no disponible'}
    url = 'https://api.x.ai/v1/chat/completions'
    payload = {
        'model': 'grok-4',
        'temperature': 0.1,
        'messages': [
            {'role': 'system', 'content': SYSTEM_MSG},
            {'role': 'user', 'content': full_prompt},
        ],
    }
    r = requests.post(url, headers={'Authorization': f'Bearer {api_key}', 'Content-Type': 'application/json'}, json=payload, timeout=180)
    r.raise_for_status()
    data = r.json()
    return {'model': 'grok-4', 'content': data['choices'][0]['message']['content'], 'raw': data}


def call_gemini(full_prompt: str) -> dict:
    api_key = os.environ.get('GEMINI_API_KEY')
    if not api_key:
        return {'error': 'GEMINI_API_KEY no disponible'}
    url = f'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}'
    payload = {
        'system_instruction': {'parts': [{'text': SYSTEM_MSG}]},
        'contents': [{'role': 'user', 'parts': [{'text': full_prompt}]}],
        'generationConfig': {'temperature': 0.1},
    }
    r = requests.post(url, headers={'Content-Type': 'application/json'}, json=payload, timeout=180)
    r.raise_for_status()
    data = r.json()
    candidates = data.get('candidates', [])
    parts = candidates[0].get('content', {}).get('parts', []) if candidates else []
    content = '\n'.join(part.get('text', '') for part in parts if 'text' in part).strip()
    return {'model': 'gemini-2.5-flash', 'content': content, 'raw': data}


def main() -> None:
    prompt = build_prompt()
    (CONS_OUT / 'shared_consensus_prompt.md').write_text(prompt, encoding='utf-8')

    results = {}
    for name, func in [('chatgpt', call_openai), ('grok', call_grok), ('gemini', call_gemini)]:
        try:
            result = func(prompt)
        except Exception as exc:
            result = {'error': f'{type(exc).__name__}: {exc}'}
        results[name] = result
        (CONS_OUT / f'{name}_consensus.json').write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
        if 'content' in result:
            (CONS_OUT / f'{name}_consensus.md').write_text(result['content'], encoding='utf-8')

    summary = {
        'models_run': list(results.keys()),
        'success': {k: ('content' in v and bool(v.get('content'))) for k, v in results.items()},
        'output_dir': str(CONS_OUT),
    }
    (CONS_OUT / 'run_summary.json').write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
