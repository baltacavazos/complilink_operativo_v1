import base64
import json
import mimetypes
import os
from io import BytesIO
from pathlib import Path

import requests
from PIL import Image

SCREENSHOT = max(
    Path('/home/ubuntu/screenshots').glob('3000-igw07p7g2fg0o55_*.webp'),
    key=lambda path: path.stat().st_mtime,
)
OUTPUT = Path('/home/ubuntu/complilink_operativo_v1/tmp/round6_multi_ai_audit.json')
OUTPUT.parent.mkdir(parents=True, exist_ok=True)

prompt = '''Evalúa esta pantalla móvil de post-subida para AuditaPatron.

Importante:
- Ignora cualquier banner, marco o mensaje del entorno de previsualización del navegador que no pertenezca a la UI del producto.
- Si existe una franja fija externa al producto en la parte inferior, no la uses para penalizar la pantalla.

Contexto de producto:
- La prioridad es que el usuario vea rápido el veredicto principal y el siguiente paso.
- Debe sentirse extremadamente simple, confiable y sin ruido.
- El objetivo de esta ronda es acercarse a una experiencia 9/10 en claridad móvil.

Quiero una respuesta JSON estricta con este esquema:
{
  "model": "nombre del modelo",
  "score": 0-10,
  "verdict": "one short sentence",
  "strengths": ["max 4 strings"],
  "frictions": ["max 4 strings"],
  "top_fix": "single best next change",
  "is_nine_or_more": true
}

Criterios de evaluación:
1. Qué tan pronto se entiende el resultado.
2. Qué tan visible queda el siguiente paso principal.
3. Qué tanto ruido secundario sigue compitiendo en el primer viewport.
4. Qué tan confiable y clara se siente la experiencia móvil.

Sé severo pero práctico. No evalúes el producto entero; solo esta pantalla.''' 

mime = 'image/png'
with Image.open(SCREENSHOT) as img:
    crop_top = min(18, max(0, img.height // 40))
    crop_bottom = min(120, max(96, img.height // 6))
    top = min(crop_top, img.height - 1)
    bottom = max(top + 1, img.height - crop_bottom)
    cropped = img.crop((0, top, img.width, bottom))
    buffer = BytesIO()
    cropped.save(buffer, format='PNG')
img_bytes = buffer.getvalue()
img_b64 = base64.b64encode(img_bytes).decode('utf-8')
data_uri = f'data:{mime};base64,{img_b64}'


def call_openai():
    key = os.environ.get('OPENAI_API_KEY')
    if not key:
        return {'model': 'openai', 'error': 'OPENAI_API_KEY missing'}
    url = 'https://api.openai.com/v1/chat/completions'
    payload = {
        'model': 'gpt-4.1-mini',
        'response_format': {'type': 'json_object'},
        'messages': [
            {
                'role': 'user',
                'content': [
                    {'type': 'text', 'text': prompt},
                    {'type': 'image_url', 'image_url': {'url': data_uri}},
                ],
            }
        ],
        'temperature': 0.2,
        'max_tokens': 500,
    }
    r = requests.post(url, headers={'Authorization': f'Bearer {key}', 'Content-Type': 'application/json'}, json=payload, timeout=90)
    r.raise_for_status()
    content = r.json()['choices'][0]['message']['content']
    parsed = json.loads(content)
    parsed.setdefault('model', 'gpt-4.1-mini')
    return parsed


def call_xai():
    key = os.environ.get('XAI_API_KEY')
    if not key:
        return {'model': 'xai', 'error': 'XAI_API_KEY missing'}
    url = 'https://api.x.ai/v1/chat/completions'
    payload = {
        'model': 'grok-4',
        'response_format': {'type': 'json_object'},
        'messages': [
            {
                'role': 'user',
                'content': [
                    {'type': 'text', 'text': prompt},
                    {'type': 'image_url', 'image_url': {'url': data_uri}},
                ],
            }
        ],
        'temperature': 0.2,
        'max_tokens': 500,
    }
    r = requests.post(url, headers={'Authorization': f'Bearer {key}', 'Content-Type': 'application/json'}, json=payload, timeout=90)
    r.raise_for_status()
    content = r.json()['choices'][0]['message']['content']
    parsed = json.loads(content)
    parsed.setdefault('model', 'grok-4')
    return parsed


def call_gemini():
    key = os.environ.get('GEMINI_API_KEY')
    if not key:
        return {'model': 'gemini', 'error': 'GEMINI_API_KEY missing'}
    url = f'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={key}'
    payload = {
        'generationConfig': {
            'temperature': 0.2,
            'responseMimeType': 'application/json',
        },
        'contents': [
            {
                'parts': [
                    {'text': prompt},
                    {'inline_data': {'mime_type': mime, 'data': img_b64}},
                ]
            }
        ]
    }
    r = requests.post(url, headers={'Content-Type': 'application/json'}, json=payload, timeout=90)
    r.raise_for_status()
    text = r.json()['candidates'][0]['content']['parts'][0]['text']
    parsed = json.loads(text)
    parsed.setdefault('model', 'gemini-2.5-flash')
    return parsed


results = {}
for name, fn in [('openai', call_openai), ('grok', call_xai), ('gemini', call_gemini)]:
    try:
        results[name] = fn()
    except Exception as exc:
        results[name] = {'model': name, 'error': str(exc)}

scores = [item.get('score') for item in results.values() if isinstance(item.get('score'), (int, float))]
results['summary'] = {
    'average_score': round(sum(scores) / len(scores), 2) if scores else None,
    'min_score': min(scores) if scores else None,
    'max_score': max(scores) if scores else None,
    'all_nine_or_more': bool(scores) and all(score >= 9 for score in scores),
}
OUTPUT.write_text(json.dumps(results, ensure_ascii=False, indent=2))
print(OUTPUT)
