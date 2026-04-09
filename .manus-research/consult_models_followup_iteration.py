import json
import os
import time
from pathlib import Path

import requests

BASE_DIR = Path('/home/ubuntu/complilink_operativo_v1/.manus-research')
BASE_DIR.mkdir(parents=True, exist_ok=True)

PROMPT = """
Contexto del producto:
- Plataforma: AuditaPatron.
- Marca visible al usuario final: solo AuditaPatron.
- Helios permanece como arquitectura interna y núcleo del ecosistema.
- Ya existe una pantalla /auditar con expediente, indicador dinámico de claridad y una acción única de revalidación IMSS/Infonavit.
- Toda la información del usuario y todos los documentos deben ser obtenidos, analizados, almacenados y devueltos por Helios como núcleo.

Nueva iteración aprobada por el usuario:
1. Mostrar un historial simple de revalidaciones IMSS/Infonavit con fecha, resultado y cambio detectado dentro de /auditar.
2. Añadir una recomendación automática del siguiente documento más útil según el estado actual de IMSS/Infonavit y del expediente.
3. Incorporar una notificación visible cuando el expediente gane nueva claridad después de subir o revalidar información.

Necesito una respuesta práctica y breve para implementar en un producto real. Responde en JSON válido con esta estructura exacta:
{
  "product_recommendation": {
    "history_ui": "string",
    "next_document_logic": "string",
    "clarity_notification": "string"
  },
  "technical_recommendation": {
    "backend_contract": "string",
    "frontend_integration": "string",
    "risk_guardrails": "string"
  },
  "priority_order": ["string", "string", "string"],
  "confidence": "high|medium|low"
}

Condiciones:
- No expongas Helios en el copy público.
- Propón la solución con menor fricción posible.
- Prioriza reutilizar el flujo actual y evitar arquitecturas paralelas.
- Considera mobile-first.
""".strip()


def save_json(path: Path, payload):
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding='utf-8')


def call_openai():
    api_key = os.environ.get('OPENAI_API_KEY')
    if not api_key:
        return {"error": "OPENAI_API_KEY missing"}
    url = 'https://api.openai.com/v1/chat/completions'
    payload = {
        "model": "gpt-4.1-mini",
        "temperature": 0.2,
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": "Eres un estratega senior de producto y arquitectura para apps legales laborales en México. Responde solo JSON válido."},
            {"role": "user", "content": PROMPT},
        ],
    }
    response = requests.post(
        url,
        headers={
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json',
        },
        json=payload,
        timeout=90,
    )
    response.raise_for_status()
    data = response.json()
    content = data['choices'][0]['message']['content']
    parsed = json.loads(content)
    return {"raw": data, "parsed": parsed}


def call_grok():
    api_key = os.environ.get('XAI_API_KEY')
    if not api_key:
        return {"error": "XAI_API_KEY missing"}
    url = 'https://api.x.ai/v1/chat/completions'
    payload = {
        "model": "grok-3-mini",
        "temperature": 0.2,
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": "Eres un estratega senior de producto y arquitectura para apps legales laborales en México. Responde solo JSON válido."},
            {"role": "user", "content": PROMPT},
        ],
    }
    response = requests.post(
        url,
        headers={
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json',
        },
        json=payload,
        timeout=90,
    )
    response.raise_for_status()
    data = response.json()
    content = data['choices'][0]['message']['content']
    parsed = json.loads(content)
    return {"raw": data, "parsed": parsed}


def call_gemini():
    api_key = os.environ.get('GEMINI_API_KEY')
    if not api_key:
        return {"error": "GEMINI_API_KEY missing"}
    url = f'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}'
    payload = {
        "generationConfig": {
            "temperature": 0.2,
            "responseMimeType": "application/json",
        },
        "contents": [
            {
                "role": "user",
                "parts": [{"text": PROMPT}],
            }
        ],
        "systemInstruction": {
            "parts": [
                {"text": "Eres un estratega senior de producto y arquitectura para apps legales laborales en México. Responde solo JSON válido."}
            ]
        },
    }
    response = requests.post(url, json=payload, timeout=90)
    response.raise_for_status()
    data = response.json()
    content = data['candidates'][0]['content']['parts'][0]['text']
    parsed = json.loads(content)
    return {"raw": data, "parsed": parsed}


def main():
    started_at = int(time.time())
    results = {}
    for name, fn in (("openai", call_openai), ("grok", call_grok), ("gemini", call_gemini)):
        try:
            result = fn()
        except Exception as exc:
            result = {"error": str(exc)}
        results[name] = result
        save_json(BASE_DIR / f'{name}_followup_iteration.json', result)

    summary = {
        "created_at": started_at,
        "prompt": PROMPT,
        "models": {},
    }
    for name, result in results.items():
        summary['models'][name] = result.get('parsed') if isinstance(result, dict) else None
        if isinstance(result, dict) and result.get('error'):
            summary['models'][name] = {"error": result['error']}

    save_json(BASE_DIR / 'multi_model_followup_iteration_summary.json', summary)
    print(json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
