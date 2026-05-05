import json
import os
import requests
from textwrap import dedent

PROMPT = dedent('''
Actúa como front-end design engineer senior especializado en React, Tailwind y layout responsive móvil.

Estoy corrigiendo una plataforma con estos síntomas en iPhone:
1. En la home móvil, el header corta el logo y la CTA derecha se sale del viewport.
2. En /auditar móvil, el wordmark dentro del hero se desborda hacia la derecha.
3. En /auditar móvil, el texto descriptivo y el CTA secundario se recortan horizontalmente.
4. La tarjeta siguiente del flujo empieza ya comprometida por ese desborde general.

Fragmento relevante del hero de /auditar:
- Contenedor: main px-4 -> container max-w-6xl -> card p-6 rounded 2rem -> grid lg:grid-cols
- Logo: <AuditaPatronLogo className="inline-flex" imageClassName="h-auto w-full max-w-[320px] object-contain sm:max-w-[388px] lg:max-w-[430px]" />
- Chip: inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm
- H1: text-3xl sm:text-4xl
- Párrafo: max-w-2xl text-base sm:text-lg
- CTAs: flex flex-col gap-3 sm:flex-row, botones con px-7, uno de ellos dice "Iniciar sesión para guardar en mi expediente"
- Tarjeta lateral: w-full max-w-xl p-5 con items flex gap-3

Fragmento relevante del header de Home:
- contenedor header: flex h-[4.55rem] max-w-[1380px] items-center justify-between gap-1.5
- logo: AuditaPatronLogoWordmark con imageClassName "!h-9 w-auto max-w-[min(56vw,18rem)] ..."
- CTA derecha visible en móvil

Dame JSON válido con esta estructura exacta:
{
  "diagnostico": "string",
  "fixes_prioritarios": ["string", "string", "string", "string", "string"],
  "cambios_tailwind_sugeridos": ["string", "string", "string", "string", "string"],
  "riesgos_al_corregir": ["string", "string", "string"],
  "criterio_de_validacion": "string"
}

Quiero recomendaciones concretas, aplicables y conservadoras para no romper escritorio.
Responde solo con JSON.
''').strip()


def call_openai():
    api_key = os.environ.get('OPENAI_API_KEY')
    if not api_key:
        return {'error': 'OPENAI_API_KEY no disponible'}
    r = requests.post(
        'https://api.openai.com/v1/chat/completions',
        headers={'Authorization': f'Bearer {api_key}', 'Content-Type': 'application/json'},
        json={
            'model': 'gpt-4.1-mini',
            'temperature': 0.2,
            'response_format': {'type': 'json_object'},
            'messages': [
                {'role': 'system', 'content': 'Responde solo con JSON válido.'},
                {'role': 'user', 'content': PROMPT},
            ],
        },
        timeout=120,
    )
    return {'status_code': r.status_code, 'body': r.json()}


def call_grok():
    api_key = os.environ.get('XAI_API_KEY')
    if not api_key:
        return {'error': 'XAI_API_KEY no disponible'}
    r = requests.post(
        'https://api.x.ai/v1/chat/completions',
        headers={'Authorization': f'Bearer {api_key}', 'Content-Type': 'application/json'},
        json={
            'model': 'grok-3-mini',
            'temperature': 0.2,
            'response_format': {'type': 'json_object'},
            'messages': [
                {'role': 'system', 'content': 'Responde solo con JSON válido.'},
                {'role': 'user', 'content': PROMPT},
            ],
        },
        timeout=120,
    )
    try:
        body = r.json()
    except Exception:
        body = {'text': r.text}
    return {'status_code': r.status_code, 'body': body}


def call_gemini():
    api_key = os.environ.get('GEMINI_API_KEY')
    if not api_key:
        return {'error': 'GEMINI_API_KEY no disponible'}
    schema = {
        'type': 'OBJECT',
        'properties': {
            'diagnostico': {'type': 'STRING'},
            'fixes_prioritarios': {'type': 'ARRAY', 'items': {'type': 'STRING'}},
            'cambios_tailwind_sugeridos': {'type': 'ARRAY', 'items': {'type': 'STRING'}},
            'riesgos_al_corregir': {'type': 'ARRAY', 'items': {'type': 'STRING'}},
            'criterio_de_validacion': {'type': 'STRING'},
        },
        'required': ['diagnostico', 'fixes_prioritarios', 'cambios_tailwind_sugeridos', 'riesgos_al_corregir', 'criterio_de_validacion'],
        'propertyOrdering': ['diagnostico', 'fixes_prioritarios', 'cambios_tailwind_sugeridos', 'riesgos_al_corregir', 'criterio_de_validacion'],
    }
    r = requests.post(
        f'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}',
        headers={'Content-Type': 'application/json'},
        json={
            'contents': [{'parts': [{'text': PROMPT}]}],
            'generationConfig': {
                'temperature': 0.2,
                'responseMimeType': 'application/json',
                'responseSchema': schema,
            },
        },
        timeout=120,
    )
    try:
        body = r.json()
    except Exception:
        body = {'text': r.text}
    return {'status_code': r.status_code, 'body': body}


def extract_openai(data):
    try:
        return json.loads(data['body']['choices'][0]['message']['content'])
    except Exception as e:
        return {'parse_error': str(e), 'raw': data}


def extract_grok(data):
    try:
        return json.loads(data['body']['choices'][0]['message']['content'])
    except Exception as e:
        return {'parse_error': str(e), 'raw': data}


def extract_gemini(data):
    try:
        return json.loads(data['body']['candidates'][0]['content']['parts'][0]['text'])
    except Exception as e:
        return {'parse_error': str(e), 'raw': data}


openai_raw = call_openai()
grok_raw = call_grok()
gemini_raw = call_gemini()

result = {
    'openai': extract_openai(openai_raw) if 'body' in openai_raw else openai_raw,
    'grok': extract_grok(grok_raw) if 'body' in grok_raw else grok_raw,
    'gemini': extract_gemini(gemini_raw) if 'body' in gemini_raw else gemini_raw,
    'raw_meta': {
        'openai_status': openai_raw.get('status_code'),
        'grok_status': grok_raw.get('status_code'),
        'gemini_status': gemini_raw.get('status_code'),
    },
}
print(json.dumps(result, ensure_ascii=False, indent=2))
