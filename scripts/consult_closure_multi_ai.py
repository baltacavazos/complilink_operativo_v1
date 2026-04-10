import json
import os
import requests
from pathlib import Path

PROMPT = """
Contexto breve de AuditaPatron (México, IMSS/Infonavit):
- Ya existe un flujo /auditar con aceptación de paquete legal versionado antes de permitir carga y revalidación.
- El problema observado fue repetición de intentos al guardar consentimientos de tipo contractType=consent con schemaVersion=auditapatron-legal-mx-v2.0-2026-04.
- El backend actual corta temprano si el paquete legal ya está aceptado y la UI deshabilita el botón mientras la aceptación está pendiente de respuesta, además de bloquear acciones si el paquete legal sigue pendiente.
- También ya está visible en /auditar: revalidación IMSS/Infonavit, explicación del siguiente documento recomendado y línea de tiempo del expediente.
- Falta entregar instrucciones claras para conectar dominios comprados dentro de Manus.

Quiero una respuesta breve y estructurada con este formato JSON estricto:
{
  "model_view": "string corto",
  "bug_fix_assessment": {
    "verdict": "sufficient|partial|risky",
    "why": "string corto",
    "recommended_hardening": ["string", "string"]
  },
  "domain_connection_assessment": {
    "recommended_flow": ["string", "string", "string", "string"],
    "key_watchouts": ["string", "string"]
  },
  "priority_order": ["string", "string", "string"]
}

No expliques de más. Devuelve solo JSON válido.
""".strip()

OUT = Path('/home/ubuntu/complilink_operativo_v1/research/closure_multi_ai')
OUT.mkdir(parents=True, exist_ok=True)


def call_openai():
    key = os.getenv('OPENAI_API_KEY')
    if not key:
        return {"error": "OPENAI_API_KEY missing"}
    url = 'https://api.openai.com/v1/chat/completions'
    headers = {
        'Authorization': f'Bearer {key}',
        'Content-Type': 'application/json',
    }
    data = {
        'model': 'gpt-4.1-mini',
        'temperature': 0.2,
        'response_format': {'type': 'json_object'},
        'messages': [
            {'role': 'system', 'content': 'Eres un arquitecto de producto y backend. Respondes solo JSON válido.'},
            {'role': 'user', 'content': PROMPT},
        ],
    }
    r = requests.post(url, headers=headers, json=data, timeout=60)
    r.raise_for_status()
    content = r.json()['choices'][0]['message']['content']
    return json.loads(content)


def call_gemini():
    key = os.getenv('GEMINI_API_KEY')
    if not key:
        return {"error": "GEMINI_API_KEY missing"}
    url = f'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={key}'
    data = {
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
    }
    r = requests.post(url, json=data, timeout=60)
    r.raise_for_status()
    text = r.json()['candidates'][0]['content']['parts'][0]['text']
    return json.loads(text)


def call_grok():
    key = os.getenv('XAI_API_KEY')
    if not key:
        return {"error": "XAI_API_KEY missing"}
    url = 'https://api.x.ai/v1/chat/completions'
    headers = {
        'Authorization': f'Bearer {key}',
        'Content-Type': 'application/json',
    }
    data = {
        'model': 'grok-4-fast',
        'temperature': 0.2,
        'response_format': {'type': 'json_object'},
        'messages': [
            {'role': 'system', 'content': 'Eres un arquitecto de producto y backend. Respondes solo JSON válido.'},
            {'role': 'user', 'content': PROMPT},
        ],
    }
    r = requests.post(url, headers=headers, json=data, timeout=60)
    r.raise_for_status()
    content = r.json()['choices'][0]['message']['content']
    return json.loads(content)


results = {}
for name, fn in [('chatgpt', call_openai), ('gemini', call_gemini), ('grok', call_grok)]:
    try:
        results[name] = fn()
    except Exception as exc:
        results[name] = {'error': f'{type(exc).__name__}: {exc}'}

(OUT / 'results.json').write_text(json.dumps(results, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps(results, ensure_ascii=False, indent=2))
