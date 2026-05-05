import json
import os
from pathlib import Path

import requests

BASE_DIR = Path('/home/ubuntu/complilink_operativo_v1')
OUT_PATH = BASE_DIR / 'final_ui_polish_model_compare.json'

prompt = '''
Eres un experto en UX writing móvil para una plataforma legal-laboral mexicana llamada Auditapatrón.

Necesito que propongas microcopy más corto, claro y confiable para tres superficies. El tono debe ser cercano, institucional y nada técnico. No uses lenguaje interno de producto ni palabras como tenant_id, case_id, trace_id, owner, intake o federado. Debe sonar humano, serio y fácil de entender en celular.

Objetivo: reducir saturación verbal, hacer más limpio el primer pantallazo y bajar el peso visual de CTAs secundarias.

Superficie 1: /auditar hero móvil
- Pill actual: "Revisión rápida, clara y privada"
- Título actual: "Empieza sin correo"
- Párrafo actual: "Empieza con una foto, PDF o XML. Primero verás qué documento llegó, qué señal apareció y cuál es el siguiente paso útil. Sólo te pediremos correo si decides guardar ese hallazgo en tu bóveda laboral."
- CTA principal actual: "Empezar lectura gratis"
- CTA secundaria actual: "Iniciar sesión para guardar" / "Iniciar sesión para guardar en mi expediente"

Superficie 2: acceso privado / login del layout
- Título actual: "Acceso seguro y unificado"
- Párrafo actual: "Esta plataforma protege expedientes laborales multi-tenant con trazabilidad integral por tenant_id, case_id y trace_id. Inicia sesión con Manus, Google o un código enviado por correo para abrir el panel privado del owner, gestionar casos y operar el intake documental seguro."
- Caja secundaria actual: "Entorno diseñado para contexto corporativo mexicano, cumplimiento, auditoría defensible y acceso federado."
- CTA actual: "Iniciar sesión"

Superficie 3: bloqueo por acceso restringido CEO
- Etiqueta actual: "Acceso restringido"
- Título actual: "Este expediente privado sólo está disponible para el owner autorizado."
- Párrafo actual: "Tu sesión está autenticada, pero no coincide con la identidad maestra autorizada para esta superficie privada. Si este acceso debe revisarse, confirma primero la identidad del owner y después valida permisos internos."

Devuélveme JSON válido con esta estructura exacta:
{
  "diagnosis": ["max 4 hallazgos breves"],
  "auditar": {
    "pill": "...",
    "title": "...",
    "body": "...",
    "primary_cta": "...",
    "secondary_cta": "..."
  },
  "private_access": {
    "title": "...",
    "body": "...",
    "supporting_box": "...",
    "primary_cta": "..."
  },
  "ceo_restricted": {
    "eyebrow": "...",
    "title": "...",
    "body": "..."
  },
  "extra_ui_notes": ["max 4 sugerencias de interfaz muy concretas y breves"]
}
'''.strip()


def post_openai():
    api_key = os.environ.get('OPENAI_API_KEY')
    if not api_key:
        return {'error': 'OPENAI_API_KEY missing'}
    response = requests.post(
        'https://api.openai.com/v1/chat/completions',
        headers={
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json',
        },
        json={
            'model': 'gpt-4.1-mini',
            'temperature': 0.4,
            'response_format': {'type': 'json_object'},
            'messages': [
                {'role': 'system', 'content': 'Responde únicamente con JSON válido.'},
                {'role': 'user', 'content': prompt},
            ],
        },
        timeout=120,
    )
    response.raise_for_status()
    data = response.json()
    content = data['choices'][0]['message']['content']
    return json.loads(content)


def post_xai():
    api_key = os.environ.get('XAI_API_KEY')
    if not api_key:
        return {'error': 'XAI_API_KEY missing'}
    response = requests.post(
        'https://api.x.ai/v1/chat/completions',
        headers={
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json',
        },
        json={
            'model': 'grok-4',
            'temperature': 0.4,
            'response_format': {'type': 'json_object'},
            'messages': [
                {'role': 'system', 'content': 'Responde únicamente con JSON válido.'},
                {'role': 'user', 'content': prompt},
            ],
        },
        timeout=120,
    )
    response.raise_for_status()
    data = response.json()
    content = data['choices'][0]['message']['content']
    return json.loads(content)


def post_gemini():
    api_key = os.environ.get('GEMINI_API_KEY')
    if not api_key:
        return {'error': 'GEMINI_API_KEY missing'}
    response = requests.post(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
        params={'key': api_key},
        headers={'Content-Type': 'application/json'},
        json={
            'generationConfig': {
                'temperature': 0.4,
                'responseMimeType': 'application/json',
            },
            'contents': [
                {
                    'role': 'user',
                    'parts': [{'text': prompt}],
                }
            ],
        },
        timeout=120,
    )
    response.raise_for_status()
    data = response.json()
    text = data['candidates'][0]['content']['parts'][0]['text']
    return json.loads(text)


results = {}
for name, fn in [('chatgpt', post_openai), ('grok', post_xai), ('gemini', post_gemini)]:
    try:
        results[name] = fn()
    except Exception as exc:
        results[name] = {'error': str(exc)}

OUT_PATH.write_text(json.dumps(results, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(str(OUT_PATH))
