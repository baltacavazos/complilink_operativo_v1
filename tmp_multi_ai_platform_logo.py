#!/usr/bin/env python3
from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

import requests

PROJECT_DIR = Path('/home/ubuntu/complilink_operativo_v1')
OUTPUT_DIR = PROJECT_DIR / 'research' / 'platform_logo'
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
OUTPUT_FILE = OUTPUT_DIR / 'multi_ai_platform_logo_results.json'

PROMPT = """
Contexto:
- Marca: AUDITAPATRON
- Tagline: CONOCE TUS DERECHOS
- Colores base: azul marino y turquesa.
- Existe un logo publicitario explorado con QR dentro de una lupa, pero para la plataforma se decidió NO usar QR funcional.
- La necesidad actual es definir el logo oficial de plataforma: limpio, elegante, nativo al UI, legible en header, hero, dashboard, diálogos y superficies móviles.
- Debe sentirse integrado al producto, no como imagen pegada ni como pieza publicitaria.
- El producto es mobile-first y debe transmitir confianza, claridad jurídica y facilidad de uso.

Objetivo:
Recomendar la mejor dirección visual para el logo de plataforma, indicando composición, uso de wordmark, tratamiento de la lupa, tamaños relativos, fondo recomendado y reglas de uso en UI.

Responde SOLO en JSON válido con esta estructura exacta:
{
  "recommended_direction": "string",
  "logo_architecture": {
    "wordmark": "string",
    "lupa_treatment": "string",
    "tagline_usage": "string"
  },
  "ui_usage": {
    "header": "string",
    "hero": "string",
    "dashboard": "string",
    "mobile": "string"
  },
  "must_keep": ["string"],
  "should_avoid": ["string"],
  "style_notes": ["string"],
  "final_verdict": "string"
}
""".strip()


def call_openai() -> dict[str, Any]:
    api_key = os.environ.get('OPENAI_API_KEY')
    if not api_key:
        return {"provider": "openai", "error": "OPENAI_API_KEY no disponible"}
    response = requests.post(
        'https://api.openai.com/v1/chat/completions',
        headers={
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json',
        },
        json={
            'model': 'gpt-4.1-mini',
            'temperature': 0.2,
            'response_format': {'type': 'json_object'},
            'messages': [
                {'role': 'system', 'content': 'Eres un director de branding digital especializado en identidad de producto SaaS y apps móviles.'},
                {'role': 'user', 'content': PROMPT},
            ],
        },
        timeout=120,
    )
    response.raise_for_status()
    data = response.json()
    text = data['choices'][0]['message']['content']
    return {"provider": "openai", "result": json.loads(text), "raw": text}



def call_gemini() -> dict[str, Any]:
    api_key = os.environ.get('GEMINI_API_KEY')
    if not api_key:
        return {"provider": "gemini", "error": "GEMINI_API_KEY no disponible"}
    response = requests.post(
        f'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}',
        headers={'Content-Type': 'application/json'},
        json={
            'generationConfig': {
                'temperature': 0.2,
                'responseMimeType': 'application/json',
            },
            'contents': [
                {
                    'role': 'user',
                    'parts': [{'text': PROMPT}],
                }
            ],
        },
        timeout=120,
    )
    response.raise_for_status()
    data = response.json()
    text = data['candidates'][0]['content']['parts'][0]['text']
    return {"provider": "gemini", "result": json.loads(text), "raw": text}



def call_grok() -> dict[str, Any]:
    api_key = os.environ.get('XAI_API_KEY')
    if not api_key:
        return {"provider": "grok", "error": "XAI_API_KEY no disponible"}
    response = requests.post(
        'https://api.x.ai/v1/chat/completions',
        headers={
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json',
        },
        json={
            'model': 'grok-4-fast-reasoning',
            'temperature': 0.2,
            'response_format': {'type': 'json_object'},
            'messages': [
                {'role': 'system', 'content': 'Eres un experto en identidad visual de producto, interfaces móviles y consistencia de marca en software.'},
                {'role': 'user', 'content': PROMPT},
            ],
        },
        timeout=120,
    )
    response.raise_for_status()
    data = response.json()
    text = data['choices'][0]['message']['content']
    return {"provider": "grok", "result": json.loads(text), "raw": text}



def main() -> None:
    results = []
    for fn in (call_openai, call_gemini, call_grok):
        try:
            results.append(fn())
        except Exception as exc:
            results.append({"provider": fn.__name__.replace('call_', ''), "error": str(exc)})

    OUTPUT_FILE.write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps({"output_file": str(OUTPUT_FILE), "providers": [r.get('provider') for r in results]}, ensure_ascii=False))


if __name__ == '__main__':
    main()
