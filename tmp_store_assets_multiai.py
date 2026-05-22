import json
import os
import time
from pathlib import Path

import requests

PROJECT_DIR = Path('/home/ubuntu/complilink_operativo_v1')
OUTPUT_PATH = PROJECT_DIR / 'tmp_store_assets_multiai.json'

PROMPT = '''
Eres director de marca móvil y ASO para una app mexicana llamada Auditapatron.

Contexto de marca ya confirmado:
- Producto: revisión de recibos de nómina y orientación laboral para trabajadores en México.
- Tono: serio, confiable, claro, no juguetón.
- Visual actual: fondo verde muy claro, acentos turquesa, barra superior azul gris oscuro, tipografía negra o muy oscura.
- Assets existentes: ya hay logo completo, wordmark, icono base y lockups de header.
- Restricciones store verificadas:
  - Apple: base práctica iPhone 6.9 con screenshots 1260x2736 px verticales.
  - Google Play: icono 512x512 PNG con alpha; screenshots verticales en proporción 9:16.

Necesito una respuesta JSON estricta para producir un paquete inicial de stores SIN Apple Sign In todavía. Quiero consistencia de marca y alta claridad para un trabajador no técnico en México.

Devuelve un JSON con esta estructura exacta:
{
  "overall_direction": "...",
  "palette": {
    "background": "#hex",
    "dark_surface": "#hex",
    "accent": "#hex",
    "text": "#hex"
  },
  "icon": {
    "recommended_concept": "...",
    "should_use_existing_logo": true,
    "avoid": ["...", "..."],
    "prompt": "..."
  },
  "splash": {
    "recommended_layout": "...",
    "copy": "...",
    "prompt": "..."
  },
  "screenshots": [
    {
      "title": "...",
      "subtitle": "...",
      "scene": "..."
    },
    {
      "title": "...",
      "subtitle": "...",
      "scene": "..."
    },
    {
      "title": "...",
      "subtitle": "...",
      "scene": "..."
    },
    {
      "title": "...",
      "subtitle": "...",
      "scene": "..."
    }
  ],
  "store_positioning": "...",
  "confidence": "low|medium|high"
}

Reglas:
- Mantén el español de México.
- No inventes una marca nueva.
- Reutiliza al máximo el ícono/logotipo existente.
- Evita claims legales absolutos o promesas imposibles.
- El resultado debe ser accionable para generar assets hoy mismo.
'''.strip()


def extract_json(text: str):
    text = text.strip()
    if text.startswith('```'):
        parts = text.split('```')
        for part in parts:
            part = part.strip()
            if part.startswith('{') and part.endswith('}'):
                return json.loads(part)
            if part.startswith('json'):
                body = part[4:].strip()
                if body.startswith('{') and body.endswith('}'):
                    return json.loads(body)
    start = text.find('{')
    end = text.rfind('}')
    if start >= 0 and end > start:
        return json.loads(text[start:end + 1])
    raise ValueError('No JSON object found')


def call_openai():
    api_key = os.environ.get('OPENAI_API_KEY')
    if not api_key:
        return {'error': 'OPENAI_API_KEY missing'}
    url = 'https://api.openai.com/v1/chat/completions'
    payload = {
        'model': 'gpt-4.1-mini',
        'temperature': 0.4,
        'response_format': {'type': 'json_object'},
        'messages': [
            {'role': 'system', 'content': 'Devuelve únicamente JSON válido.'},
            {'role': 'user', 'content': PROMPT},
        ],
    }
    res = requests.post(url, headers={
        'Authorization': f'Bearer {api_key}',
        'Content-Type': 'application/json',
    }, json=payload, timeout=120)
    res.raise_for_status()
    data = res.json()
    content = data['choices'][0]['message']['content']
    return {'raw': content, 'parsed': extract_json(content)}


def call_grok():
    api_key = os.environ.get('XAI_API_KEY')
    if not api_key:
        return {'error': 'XAI_API_KEY missing'}
    url = 'https://api.x.ai/v1/chat/completions'
    payload = {
        'model': 'grok-4',
        'temperature': 0.4,
        'response_format': {'type': 'json_object'},
        'messages': [
            {'role': 'system', 'content': 'Responde solo con JSON válido.'},
            {'role': 'user', 'content': PROMPT},
        ],
    }
    res = requests.post(url, headers={
        'Authorization': f'Bearer {api_key}',
        'Content-Type': 'application/json',
    }, json=payload, timeout=120)
    res.raise_for_status()
    data = res.json()
    content = data['choices'][0]['message']['content']
    return {'raw': content, 'parsed': extract_json(content)}


def call_gemini():
    api_key = os.environ.get('GEMINI_API_KEY')
    if not api_key:
        return {'error': 'GEMINI_API_KEY missing'}
    url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent'
    payload = {
        'contents': [{'parts': [{'text': PROMPT}]}],
        'generationConfig': {
            'temperature': 0.4,
            'responseMimeType': 'application/json'
        }
    }
    res = requests.post(f'{url}?key={api_key}', headers={
        'Content-Type': 'application/json',
    }, json=payload, timeout=120)
    res.raise_for_status()
    data = res.json()
    content = data['candidates'][0]['content']['parts'][0]['text']
    return {'raw': content, 'parsed': extract_json(content)}


def main():
    started = time.time()
    result = {
        'prompt': PROMPT,
        'openai': call_openai(),
        'grok': call_grok(),
        'gemini': call_gemini(),
        'generated_at': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
        'elapsed_seconds': None,
    }
    result['elapsed_seconds'] = round(time.time() - started, 2)
    OUTPUT_PATH.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(str(OUTPUT_PATH))


if __name__ == '__main__':
    main()
