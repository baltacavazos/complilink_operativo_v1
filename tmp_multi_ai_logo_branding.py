import json
import os
import textwrap
from datetime import datetime, timezone
from pathlib import Path

import requests

PROJECT_ROOT = Path('/home/ubuntu/complilink_operativo_v1')
OUTPUT_DIR = PROJECT_ROOT / 'research' / 'logo_branding'
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
OUTPUT_PATH = OUTPUT_DIR / 'multi_ai_logo_branding_results.json'

SYSTEM_PROMPT = textwrap.dedent('''
Eres un director de marca, product designer y principal frontend engineer.
Debes ayudar a definir la mejor implementación de branding para una plataforma web llamada AuditaPatron.

Responde SOLO JSON válido con esta forma exacta:
{
  "veredicto_general": "texto corto",
  "global_rollout": {
    "primary_recommendation": "texto corto",
    "must_replace_surfaces": ["superficie 1", "superficie 2", "superficie 3"],
    "design_rules": ["regla 1", "regla 2", "regla 3"],
    "risks": ["riesgo 1", "riesgo 2", "riesgo 3"]
  },
  "favicon_strategy": {
    "recommended_variant": "texto corto",
    "small_size_rules": ["regla 1", "regla 2", "regla 3"],
    "do_not_do": ["no 1", "no 2", "no 3"]
  },
  "ux_copy_guidance": {
    "brand_tone": "texto corto",
    "header_rule": "texto corto",
    "hero_rule": "texto corto"
  },
  "implementation_priority": ["paso 1", "paso 2", "paso 3", "paso 4"],
  "confidence_0_to_100": 0
}
''').strip()

USER_PROMPT = textwrap.dedent('''
Contexto del producto:
- Marca visible: AuditaPatron.
- Proyecto web actual: React + Tailwind + backend tRPC/Express.
- Público: trabajadores en México.
- Prioridad UX: mobile-first, claridad, confianza y facilidad de uso.
- El usuario ya aprobó el logotipo definitivo y quiere aplicarlo en toda la plataforma.
- También pidió usarlo en favicon y en todos los puntos visibles posibles.
- NO hay QR dentro de la lupa. La lupa final está vacía.

Descripción visual del logotipo definitivo:
- Wordmark principal: AUDITAPATRON en azul marino intenso.
- La O final se sustituye por una lupa circular vacía, en azul marino.
- El mango de la lupa es color turquesa claro.
- Debajo aparece la leyenda: CONOCE TUS DERECHOS.
- La composición debe sentirse original, confiable, clara y usable dentro de una interfaz web real.

Qué necesito que decidas:
1. Cómo hacer el rollout global del logotipo en toda la plataforma sin sobrecargar la interfaz.
2. Qué superficies visuales deben cambiar sí o sí primero.
3. Qué reglas de uso convienen para header, home, /auditar, diálogos, copiloto, dashboard, vista móvil y componentes pequeños.
4. Qué estrategia conviene para favicon e iconografía pequeña derivada del logo.
5. Qué no conviene hacer para no perder legibilidad, consistencia o limpieza visual.

Importante:
- No propongas rediseñar la plataforma desde cero.
- No reintroduzcas QR.
- Da recomendaciones accionables, específicas y pensadas para implementación incremental.
- Responde solo en español.
''').strip()


def call_openai() -> dict:
    api_key = os.environ.get('OPENAI_API_KEY')
    if not api_key:
        return {'available': False, 'error': 'OPENAI_API_KEY no disponible'}
    url = 'https://api.openai.com/v1/chat/completions'
    payload = {
        'model': 'gpt-4.1-mini',
        'temperature': 0.2,
        'response_format': {'type': 'json_object'},
        'messages': [
            {'role': 'system', 'content': SYSTEM_PROMPT},
            {'role': 'user', 'content': USER_PROMPT},
        ],
    }
    response = requests.post(
        url,
        headers={
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json',
        },
        json=payload,
        timeout=120,
    )
    response.raise_for_status()
    data = response.json()
    content = data['choices'][0]['message']['content']
    return {
        'available': True,
        'raw': content,
        'parsed': json.loads(content),
    }


def call_gemini() -> dict:
    api_key = os.environ.get('GEMINI_API_KEY')
    if not api_key:
        return {'available': False, 'error': 'GEMINI_API_KEY no disponible'}

    models = ['gemini-2.5-flash', 'gemini-2.0-flash-001']
    last_error = None

    for model in models:
        url = f'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}'
        payload = {
            'generationConfig': {
                'temperature': 0.2,
                'responseMimeType': 'application/json',
            },
            'contents': [
                {
                    'role': 'user',
                    'parts': [
                        {'text': SYSTEM_PROMPT + '\n\n' + USER_PROMPT}
                    ],
                }
            ],
        }
        try:
            response = requests.post(url, json=payload, timeout=120)
            response.raise_for_status()
            data = response.json()
            content = data['candidates'][0]['content']['parts'][0]['text']
            return {
                'available': True,
                'model': model,
                'raw': content,
                'parsed': json.loads(content),
            }
        except Exception as exc:  # noqa: BLE001
            last_error = f'{type(exc).__name__}: {exc}'

    return {'available': False, 'error': last_error or 'Gemini sin respuesta'}


def call_grok() -> dict:
    api_key = os.environ.get('XAI_API_KEY')
    if not api_key:
        return {'available': False, 'error': 'XAI_API_KEY no disponible'}
    url = 'https://api.x.ai/v1/chat/completions'
    payload = {
        'model': 'grok-4-fast-non-reasoning',
        'temperature': 0.2,
        'response_format': {'type': 'json_object'},
        'messages': [
            {'role': 'system', 'content': SYSTEM_PROMPT},
            {'role': 'user', 'content': USER_PROMPT},
        ],
    }
    response = requests.post(
        url,
        headers={
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json',
        },
        json=payload,
        timeout=120,
    )
    response.raise_for_status()
    data = response.json()
    content = data['choices'][0]['message']['content']
    return {
        'available': True,
        'raw': content,
        'parsed': json.loads(content),
    }


def safe_call(fn):
    try:
        return fn()
    except Exception as exc:  # noqa: BLE001
        return {
            'available': False,
            'error': f'{type(exc).__name__}: {exc}',
        }


results = {
    'generated_at': datetime.now(timezone.utc).isoformat(),
    'context': {
        'project_name': 'complilink_operativo_v1',
        'brand': 'AuditaPatron',
        'goal': 'Aplicar el logotipo definitivo original con lupa sin QR en toda la plataforma y resolver su uso pequeño para favicon.',
    },
    'models': {
        'chatgpt': safe_call(call_openai),
        'gemini': safe_call(call_gemini),
        'grok': safe_call(call_grok),
    },
}

with OUTPUT_PATH.open('w', encoding='utf-8') as f:
    json.dump(results, f, ensure_ascii=False, indent=2)

print(str(OUTPUT_PATH))
