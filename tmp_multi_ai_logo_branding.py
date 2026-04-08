from __future__ import annotations

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

LOGO_IMAGE_URL = 'https://d2xsxph8kpxj0f.cloudfront.net/310519663473809458/cGpJC3DAdnBiVVBEKZfqbd/auditapatron-logo-base_fbaa0e36.jpg'

SYSTEM_PROMPT = textwrap.dedent('''
Eres un director de marca, product designer y principal frontend engineer.
Debes ayudar a definir la mejor implementación de branding para una plataforma web llamada AuditaPatron.

Responde SOLO JSON válido con esta forma exacta:
{
  "veredicto_general": "texto corto",
  "stage1_brand_rollout": {
    "primary_recommendation": "texto corto",
    "must_replace_surfaces": ["superficie 1", "superficie 2", "superficie 3"],
    "design_rules": ["regla 1", "regla 2", "regla 3"],
    "risks": ["riesgo 1", "riesgo 2", "riesgo 3"]
  },
  "stage2_qr_logo": {
    "should_prepare_now": true,
    "preparation_strategy": "texto corto",
    "technical_constraints": ["constraint 1", "constraint 2", "constraint 3"],
    "do_not_do_yet": ["no 1", "no 2", "no 3"]
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

USER_PROMPT = textwrap.dedent(f'''
Contexto del producto:
- Marca visible: AuditaPatron.
- Proyecto web actual: React + Tailwind + backend tRPC/Express.
- Público: trabajadores en México.
- Prioridad UX: mobile-first, claridad, confianza y facilidad de uso.
- Instrucción de producto: incorporar un nuevo logotipo en toda la plataforma.
- Etapa aprobada ahora: reemplazar la identidad visual actual por el nuevo logotipo en todas las superficies relevantes.
- Etapa futura, NO para ejecutar todavía: convertir la lupa del logotipo en un QR real que redirija a AuditaPatron.
- Debemos dejar la base lista para esa etapa futura sin romper la marca actual.

Descripción visual del nuevo logotipo:
- Wordmark principal: AUDITAPATRON en azul marino intenso.
- Subtítulo: CONOCE TUS DERECHOS.
- La letra final incorpora una lupa con mango turquesa.
- Dentro de la lente hay un patrón tipo QR que en el futuro debe convertirse en un QR funcional real.
- Imagen de referencia pública: {LOGO_IMAGE_URL}

Qué necesito que decidas:
1. Cómo hacer el rollout Stage 1 del nuevo logotipo en toda la plataforma sin sobrecargar la interfaz.
2. Qué superficies visuales deben cambiar sí o sí primero.
3. Qué reglas de uso del logotipo convienen para header, home, diálogos, vista móvil y elementos pequeños.
4. Cómo dejar preparada la base para Stage 2 donde la lupa contenga un QR real funcional.
5. Qué NO conviene hacer todavía para no comprometer legibilidad, escaneabilidad o consistencia de marca.

Importante:
- No propongas rediseñar toda la plataforma desde cero.
- No conviertas el QR en funcional todavía.
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
        'temperature': 0.3,
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
    url = f'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}'
    payload = {
        'generationConfig': {
            'temperature': 0.3,
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
    response = requests.post(url, json=payload, timeout=120)
    response.raise_for_status()
    data = response.json()
    content = data['candidates'][0]['content']['parts'][0]['text']
    return {
        'available': True,
        'raw': content,
        'parsed': json.loads(content),
    }


def call_grok() -> dict:
    api_key = os.environ.get('XAI_API_KEY')
    if not api_key:
        return {'available': False, 'error': 'XAI_API_KEY no disponible'}
    url = 'https://api.x.ai/v1/chat/completions'
    payload = {
        'model': 'grok-4-fast-non-reasoning',
        'temperature': 0.3,
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


def safe_call(name: str, fn):
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
        'goal': 'Actualizar toda la identidad visual al nuevo logotipo y preparar la futura versión con QR funcional dentro de la lupa.',
        'logo_image_url': LOGO_IMAGE_URL,
    },
    'models': {
        'chatgpt': safe_call('chatgpt', call_openai),
        'gemini': safe_call('gemini', call_gemini),
        'grok': safe_call('grok', call_grok),
    },
}

with OUTPUT_PATH.open('w', encoding='utf-8') as f:
    json.dump(results, f, ensure_ascii=False, indent=2)

print(str(OUTPUT_PATH))
