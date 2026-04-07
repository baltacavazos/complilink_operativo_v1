from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

import requests

PROJECT_ROOT = Path('/home/ubuntu/complilink_operativo_v1')
HOME_FILE = PROJECT_ROOT / 'client/src/pages/Home.tsx'
AUDITAR_FILE = PROJECT_ROOT / 'client/src/pages/Auditar.tsx'
OUTPUT_FILE = PROJECT_ROOT / 'tri_ai_microanimations_consensus.json'
TIMEOUT = 90


def slice_lines(path: Path, start: int, end: int) -> str:
    lines = path.read_text(encoding='utf-8').splitlines()
    selection = lines[start - 1:end]
    numbered = [f'{i}: {line}' for i, line in enumerate(selection, start=start)]
    return '\n'.join(numbered)


home_excerpt = '\n\n'.join([
    '[HOME_HEADER]\n' + slice_lines(HOME_FILE, 164, 264),
    '[HOME_HERO]\n' + slice_lines(HOME_FILE, 268, 390),
    '[HOME_TOUR_START]\n' + slice_lines(HOME_FILE, 392, 520),
])

auditar_excerpt = '\n\n'.join([
    '[AUDITAR_TOP]\n' + slice_lines(AUDITAR_FILE, 638, 770),
    '[AUDITAR_UPLOAD_AND_RESULT]\n' + slice_lines(AUDITAR_FILE, 870, 1135),
])

PROMPT = f"""
Actúa como director de producto, motion designer senior y UX designer muy exigente.

Estoy puliendo una web llamada AuditaPatron, orientada a trabajadores en México. Quiero añadir microanimaciones modernas para aumentar engagement y premiar la atención, pero sin caer en humo visual, sin distraer y sin degradar rendimiento móvil.

Tu tarea es proponer un sistema de microinteracciones para:
1. Hero principal de la home.
2. CTA principales.
3. Panel derecho del hero.
4. Bloques de confianza/beneficios.
5. Pantalla /auditar, especialmente carga, estado y resultados.

Criterios obligatorios:
- Mobile-first.
- Elegante, moderna, útil y clara.
- Debe recompensar la atención del usuario con feedback visual agradable.
- Nada debe parecer decorativo sin función.
- Debe respetar prefers-reduced-motion.
- Evitar animaciones pesadas, parallax excesivo o cosas que ralenticen.
- Responde SOLO JSON válido.

Devuelve exactamente este esquema:
{{
  "design_principle": "texto breve",
  "recommended_animations": [
    {{
      "name": "texto breve",
      "target": "home_hero|cta|hero_panel|benefits|auditar_upload|auditar_results|header",
      "trigger": "on_load|on_scroll_into_view|on_hover|on_tap|on_state_change",
      "effect": "texto breve",
      "duration_ms": 0,
      "priority": "high|medium|low",
      "engagement_value": "texto breve",
      "implementation_note": "texto breve"
    }}
  ],
  "avoid": ["texto 1", "texto 2", "texto 3"],
  "motion_system": {{
    "style": "texto breve",
    "easing": "texto breve",
    "stagger_strategy": "texto breve",
    "reduced_motion_strategy": "texto breve"
  }},
  "ideal_first_batch": ["nombre exacto 1", "nombre exacto 2", "nombre exacto 3", "nombre exacto 4"],
  "confidence": "high|medium|low"
}}

Fragmentos relevantes de la home:
{home_excerpt}

Fragmentos relevantes de /auditar:
{auditar_excerpt}
""".strip()


def extract_json(text: str) -> dict[str, Any]:
    text = text.strip()
    if text.startswith('```'):
        text = text.strip('`')
        if text.startswith('json'):
            text = text[4:].strip()
    start = text.find('{')
    end = text.rfind('}')
    if start == -1 or end == -1 or end <= start:
        raise ValueError(f'No se encontró JSON válido: {text[:500]}')
    return json.loads(text[start:end + 1])


def call_openai(prompt: str) -> dict[str, Any]:
    api_key = os.environ.get('OPENAI_API_KEY')
    if not api_key:
        return {'error': 'OPENAI_API_KEY no disponible'}
    response = requests.post(
        'https://api.openai.com/v1/chat/completions',
        headers={
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json',
        },
        json={
            'model': 'gpt-4.1-mini',
            'temperature': 0.2,
            'messages': [
                {'role': 'system', 'content': 'Responde únicamente JSON válido.'},
                {'role': 'user', 'content': prompt},
            ],
        },
        timeout=TIMEOUT,
    )
    response.raise_for_status()
    return extract_json(response.json()['choices'][0]['message']['content'])


def call_gemini(prompt: str) -> dict[str, Any]:
    api_key = os.environ.get('GEMINI_API_KEY')
    if not api_key:
        return {'error': 'GEMINI_API_KEY no disponible'}
    response = requests.post(
        f'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}',
        headers={'Content-Type': 'application/json'},
        json={
            'contents': [{'role': 'user', 'parts': [{'text': prompt}]}],
            'generationConfig': {
                'temperature': 0.2,
                'responseMimeType': 'application/json',
            },
        },
        timeout=TIMEOUT,
    )
    response.raise_for_status()
    text = response.json()['candidates'][0]['content']['parts'][0]['text']
    return extract_json(text)


def call_grok(prompt: str) -> dict[str, Any]:
    api_key = os.environ.get('XAI_API_KEY')
    if not api_key:
        return {'error': 'XAI_API_KEY no disponible'}
    response = requests.post(
        'https://api.x.ai/v1/chat/completions',
        headers={
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json',
        },
        json={
            'model': 'grok-4',
            'temperature': 0.2,
            'messages': [
                {'role': 'system', 'content': 'Responde únicamente JSON válido.'},
                {'role': 'user', 'content': prompt},
            ],
        },
        timeout=TIMEOUT,
    )
    response.raise_for_status()
    return extract_json(response.json()['choices'][0]['message']['content'])


results: dict[str, Any] = {
    'prompt_version': 'microanimations_v1',
    'source_files': [str(HOME_FILE), str(AUDITAR_FILE)],
    'models': {},
}

for name, fn in (('chatgpt', call_openai), ('gemini', call_gemini), ('grok', call_grok)):
    try:
        results['models'][name] = fn(PROMPT)
    except Exception as exc:  # noqa: BLE001
        results['models'][name] = {'error': f'{type(exc).__name__}: {exc}'}

OUTPUT_FILE.write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding='utf-8')
print(str(OUTPUT_FILE))
