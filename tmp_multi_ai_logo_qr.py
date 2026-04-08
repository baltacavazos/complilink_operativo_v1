#!/usr/bin/env python3
import json
import os
import time
from pathlib import Path

import requests

PROJECT_DIR = Path('/home/ubuntu/complilink_operativo_v1')
OUTPUT_DIR = PROJECT_DIR / 'research' / 'logo_qr'
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
OUTPUT_FILE = OUTPUT_DIR / 'multi_ai_logo_qr_results.json'

PROMPT = '''
Actúa como director de marca, diseñador de identidad visual y especialista en QR escaneable.

Contexto:
- Marca: AuditaPatron
- Tagline: Conoce tus derechos
- URL final del QR: https://auditapatron.mx
- El logotipo actual integra una lupa en la letra O final de AUDITAPATRON.
- El usuario quiere que dentro de la lupa exista un QR real y funcional, no un patrón decorativo.
- El resultado debe sentirse nativo, elegante y premium; no debe parecer un QR pegado o un collage.
- Debe funcionar tanto en UI web como en piezas impresas.
- La versión reciente del branding ya busca evitar cuadros blancos notorios detrás del logo.

Necesito una respuesta ejecutable y concreta en JSON con esta estructura exacta:
{
  "recommendation_summary": "string",
  "visual_strategy": ["string", "string", "string"],
  "qr_constraints": ["string", "string", "string", "string"],
  "logo_composition_rules": ["string", "string", "string"],
  "web_ui_adoption": ["string", "string", "string"],
  "print_adoption": ["string", "string", "string"],
  "risks": ["string", "string", "string"],
  "final_verdict": "string"
}

Criterios obligatorios:
- Prioriza escaneabilidad real del QR por encima de la estética si hay conflicto.
- Explica si conviene usar una versión maestra con QR y otra versión simplificada sin QR para tamaños pequeños.
- Define si el QR debe ir completo dentro de la lupa o si la lupa debe actuar como marco contenedor del QR.
- Di el tamaño mínimo recomendado para web y para impresión.
- Indica cómo evitar que el fondo o transparencias rompan el escaneo.
- No des teoría larga; entrega decisiones concretas y accionables.
'''.strip()


def parse_json_from_text(text: str):
    text = (text or '').strip()
    if not text:
        return {"raw": text}
    try:
        return json.loads(text)
    except Exception:
        pass
    start = text.find('{')
    end = text.rfind('}')
    if start != -1 and end != -1 and end > start:
        try:
            return json.loads(text[start:end+1])
        except Exception:
            return {"raw": text}
    return {"raw": text}


def call_openai():
    api_key = os.getenv('OPENAI_API_KEY')
    if not api_key:
        return {"error": "OPENAI_API_KEY not set"}
    url = 'https://api.openai.com/v1/chat/completions'
    payload = {
        "model": "gpt-4.1-mini",
        "temperature": 0.2,
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": "Eres un experto en branding, identidad visual y diseño de QR funcional. Respondes únicamente con JSON válido."},
            {"role": "user", "content": PROMPT},
        ],
    }
    resp = requests.post(url, headers={
        'Authorization': f'Bearer {api_key}',
        'Content-Type': 'application/json',
    }, json=payload, timeout=120)
    resp.raise_for_status()
    data = resp.json()
    text = data['choices'][0]['message']['content']
    return {"parsed": parse_json_from_text(text), "raw": text}


def call_gemini():
    api_key = os.getenv('GEMINI_API_KEY')
    if not api_key:
        return {"error": "GEMINI_API_KEY not set"}
    url = f'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}'
    schema = {
        "type": "OBJECT",
        "properties": {
            "recommendation_summary": {"type": "STRING"},
            "visual_strategy": {"type": "ARRAY", "items": {"type": "STRING"}},
            "qr_constraints": {"type": "ARRAY", "items": {"type": "STRING"}},
            "logo_composition_rules": {"type": "ARRAY", "items": {"type": "STRING"}},
            "web_ui_adoption": {"type": "ARRAY", "items": {"type": "STRING"}},
            "print_adoption": {"type": "ARRAY", "items": {"type": "STRING"}},
            "risks": {"type": "ARRAY", "items": {"type": "STRING"}},
            "final_verdict": {"type": "STRING"}
        },
        "required": [
            "recommendation_summary",
            "visual_strategy",
            "qr_constraints",
            "logo_composition_rules",
            "web_ui_adoption",
            "print_adoption",
            "risks",
            "final_verdict"
        ]
    }
    payload = {
        "contents": [{"parts": [{"text": PROMPT}]}],
        "generationConfig": {
            "temperature": 0.2,
            "responseMimeType": "application/json",
            "responseSchema": schema,
        },
    }
    resp = requests.post(url, headers={'Content-Type': 'application/json'}, json=payload, timeout=120)
    resp.raise_for_status()
    data = resp.json()
    text = data['candidates'][0]['content']['parts'][0]['text']
    return {"parsed": parse_json_from_text(text), "raw": text}


def call_grok():
    api_key = os.getenv('XAI_API_KEY')
    if not api_key:
        return {"error": "XAI_API_KEY not set"}
    url = 'https://api.x.ai/v1/chat/completions'
    payload = {
        "model": "grok-4-0709",
        "temperature": 0.2,
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": "Eres un experto en branding, identidad visual y diseño de QR funcional. Respondes únicamente con JSON válido."},
            {"role": "user", "content": PROMPT},
        ],
    }
    resp = requests.post(url, headers={
        'Authorization': f'Bearer {api_key}',
        'Content-Type': 'application/json',
    }, json=payload, timeout=120)
    resp.raise_for_status()
    data = resp.json()
    text = data['choices'][0]['message']['content']
    return {"parsed": parse_json_from_text(text), "raw": text}


def main():
    started_at = time.time()
    results = {
        "meta": {
            "task": "logo_qr_integration_consensus",
            "target_url": "https://auditapatron.mx",
            "created_at_epoch": int(started_at),
            "prompt": PROMPT,
        },
        "models": {},
    }

    for name, fn in [("openai", call_openai), ("gemini", call_gemini), ("grok", call_grok)]:
        try:
            results["models"][name] = {"status": "ok", **fn()}
        except Exception as exc:
            results["models"][name] = {"status": "error", "error": str(exc)}

    OUTPUT_FILE.write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding='utf-8')
    print(str(OUTPUT_FILE))


if __name__ == '__main__':
    main()
