import json
import os
import textwrap
from pathlib import Path

import requests

BASE = Path('/home/ubuntu/complilink_operativo_v1/audit')
PAGE_TEXTS = Path('/home/ubuntu/page_texts')
OUT = BASE / 'outputs'
OUT.mkdir(parents=True, exist_ok=True)

PROMPT_FILE = BASE / 'multi_ai_mobile_audit_prompt.md'
NOTES_FILE = BASE / 'mobile_audit_context_notes.md'
LIVE_NOTES_FILE = BASE / 'post_round1_live_notes.md'
HOME_FILE = PAGE_TEXTS / '3000-igw07p7g2fg0o552njwun-6f266027.us2.manus.computer.md'
AUDITAR_FILE = PAGE_TEXTS / '3000-igw07p7g2fg0o552njwun-6f266027.us2.manus.computer_auditar.md'
CEO_FILE = PAGE_TEXTS / '3000-igw07p7g2fg0o552njwun-6f266027.us2.manus.computer_ceo.md'
ACCESO_FILE = PAGE_TEXTS / '3000-igw07p7g2fg0o552njwun-6f266027.us2.manus.computer_acceso.md'
APP_FILE = Path('/home/ubuntu/complilink_operativo_v1/client/src/App.tsx')
AUDITAR_SOURCE = Path('/home/ubuntu/complilink_operativo_v1/client/src/pages/Auditar.tsx')
ACCESS_SOURCE = Path('/home/ubuntu/complilink_operativo_v1/client/src/pages/Access.tsx')
CEO_SOURCE = Path('/home/ubuntu/complilink_operativo_v1/client/src/pages/CeoDashboard.tsx')


def safe_read(path: Path, limit: int | None = None) -> str:
    text = path.read_text(encoding='utf-8')
    if limit:
        return text[:limit]
    return text


def build_context() -> str:
    sections = {
        'PROMPT_BASE': safe_read(PROMPT_FILE),
        'NOTAS_DEL_MODERADOR': safe_read(NOTES_FILE),
        'NOTAS_DE_VALIDACION_VIVA': safe_read(LIVE_NOTES_FILE),
        'MAPA_DE_RUTAS_APP_TSX': safe_read(APP_FILE, 12000),
        'FUENTE_AUDITAR_TSX': safe_read(AUDITAR_SOURCE, 18000),
        'FUENTE_ACCESS_TSX': safe_read(ACCESS_SOURCE, 18000),
        'FUENTE_CEO_TSX': safe_read(CEO_SOURCE, 18000),
        'TEXTO_HOME': safe_read(HOME_FILE, 16000),
        'TEXTO_AUDITAR': safe_read(AUDITAR_FILE, 16000),
        'TEXTO_CEO': safe_read(CEO_FILE, 16000),
        'TEXTO_ACCESO': safe_read(ACCESO_FILE, 16000),
    }
    blocks = []
    for name, content in sections.items():
        blocks.append(f'## {name}\n\n{content}')
    return '\n\n'.join(blocks)


SYSTEM_MSG = (
    'Eres un auditor senior de producto digital. Analizas con severidad profesional, '
    'prioridad mobile-first y foco en claridad, confianza, jerarquía visual, arquitectura visible y robustez percibida.'
)


def call_openai(full_prompt: str) -> dict:
    api_key = os.environ.get('OPENAI_API_KEY')
    if not api_key:
        return {'error': 'OPENAI_API_KEY no disponible'}
    url = 'https://api.openai.com/v1/chat/completions'
    payload = {
        'model': 'gpt-4.1',
        'temperature': 0.2,
        'messages': [
            {'role': 'system', 'content': SYSTEM_MSG},
            {'role': 'user', 'content': full_prompt},
        ],
    }
    r = requests.post(url, headers={'Authorization': f'Bearer {api_key}', 'Content-Type': 'application/json'}, json=payload, timeout=180)
    r.raise_for_status()
    data = r.json()
    content = data['choices'][0]['message']['content']
    return {'model': 'gpt-4.1', 'content': content, 'raw': data}


def call_grok(full_prompt: str) -> dict:
    api_key = os.environ.get('XAI_API_KEY')
    if not api_key:
        return {'error': 'XAI_API_KEY no disponible'}
    url = 'https://api.x.ai/v1/chat/completions'
    payload = {
        'model': 'grok-4',
        'temperature': 0.2,
        'messages': [
            {'role': 'system', 'content': SYSTEM_MSG},
            {'role': 'user', 'content': full_prompt},
        ],
    }
    r = requests.post(url, headers={'Authorization': f'Bearer {api_key}', 'Content-Type': 'application/json'}, json=payload, timeout=180)
    r.raise_for_status()
    data = r.json()
    content = data['choices'][0]['message']['content']
    return {'model': 'grok-4', 'content': content, 'raw': data}


def call_gemini(full_prompt: str) -> dict:
    api_key = os.environ.get('GEMINI_API_KEY')
    if not api_key:
        return {'error': 'GEMINI_API_KEY no disponible'}
    url = f'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}'
    payload = {
        'system_instruction': {'parts': [{'text': SYSTEM_MSG}]},
        'contents': [
            {
                'role': 'user',
                'parts': [{'text': full_prompt}],
            }
        ],
        'generationConfig': {
            'temperature': 0.2,
        },
    }
    r = requests.post(url, headers={'Content-Type': 'application/json'}, json=payload, timeout=180)
    r.raise_for_status()
    data = r.json()
    candidates = data.get('candidates', [])
    text_parts = []
    if candidates:
        for part in candidates[0].get('content', {}).get('parts', []):
            if 'text' in part:
                text_parts.append(part['text'])
    content = '\n'.join(text_parts).strip()
    return {'model': 'gemini-2.5-flash', 'content': content, 'raw': data}


def main() -> None:
    full_prompt = build_context()
    (OUT / 'shared_prompt_compiled.md').write_text(full_prompt, encoding='utf-8')

    results = {}
    for name, func in [('chatgpt', call_openai), ('grok', call_grok), ('gemini', call_gemini)]:
        try:
            result = func(full_prompt)
        except Exception as exc:
            result = {'error': f'{type(exc).__name__}: {exc}'}
        results[name] = result
        (OUT / f'{name}_audit.json').write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
        if 'content' in result:
            (OUT / f'{name}_audit.md').write_text(result['content'], encoding='utf-8')

    summary = {
        'models_run': list(results.keys()),
        'success': {k: ('content' in v and bool(v.get('content'))) for k, v in results.items()},
        'output_dir': str(OUT),
    }
    (OUT / 'run_summary.json').write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
