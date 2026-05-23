import json
import os
from pathlib import Path

import requests

PROJECT_DIR = Path('/home/ubuntu/complilink_operativo_v1')
OUTPUT_PATH = PROJECT_DIR / 'tmp_store_marketing_multiai.json'

context_parts = []
for rel in [
    'MOBILE_STORE_READINESS.md',
    'tmp_store_assets_findings.md',
    'store-assets/README.md',
]:
    path = PROJECT_DIR / rel
    if path.exists():
        context_parts.append(f'## FILE: {rel}\n' + path.read_text(encoding='utf-8'))

context = '\n\n'.join(context_parts)

prompt = f'''Eres un estratega senior de App Store Optimization y dirección de arte para apps móviles en español de México.

Necesito una propuesta FINAL y utilizable para Auditapatron, una app móvil/web enfocada en trabajadores en México para subir un recibo o documento laboral y entender rápidamente qué conviene revisar. La identidad visual existente usa fondo verde claro, azul grisáceo oscuro, texto muy oscuro y acento turquesa. El tono debe sentirse serio, confiable, claro, humano y simple; no legalista ni técnico.

Con base en el contexto de producto y assets ya generados abajo, devuelve exclusivamente JSON válido con esta estructura exacta:
{{
  "store_positioning": {{
    "core_promise": "string",
    "tone": "string",
    "do_not_say": ["string", "string", "string"]
  }},
  "screenshot_direction": {{
    "visual_principles": ["string", "string", "string", "string"],
    "headline_set": [
      {{"order": 1, "headline": "string", "subheadline": "string"}},
      {{"order": 2, "headline": "string", "subheadline": "string"}},
      {{"order": 3, "headline": "string", "subheadline": "string"}},
      {{"order": 4, "headline": "string", "subheadline": "string"}}
    ],
    "icon_refinement": "string",
    "splash_refinement": "string"
  }},
  "app_store_copy": {{
    "app_name_options": ["string", "string", "string"],
    "subtitle_options": ["string", "string", "string"],
    "keywords_es_mx": ["string", "string", "string", "string", "string", "string", "string", "string"]
  }},
  "google_play_copy": {{
    "short_description_options": ["string", "string", "string"],
    "long_description_paragraphs": ["string", "string", "string", "string"]
  }},
  "rationale": {{
    "why_this_will_convert": "string",
    "main_risk": "string",
    "mitigation": "string"
  }}
}}

Reglas:
1. Todo en español de México.
2. Debe ser usable para tiendas, no poesía ni manifiesto.
3. Debe destacar simplicidad, privacidad, claridad y utilidad inmediata.
4. No prometas resultados legales garantizados, dinero recuperado ni asesoría definitiva.
5. No menciones Apple Sign-In ni temas técnicos internos.
6. Headlines de screenshots: máximo 7 palabras por headline idealmente.
7. Subheadlines: una frase breve y clara.
8. Las palabras clave deben ser aptas para ASO y sonar naturales.

CONTEXTO:\n{context}
'''


def call_openai(prompt_text: str):
    api_key = os.environ.get('OPENAI_API_KEY')
    if not api_key:
        return {"error": "OPENAI_API_KEY missing"}
    resp = requests.post(
        'https://api.openai.com/v1/chat/completions',
        headers={
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json',
        },
        json={
            'model': 'gpt-4.1-mini',
            'temperature': 0.7,
            'response_format': {'type': 'json_object'},
            'messages': [
                {'role': 'system', 'content': 'Responde solo JSON válido.'},
                {'role': 'user', 'content': prompt_text},
            ],
        },
        timeout=120,
    )
    resp.raise_for_status()
    data = resp.json()
    return json.loads(data['choices'][0]['message']['content'])


def call_xai(prompt_text: str):
    api_key = os.environ.get('XAI_API_KEY')
    if not api_key:
        return {"error": "XAI_API_KEY missing"}
    resp = requests.post(
        'https://api.x.ai/v1/chat/completions',
        headers={
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json',
        },
        json={
            'model': 'grok-3-mini',
            'temperature': 0.7,
            'response_format': {'type': 'json_object'},
            'messages': [
                {'role': 'system', 'content': 'Responde solo JSON válido.'},
                {'role': 'user', 'content': prompt_text},
            ],
        },
        timeout=120,
    )
    resp.raise_for_status()
    data = resp.json()
    return json.loads(data['choices'][0]['message']['content'])


def call_gemini(prompt_text: str):
    api_key = os.environ.get('GEMINI_API_KEY')
    if not api_key:
        return {"error": "GEMINI_API_KEY missing"}
    url = f'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}'
    body = {
        'generationConfig': {
            'temperature': 0.7,
            'responseMimeType': 'application/json',
        },
        'contents': [
            {
                'role': 'user',
                'parts': [{'text': prompt_text}],
            }
        ],
    }
    resp = requests.post(url, headers={'Content-Type': 'application/json'}, json=body, timeout=120)
    resp.raise_for_status()
    data = resp.json()
    text = data['candidates'][0]['content']['parts'][0]['text']
    return json.loads(text)


results = {}
for name, fn in [
    ('openai', call_openai),
    ('grok', call_xai),
    ('gemini', call_gemini),
]:
    try:
        results[name] = fn(prompt)
    except Exception as exc:
        results[name] = {'error': str(exc)}

OUTPUT_PATH.write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding='utf-8')
print(str(OUTPUT_PATH))
