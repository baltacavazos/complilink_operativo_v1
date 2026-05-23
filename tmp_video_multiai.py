import json
import os
import re
import requests
from pathlib import Path
from requests.exceptions import RequestException

BASE_DIR = Path('/home/ubuntu/complilink_operativo_v1')
BRIEF_PATH = BASE_DIR / 'tmp_video_brief.md'
OUTPUT_PATH = BASE_DIR / 'tmp_video_multiai.json'

brief = BRIEF_PATH.read_text(encoding='utf-8')

system_prompt = (
    'Eres un estratega senior de marketing y guionista de video corto. '
    'Tu tarea es proponer el mejor enfoque para un video promocional de 30 segundos '
    'de una plataforma legal-laboral para trabajadores en México. '
    'Debes ser persuasivo, claro y responsable. '
    'No prometas resultados legales ni dinero garantizado. '
    'Devuelve JSON válido únicamente.'
)

user_prompt = f'''Analiza este brief y responde con una propuesta óptima para un video promocional vertical de 30 segundos de Auditapatron.

{brief}

Quiero que devuelvas JSON con esta estructura exacta:
{{
  "recommended_angle": "string",
  "why_it_works": "string",
  "target_emotion": "string",
  "must_include_messages": ["string", "string", "string"],
  "scene_outline": [
    {{"time": "0-5", "visual": "string", "voiceover": "string", "onscreen_text": "string"}}
  ],
  "voice_style": "string",
  "cta": "string",
  "gemini_video_prompt_guidelines": ["string", "string", "string"],
  "phrases_to_avoid": ["string", "string", "string"]
}}

Condiciones:
- Debe ser apto para un video promocional de 30 segundos.
- El ángulo debe priorizar claridad, rapidez, privacidad y utilidad inmediata.
- Debe sonar premium, humano y fácil de entender.
- Piensa en formato vertical 9:16 para redes o anuncios móviles.
- Devuelve solo JSON válido, sin markdown.
'''


def extract_json(text: str):
    text = text.strip()
    if text.startswith('```'):
        text = re.sub(r'^```(?:json)?\s*', '', text)
        text = re.sub(r'\s*```$', '', text)
    match = re.search(r'\{.*\}', text, re.S)
    candidate = match.group(0) if match else text
    return json.loads(candidate)


def call_openai():
    api_key = os.environ.get('OPENAI_API_KEY')
    if not api_key:
        return {'error': 'OPENAI_API_KEY no disponible'}
    url = 'https://api.openai.com/v1/chat/completions'
    payload = {
        'model': 'gpt-4.1-mini',
        'messages': [
            {'role': 'system', 'content': system_prompt},
            {'role': 'user', 'content': user_prompt},
        ],
        'temperature': 0.7,
        'response_format': {'type': 'json_object'},
    }
    response = requests.post(url, headers={
        'Authorization': f'Bearer {api_key}',
        'Content-Type': 'application/json',
    }, json=payload, timeout=120)
    response.raise_for_status()
    data = response.json()
    content = data['choices'][0]['message']['content']
    return extract_json(content)


def call_grok():
    api_key = os.environ.get('XAI_API_KEY')
    if not api_key:
        return {'error': 'XAI_API_KEY no disponible'}
    url = 'https://api.x.ai/v1/chat/completions'
    models_to_try = ['grok-3-mini-fast', 'grok-4']
    last_error = None
    for model_name in models_to_try:
        try:
            payload = {
                'model': model_name,
                'messages': [
                    {'role': 'system', 'content': system_prompt},
                    {'role': 'user', 'content': user_prompt},
                ],
                'temperature': 0.7,
                'max_tokens': 900,
                'response_format': {'type': 'json_object'},
            }
            response = requests.post(url, headers={
                'Authorization': f'Bearer {api_key}',
                'Content-Type': 'application/json',
            }, json=payload, timeout=60)
            response.raise_for_status()
            data = response.json()
            content = data['choices'][0]['message']['content']
            parsed = extract_json(content)
            parsed['_model_used'] = model_name
            return parsed
        except Exception as exc:
            last_error = f'{model_name}: {exc}'
    return {'error': last_error or 'No fue posible consultar Grok'}


def call_gemini():
    api_key = os.environ.get('GEMINI_API_KEY')
    if not api_key:
        return {'error': 'GEMINI_API_KEY no disponible'}
    url = (
        'https://generativelanguage.googleapis.com/v1beta/models/'
        'gemini-2.5-flash:generateContent'
    )
    payload = {
        'systemInstruction': {'parts': [{'text': system_prompt}]},
        'contents': [{'parts': [{'text': user_prompt}]}],
        'generationConfig': {
            'temperature': 0.7,
            'responseMimeType': 'application/json',
        },
    }
    response = requests.post(
        f'{url}?key={api_key}',
        headers={'Content-Type': 'application/json'},
        json=payload,
        timeout=120,
    )
    response.raise_for_status()
    data = response.json()
    content = data['candidates'][0]['content']['parts'][0]['text']
    return extract_json(content)


def safe_call(name, fn):
    try:
        return fn()
    except RequestException as exc:
        return {'error': f'{name}: {exc}'}
    except Exception as exc:
        return {'error': f'{name}: {exc}'}


results = {
    'brief_path': str(BRIEF_PATH),
    'models': {
        'chatgpt': safe_call('chatgpt', call_openai),
        'grok': safe_call('grok', call_grok),
        'gemini': safe_call('gemini', call_gemini),
    }
}

OUTPUT_PATH.write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding='utf-8')
print(str(OUTPUT_PATH))
