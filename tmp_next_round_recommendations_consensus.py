import json
import os
import sys
import urllib.request
import urllib.error
from pathlib import Path

project_root = Path('/home/ubuntu/complilink_operativo_v1')
output_path = project_root / 'tmp_next_round_recommendations_consensus.json'

brief = '''
Actúa como estratega senior de UX y conversión para Auditapatron.
Contexto del producto: plataforma para trabajadores en México que suben su recibo o comprobante y reciben una lectura inicial simple sobre qué revisar en su pago.
Objetivo: hacer la experiencia extremadamente intuitiva para cualquier trabajador de a pie en México.

Estado actual visible:
1. Home
- Header con navegación simple y botones "Entrar" y "Revisa tu recibo gratis".
- Hero principal: "Sube tu recibo y te decimos qué revisar."
- Subcopy: "Sube tu recibo o comprobante y te mostramos lo más importante. Empieza con un solo archivo y entiende rápido si hay algo raro o pendiente. Primero ves el resultado. Si te sirve, luego decides si lo guardas."
- Existe un ejemplo de resultado visual con estados como: "Señal encontrada: tu pago podría no coincidir", "Qué revisar primero en tu pago", y "Recibo detectado: ya vimos lo más importante".
- Hay recomendación de documento inicial y un CTA principal.

2. Auditar
- Hero superior: "Sube tu recibo o comprobante".
- Copy: "Sube una foto o PDF. Primero te mostraremos lo importante y qué hacer después."
- Bloque principal de carga: "Sube tu recibo y empieza la revisión" / "En cuanto lo subas, empezamos a revisarlo."
- Se ocultaron varias capas técnicas, pero aún existe estructura amplia del flujo y áreas posteriores con más contenido.

3. Access
- Encabezado: "Entrar con correo y seguir donde te quedaste".
- Copy: "Escribe tu correo, recibe un código de 6 dígitos y vuelves directo... Aquí solo resolvemos el acceso."

Recomendaciones ya autorizadas por el usuario y que necesito priorizar bien:
A) simplificar todavía más el ejemplo de resultado para que muestre una sola señal por vista;
B) incorporar un microvideo corto de 15 a 20 segundos junto al CTA principal;
C) automatizar una validación del primer flujo: entrar, subir recibo y llegar a la lectura inicial.

Quiero una respuesta JSON estricta con esta forma:
{
  "overall_recommendation": "string",
  "priority_order": ["A", "B", "C"],
  "home_changes": ["string", "string", "string"],
  "video_recommendation": {
    "should_add": true,
    "best_format": "string",
    "placement": "string",
    "script": ["string", "string", "string", "string"],
    "risks": ["string", "string"]
  },
  "result_demo_recommendation": {
    "best_structure": "string",
    "slides_or_states": ["string", "string", "string"],
    "what_to_remove": ["string", "string", "string"]
  },
  "validation_recommendation": {
    "best_test_type": "string",
    "critical_steps": ["string", "string", "string", "string"],
    "notes": ["string", "string"]
  },
  "copy_rules": ["string", "string", "string", "string"],
  "confidence": 0
}

Responde solo JSON válido.
'''

MODELS = {
    'chatgpt': {
        'url': 'https://api.openai.com/v1/chat/completions',
        'key': os.environ.get('OPENAI_API_KEY'),
        'headers': lambda key: {
            'Authorization': f'Bearer {key}',
            'Content-Type': 'application/json',
        },
        'payload': lambda: {
            'model': 'gpt-4.1-mini',
            'temperature': 0.2,
            'response_format': {'type': 'json_object'},
            'messages': [
                {'role': 'system', 'content': 'Eres un experto en UX, conversion y lenguaje claro para trabajadores mexicanos. Responde solo JSON válido.'},
                {'role': 'user', 'content': brief},
            ],
        },
        'extract': lambda data: data['choices'][0]['message']['content'],
    },
    'grok': {
        'url': 'https://api.x.ai/v1/chat/completions',
        'key': os.environ.get('XAI_API_KEY'),
        'headers': lambda key: {
            'Authorization': f'Bearer {key}',
            'Content-Type': 'application/json',
        },
        'payload': lambda: {
            'model': 'grok-3-mini',
            'temperature': 0.2,
            'response_format': {'type': 'json_object'},
            'messages': [
                {'role': 'system', 'content': 'Eres un experto en UX, conversion y lenguaje claro para trabajadores mexicanos. Responde solo JSON válido.'},
                {'role': 'user', 'content': brief},
            ],
        },
        'extract': lambda data: data['choices'][0]['message']['content'],
    },
    'gemini': {
        'url': 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
        'key': os.environ.get('GEMINI_API_KEY'),
        'headers': lambda key: {
            'x-goog-api-key': key,
            'Content-Type': 'application/json',
        },
        'payload': lambda: {
            'generationConfig': {
                'temperature': 0.2,
                'responseMimeType': 'application/json',
            },
            'systemInstruction': {
                'parts': [{'text': 'Eres un experto en UX, conversion y lenguaje claro para trabajadores mexicanos. Responde solo JSON válido.'}]
            },
            'contents': [
                {
                    'role': 'user',
                    'parts': [{'text': brief}],
                }
            ],
        },
        'extract': lambda data: data['candidates'][0]['content']['parts'][0]['text'],
    },
}


def post_json(url, headers, payload):
    data = json.dumps(payload).encode('utf-8')
    req = urllib.request.Request(url, data=data, headers=headers, method='POST')
    with urllib.request.urlopen(req, timeout=90) as resp:
        return json.loads(resp.read().decode('utf-8'))


def parse_json_text(text):
    text = text.strip()
    if text.startswith('```'):
        text = text.strip('`')
        if text.startswith('json'):
            text = text[4:].strip()
    return json.loads(text)


results = {}
for name, cfg in MODELS.items():
    key = cfg['key']
    if not key:
        results[name] = {'ok': False, 'error': 'missing_api_key'}
        continue
    try:
        raw = post_json(cfg['url'], cfg['headers'](key), cfg['payload']())
        text = cfg['extract'](raw)
        parsed = parse_json_text(text)
        results[name] = {'ok': True, 'response': parsed}
    except urllib.error.HTTPError as e:
        try:
            body = e.read().decode('utf-8')
        except Exception:
            body = ''
        results[name] = {'ok': False, 'error': f'http_{e.code}', 'body': body[:2000]}
    except Exception as e:
        results[name] = {'ok': False, 'error': str(e)}

output_path.write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding='utf-8')
print(str(output_path))
