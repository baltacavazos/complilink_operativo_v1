import json
import os
import requests
from textwrap import dedent

prompt = dedent('''
Actúa como senior frontend engineer. Estoy corrigiendo una app React + Tailwind.

Problemas en móvil:
1. En Home el header corta el logo y la CTA derecha se sale.
2. En /auditar el logo dentro del hero se desborda hacia la derecha.
3. En /auditar el texto y el CTA secundario se recortan.
4. La tarjeta siguiente queda afectada por ese overflow general.

Fragmentos relevantes:
- Header Home: contenedor flex justify-between; logo con max-w-[min(56vw,18rem)]; CTA móvil visible.
- Hero /auditar: card con p-6; logo <AuditaPatronLogo imageClassName="h-auto w-full max-w-[320px] object-contain sm:max-w-[388px] lg:max-w-[430px]" />
- CTAs /auditar: flex flex-col gap-3 sm:flex-row; botones con px-7; el segundo dice "Iniciar sesión para guardar en mi expediente".
- Tarjeta siguiente: w-full max-w-xl p-5.

Devuélveme JSON válido con esta estructura exacta:
{
  "diagnostico": "string",
  "fixes_prioritarios": ["string", "string", "string", "string", "string"],
  "cambios_tailwind_sugeridos": ["string", "string", "string", "string", "string"],
  "riesgos_al_corregir": ["string", "string", "string"],
  "criterio_de_validacion": "string"
}

Solo JSON.
''').strip()

api_key = os.environ['GEMINI_API_KEY']
models = ['gemini-1.5-flash', 'gemini-2.0-flash']
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
}

for model in models:
    url = f'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}'
    response = requests.post(
        url,
        headers={'Content-Type': 'application/json'},
        json={
            'contents': [{'parts': [{'text': prompt}]}],
            'generationConfig': {
                'temperature': 0.2,
                'responseMimeType': 'application/json',
                'responseSchema': schema,
            },
        },
        timeout=120,
    )
    try:
        body = response.json()
    except Exception:
        body = {'text': response.text}
    if response.ok and body.get('candidates'):
        text = body['candidates'][0]['content']['parts'][0]['text']
        print(json.dumps({'model': model, 'result': json.loads(text)}, ensure_ascii=False, indent=2))
        raise SystemExit(0)

print(json.dumps({'error': 'Gemini unavailable', 'attempts': models, 'last_response': body}, ensure_ascii=False, indent=2))
