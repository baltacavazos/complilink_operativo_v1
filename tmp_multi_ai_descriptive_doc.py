import json
import os
import time
from pathlib import Path

import requests

BASE_DIR = Path('/home/ubuntu/complilink_operativo_v1')
OUT_DIR = BASE_DIR / 'research' / 'descriptive_nontechnical_consensus'
OUT_DIR.mkdir(parents=True, exist_ok=True)

PROMPT = '''
Necesito una recomendación de redacción para un documento DESCRIPTIVO, claro y NO técnico, dirigido a una persona que no conoce el proyecto.

El documento debe explicar de manera fácil de entender:
1. Qué es CompliLink.
2. Qué es Helios.
3. Qué es AuditaPatron.
4. Qué estamos construyendo entre los tres.
5. Por qué podría funcionar en el mercado.
6. Por qué sería difícil de copiar.

Contexto estratégico que sí debe reflejar:
- Helios es el cerebro central del sistema.
- AuditaPatron es un producto independiente orientado al público masivo.
- Las personas suben documentos voluntariamente y eso fortalece el motor Helios.
- CompliLink es la capa más amplia de plataforma/ecosistema.
- Debe sonar optimista, ambicioso, claro y comprensible, pero no exagerado ni técnico.
- Debe servir para audiencia interna no técnica o para alguien nuevo en el proyecto.

Devuelve SOLO JSON válido con esta estructura exacta:
{
  "recommended_angle": "string",
  "plain_language_explanation": {
    "complilink": "string",
    "helios": "string",
    "auditapatron": "string"
  },
  "why_it_works": ["string", "string", "string"],
  "why_hard_to_copy": ["string", "string", "string"],
  "tone_guidance": ["string", "string", "string"],
  "must_include_phrases": ["string", "string", "string"],
  "avoid": ["string", "string", "string"],
  "suggested_structure": ["string", "string", "string", "string", "string"],
  "sample_opening_paragraph": "string"
}
'''.strip()


def save_result(name: str, payload: dict):
    path = OUT_DIR / f'{name}.json'
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f'Saved {path}')


def call_openai():
    api_key = os.getenv('OPENAI_API_KEY')
    if not api_key:
        return {"ok": False, "error": "OPENAI_API_KEY missing"}
    url = 'https://api.openai.com/v1/chat/completions'
    headers = {
        'Authorization': f'Bearer {api_key}',
        'Content-Type': 'application/json',
    }
    body = {
        'model': 'gpt-4.1-mini',
        'response_format': {'type': 'json_object'},
        'messages': [
            {'role': 'system', 'content': 'Eres un estratega de producto y redactor senior. Siempre respondes con JSON válido.'},
            {'role': 'user', 'content': PROMPT},
        ],
        'temperature': 0.7,
    }
    r = requests.post(url, headers=headers, json=body, timeout=120)
    r.raise_for_status()
    data = r.json()
    content = data['choices'][0]['message']['content']
    return {"ok": True, "content": json.loads(content)}


def call_grok():
    api_key = os.getenv('XAI_API_KEY')
    if not api_key:
        return {"ok": False, "error": "XAI_API_KEY missing"}
    url = 'https://api.x.ai/v1/chat/completions'
    headers = {
        'Authorization': f'Bearer {api_key}',
        'Content-Type': 'application/json',
    }
    body = {
        'model': 'grok-4-0709',
        'response_format': {'type': 'json_object'},
        'messages': [
            {'role': 'system', 'content': 'Eres un estratega de producto y redactor senior. Siempre respondes con JSON válido.'},
            {'role': 'user', 'content': PROMPT},
        ],
        'temperature': 0.7,
    }
    r = requests.post(url, headers=headers, json=body, timeout=120)
    r.raise_for_status()
    data = r.json()
    content = data['choices'][0]['message']['content']
    return {"ok": True, "content": json.loads(content)}


def call_gemini(max_attempts: int = 3):
    api_key = os.getenv('GEMINI_API_KEY')
    if not api_key:
        return {"ok": False, "error": "GEMINI_API_KEY missing"}
    url = f'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}'
    headers = {'Content-Type': 'application/json'}
    body = {
        'contents': [
            {
                'parts': [
                    {'text': 'Eres un estratega de producto y redactor senior. Responde SOLO con JSON válido.'},
                    {'text': PROMPT},
                ]
            }
        ],
        'generationConfig': {
            'temperature': 0.7,
            'responseMimeType': 'application/json',
        },
    }
    last_error = None
    for attempt in range(1, max_attempts + 1):
        try:
            r = requests.post(url, headers=headers, json=body, timeout=120)
            r.raise_for_status()
            data = r.json()
            text = data['candidates'][0]['content']['parts'][0]['text']
            return {"ok": True, "content": json.loads(text)}
        except Exception as exc:
            last_error = str(exc)
            time.sleep(min(2 ** attempt, 8))
    return {"ok": False, "error": last_error or 'unknown error'}


if __name__ == '__main__':
    providers = {
        'openai': call_openai,
        'grok': call_grok,
        'gemini': call_gemini,
    }
    for name, fn in providers.items():
        try:
            result = fn()
        except Exception as exc:
            result = {"ok": False, "error": str(exc)}
        save_result(name, result)
