import json
import os
import requests
from pathlib import Path

brief = Path('/home/ubuntu/complilink_operativo_v1/tmp_video_brief.md').read_text(encoding='utf-8')
api_key = os.environ.get('XAI_API_KEY')
if not api_key:
    raise SystemExit('XAI_API_KEY no disponible')

prompt = f'''Lee este brief y responde solo con JSON corto y válido.

{brief}

Entrega exactamente este objeto:
{{
  "recommended_angle": "...",
  "must_include_messages": ["...", "...", "..."],
  "cta": "...",
  "voice_style": "...",
  "phrases_to_avoid": ["...", "...", "..."]
}}

Condiciones: video vertical 9:16 de 30 segundos, tono premium humano, sin prometer resultados legales o dinero. Solo JSON.'''

models = ['grok-3-mini-fast', 'grok-3-mini', 'grok-2-vision-1212']
last = None
for model in models:
    try:
        response = requests.post(
            'https://api.x.ai/v1/chat/completions',
            headers={
                'Authorization': f'Bearer {api_key}',
                'Content-Type': 'application/json',
            },
            json={
                'model': model,
                'messages': [
                    {'role': 'system', 'content': 'Eres un estratega de marketing. Devuelve solo JSON válido.'},
                    {'role': 'user', 'content': prompt},
                ],
                'temperature': 0.5,
                'max_tokens': 400,
                'response_format': {'type': 'json_object'},
            },
            timeout=45,
        )
        response.raise_for_status()
        data = response.json()
        content = data['choices'][0]['message']['content']
        parsed = json.loads(content)
        parsed['_model_used'] = model
        Path('/home/ubuntu/complilink_operativo_v1/tmp_grok_video_only.json').write_text(
            json.dumps(parsed, ensure_ascii=False, indent=2), encoding='utf-8'
        )
        print('/home/ubuntu/complilink_operativo_v1/tmp_grok_video_only.json')
        raise SystemExit(0)
    except Exception as exc:
        last = f'{model}: {exc}'

raise SystemExit(last)
