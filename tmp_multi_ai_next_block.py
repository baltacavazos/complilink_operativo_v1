import json
import os
import time
from pathlib import Path

import requests

ROOT = Path('/home/ubuntu/complilink_operativo_v1')
OUT = ROOT / 'research' / 'next_block_consensus'
OUT.mkdir(parents=True, exist_ok=True)

SYSTEM_PROMPT = (
    'Eres un estratega de producto y UX para una app no técnica, mobile-first, '
    'centrada en expedientes laborales. Responde en español claro y concreto.'
)

USER_PROMPT = '''
Contexto del producto:
- CompliLink es la capa operativa y de orquestación.
- Helios es el cerebro central que interpreta señales, conecta contexto y guía el siguiente paso.
- AuditaPatron es la interfaz orientada a personas trabajadoras para subir documentos y entender su expediente.

Estado actual de /auditar:
- Ya existe un bloque “Así va tu expediente” con avance por tipos documentales.
- Ya existe un microestado visible de Helios.
- Ya existe lectura preliminar de Helios por documento.
- Ya existe una sugerencia básica de “próximo paso”.
- La UX debe seguir siendo simple, no técnica, y mobile-first.

Objetivo de esta ronda:
1. Mejorar la recomendación del “siguiente mejor documento” para que Helios explique cuál conviene subir y por qué.
2. Añadir una línea de tiempo simple del expediente para mostrar cómo Helios va fortaleciendo el caso documento por documento.
3. Mantener la base preparada para futuro modo remoto, sin cambiar la forma de uso.

Taxonomía documental disponible:
- payroll_receipt
- cfdi
- imss
- contract
- settlement
- evidence
- other

Necesito una respuesta JSON con esta estructura exacta:
{
  "recommended_priority": "string",
  "why_this_first": "string",
  "next_best_document_logic": {
    "title": "string",
    "description": "string",
    "rules": ["string"],
    "tone": "string"
  },
  "timeline_module": {
    "title": "string",
    "description": "string",
    "items": [
      {
        "label": "string",
        "meaning": "string"
      }
    ]
  },
  "copy_suggestions": {
    "next_step_heading": "string",
    "next_step_explainer": "string",
    "timeline_heading": "string",
    "timeline_explainer": "string"
  },
  "risks_to_avoid": ["string"],
  "implementation_notes": ["string"]
}

Criterios:
- No propongas chatbot.
- No compliques la experiencia.
- El incentivo debe reforzar que entre más documentos suba la persona, más fuerte y útil se vuelve su expediente.
- Debe sentirse como una guía práctica, no como un dashboard técnico.
- La línea de tiempo debe ser simple y comprensible para alguien no técnico.
'''


def write_json(path: Path, payload: dict):
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def call_openai():
    api_key = os.environ.get('OPENAI_API_KEY')
    if not api_key:
        return {"ok": False, "error": "OPENAI_API_KEY no disponible"}

    url = 'https://api.openai.com/v1/chat/completions'
    headers = {
        'Authorization': f'Bearer {api_key}',
        'Content-Type': 'application/json',
    }
    payload = {
        'model': 'gpt-4.1-mini',
        'response_format': {'type': 'json_object'},
        'messages': [
            {'role': 'system', 'content': SYSTEM_PROMPT},
            {'role': 'user', 'content': USER_PROMPT},
        ],
        'temperature': 0.4,
    }
    response = requests.post(url, headers=headers, json=payload, timeout=120)
    response.raise_for_status()
    data = response.json()
    content = data['choices'][0]['message']['content']
    return {"ok": True, "model": payload['model'], "content": json.loads(content)}


def call_grok():
    api_key = os.environ.get('XAI_API_KEY')
    if not api_key:
        return {"ok": False, "error": "XAI_API_KEY no disponible"}

    url = 'https://api.x.ai/v1/chat/completions'
    headers = {
        'Authorization': f'Bearer {api_key}',
        'Content-Type': 'application/json',
    }
    payload = {
        'model': 'grok-4-fast-reasoning',
        'response_format': {'type': 'json_object'},
        'messages': [
            {'role': 'system', 'content': SYSTEM_PROMPT},
            {'role': 'user', 'content': USER_PROMPT},
        ],
        'temperature': 0.4,
    }
    response = requests.post(url, headers=headers, json=payload, timeout=120)
    response.raise_for_status()
    data = response.json()
    content = data['choices'][0]['message']['content']
    return {"ok": True, "model": payload['model'], "content": json.loads(content)}


def call_gemini():
    api_key = os.environ.get('GEMINI_API_KEY')
    if not api_key:
        return {"ok": False, "error": "GEMINI_API_KEY no disponible"}

    url = f'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}'
    payload = {
        'generationConfig': {
            'temperature': 0.4,
            'responseMimeType': 'application/json',
        },
        'systemInstruction': {
            'parts': [{'text': SYSTEM_PROMPT}]
        },
        'contents': [
            {
                'role': 'user',
                'parts': [{'text': USER_PROMPT}],
            }
        ],
    }
    response = requests.post(url, json=payload, timeout=120)
    response.raise_for_status()
    data = response.json()
    content = data['candidates'][0]['content']['parts'][0]['text']
    return {"ok": True, "model": 'gemini-2.5-flash', "content": json.loads(content)}


def safe_call(name, fn):
    started = time.time()
    try:
        result = fn()
        result['elapsed_seconds'] = round(time.time() - started, 2)
        return result
    except Exception as exc:
        return {
            'ok': False,
            'error': str(exc),
            'elapsed_seconds': round(time.time() - started, 2),
        }


def main():
    results = {
        'openai': safe_call('openai', call_openai),
        'grok': safe_call('grok', call_grok),
        'gemini': safe_call('gemini', call_gemini),
    }

    for key, value in results.items():
        write_json(OUT / f'{key}.json', value)

    summary = {
        'generated_at': time.strftime('%Y-%m-%d %H:%M:%S'),
        'available_results': [key for key, value in results.items() if value.get('ok')],
        'failed_results': {key: value.get('error') for key, value in results.items() if not value.get('ok')},
    }
    write_json(OUT / 'summary.json', summary)
    print(json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
