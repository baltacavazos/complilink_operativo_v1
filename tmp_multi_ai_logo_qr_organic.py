#!/usr/bin/env python3
from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

import requests

PROJECT_DIR = Path('/home/ubuntu/complilink_operativo_v1')
OUTPUT_DIR = PROJECT_DIR / 'research' / 'logo_qr'
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
OUTPUT_FILE = OUTPUT_DIR / 'multi_ai_logo_qr_organic_results.json'

PROMPT = """
Contexto:
- Marca: AUDITAPATRON
- Tagline: CONOCE TUS DERECHOS
- Colores base: azul marino y turquesa
- El logotipo usa una lupa como isotipo en la letra final.
- Dentro de la lupa se quiere integrar un QR real y escaneable que apunte a https://auditapatron.mx.
- El problema del borrador anterior es que el QR todavía se percibe demasiado cuadrado o sobrepuesto dentro de la lupa.

Objetivo:
Proponer la mejor forma de hacer que el QR se vea más orgánico, más circular y más natural dentro de la lupa sin comprometer la escaneabilidad.

Responde SOLO en JSON válido con esta estructura exacta:
{
  "recommended_direction": "string",
  "must_keep": ["string"],
  "should_change": ["string"],
  "avoid": ["string"],
  "best_visual_treatment": "string",
  "scannability_risk": "low|medium|high",
  "implementation_notes": ["string"],
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
                {'role': 'system', 'content': 'Eres un director de branding y sistemas visuales experto en QR escaneables.'},
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
                {'role': 'system', 'content': 'Eres un experto en identidad visual, señalética y códigos QR funcionales.'},
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
