import json
import os
import requests
from pathlib import Path

BASE = Path('/home/ubuntu/complilink_operativo_v1')
AUDIT_PATH = BASE / 'audit' / 'auditoria_consenso_mobile_first.md'
OUT_DIR = BASE / 'audit' / 'round1_consensus'
OUT_DIR.mkdir(parents=True, exist_ok=True)

audit_text = AUDIT_PATH.read_text(encoding='utf-8')

prompt = f"""
Eres un auditor senior de producto digital enfocado en UX/UI mobile-first para una app llamada AuditaPatron.

Necesito que propongas la RONDA 1 de implementación con máximo impacto, pero con cambios realizables en una sola iteración de código.

Contexto y auditoría consensuada:
{audit_text}

Restricciones:
1. /auditar es la prioridad máxima y debe ser mobile-first.
2. /ceo debe priorizar desktop, no móvil.
3. /acceso debe verse como una pantalla de iniciar sesión, no como una segunda homepage.
4. La home debe compactarse sin perder confianza ni claridad.
5. No menciones marcas competidoras.
6. No destruyas el tono serio y profesional.
7. Propón cambios concretos de interfaz y jerarquía, no teoría general.
8. Responde en español.

Devuélveme JSON válido con esta estructura exacta:
{{
  "score_target_after_round1": "texto corto con rango esperado",
  "auditar": {{
    "must_do": ["..."],
    "should_collapse_or_defer": ["..."],
    "mobile_top_fold": ["..."]
  }},
  "home": {{
    "must_do": ["..."],
    "compress_or_move": ["..."]
  }},
  "access": {{
    "must_do": ["..."],
    "remove_or_reduce": ["..."]
  }},
  "ceo": {{
    "desktop_priority": ["..."],
    "mobile_degradation": ["..."]
  }},
  "technical_blocker": {{
    "issue": "...",
    "recommendation": "..."
  }},
  "single_sentence_strategy": "..."
}}
""".strip()


def post_openai():
    api_key = os.environ.get('OPENAI_API_KEY')
    if not api_key:
        return {'error': 'OPENAI_API_KEY missing'}
    url = 'https://api.openai.com/v1/chat/completions'
    payload = {
        'model': 'gpt-4.1-mini',
        'response_format': {'type': 'json_object'},
        'messages': [
            {'role': 'system', 'content': 'Eres un experto en producto digital, UX mobile-first y sistemas web robustos.'},
            {'role': 'user', 'content': prompt},
        ],
        'temperature': 0.2,
    }
    resp = requests.post(url, headers={'Authorization': f'Bearer {api_key}', 'Content-Type': 'application/json'}, json=payload, timeout=120)
    return {'status_code': resp.status_code, 'body': resp.json()}


def post_grok():
    api_key = os.environ.get('XAI_API_KEY')
    if not api_key:
        return {'error': 'XAI_API_KEY missing'}
    url = 'https://api.x.ai/v1/chat/completions'
    payload = {
        'model': 'grok-3-mini',
        'response_format': {'type': 'json_object'},
        'messages': [
            {'role': 'system', 'content': 'Eres un experto en producto digital, UX mobile-first y sistemas web robustos.'},
            {'role': 'user', 'content': prompt},
        ],
        'temperature': 0.2,
    }
    resp = requests.post(url, headers={'Authorization': f'Bearer {api_key}', 'Content-Type': 'application/json'}, json=payload, timeout=120)
    return {'status_code': resp.status_code, 'body': resp.json()}


def post_gemini():
    api_key = os.environ.get('GEMINI_API_KEY')
    if not api_key:
        return {'error': 'GEMINI_API_KEY missing'}
    url = f'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}'
    payload = {
        'generationConfig': {
            'temperature': 0.2,
            'responseMimeType': 'application/json',
        },
        'contents': [
            {
                'role': 'user',
                'parts': [{'text': prompt}],
            }
        ],
        'systemInstruction': {
            'parts': [{'text': 'Eres un experto en producto digital, UX mobile-first y sistemas web robustos.'}]
        },
    }
    resp = requests.post(url, headers={'Content-Type': 'application/json'}, json=payload, timeout=120)
    try:
        body = resp.json()
    except Exception:
        body = {'raw_text': resp.text}
    return {'status_code': resp.status_code, 'body': body}


def extract_content(result, provider):
    if 'error' in result:
        return result
    try:
        if provider == 'openai':
            content = result['body']['choices'][0]['message']['content']
        elif provider == 'grok':
            content = result['body']['choices'][0]['message']['content']
        else:
            content = result['body']['candidates'][0]['content']['parts'][0]['text']
        parsed = json.loads(content)
        return {'status_code': result['status_code'], 'parsed': parsed, 'raw': content}
    except Exception as exc:
        return {'status_code': result.get('status_code'), 'error': str(exc), 'body': result.get('body')}


results = {
    'chatgpt': extract_content(post_openai(), 'openai'),
    'grok': extract_content(post_grok(), 'grok'),
    'gemini': extract_content(post_gemini(), 'gemini'),
}

for name, payload in results.items():
    (OUT_DIR / f'{name}_round1.json').write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding='utf-8')

print(json.dumps(results, ensure_ascii=False, indent=2))
