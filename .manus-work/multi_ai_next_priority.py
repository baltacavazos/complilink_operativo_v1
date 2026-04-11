import json
import os
from pathlib import Path

import requests

BASE_DIR = Path('/home/ubuntu/complilink_operativo_v1/.manus-work')
BASE_DIR.mkdir(parents=True, exist_ok=True)

PROMPT = '''Eres un product engineer senior para una plataforma legal-laboral llamada AuditaPatron/CompliLink. Debes elegir el siguiente incremento PRIORITARIO a implementar ahora mismo, buscando máximo valor operativo, bajo riesgo, entrega rápida y experiencia "bulletproof".

Estado resumido:
- La landing ya existe y el flujo /auditar ya mejoró consentimiento integrado, estados borrador vs confirmado, reanalizar y métricas básicas.
- El frente de backup en Dropbox ya quedó cerrado operativamente.
- Quedan pendientes reales en TODO.

Opciones candidatas:
A) Mobile flow de /auditar: implementar autoavance seguro después de capturar/elegir archivo cuando la señal del documento sea suficiente, añadir preferencia visible cámara/archivos en un toque y reducir acciones secundarias.
B) Endurecimiento de calidad: actualizar pruebas Vitest/navegador para consentimiento integrado y resiliencia del lock.
C) Completar extras de respaldo: mantener README de respaldo al día, confirmar cada backup, incluir dump/export DB si es viable y descargar artefactos voluminosos a Dropbox cuando convenga.

Devuelve SOLO JSON válido con esta forma exacta:
{
  "winner": "A|B|C",
  "title": "",
  "why_now": "",
  "user_value": "",
  "delivery_scope": ["", "", ""],
  "risk_guardrails": ["", "", ""],
  "defer_reason_for_others": {
    "A": "",
    "B": "",
    "C": ""
  },
  "suggested_first_files": ["", "", ""],
  "success_metrics": [""]
}
'''


def save(name: str, payload: object) -> None:
    (BASE_DIR / name).write_text(json.dumps(payload, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def post_json(url: str, headers: dict[str, str], body: dict) -> dict:
    response = requests.post(url, headers=headers, json=body, timeout=90)
    try:
        data = response.json()
    except Exception:
        data = {'status_code': response.status_code, 'text': response.text}
    return {'status_code': response.status_code, 'body': data}


openai_key = os.environ.get('OPENAI_API_KEY')
xai_key = os.environ.get('XAI_API_KEY')
gemini_key = os.environ.get('GEMINI_API_KEY')

if openai_key:
    save(
        'openai_next_priority.json',
        post_json(
            'https://api.openai.com/v1/chat/completions',
            {
                'Authorization': f'Bearer {openai_key}',
                'Content-Type': 'application/json',
            },
            {
                'model': 'gpt-4o-mini',
                'temperature': 0.2,
                'response_format': {'type': 'json_object'},
                'messages': [
                    {'role': 'system', 'content': 'Responde solo JSON válido.'},
                    {'role': 'user', 'content': PROMPT},
                ],
            },
        ),
    )
else:
    save('openai_next_priority.json', {'error': 'OPENAI_API_KEY no disponible'})

if xai_key:
    save(
        'grok_next_priority.json',
        post_json(
            'https://api.x.ai/v1/chat/completions',
            {
                'Authorization': f'Bearer {xai_key}',
                'Content-Type': 'application/json',
            },
            {
                'model': 'grok-4',
                'temperature': 0.2,
                'response_format': {'type': 'json_object'},
                'messages': [
                    {'role': 'system', 'content': 'Responde solo JSON válido.'},
                    {'role': 'user', 'content': PROMPT},
                ],
            },
        ),
    )
else:
    save('grok_next_priority.json', {'error': 'XAI_API_KEY no disponible'})

if gemini_key:
    save(
        'gemini_next_priority.json',
        post_json(
            f'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={gemini_key}',
            {'Content-Type': 'application/json'},
            {
                'contents': [{'parts': [{'text': PROMPT}]}],
                'generationConfig': {
                    'temperature': 0.2,
                    'responseMimeType': 'application/json',
                },
            },
        ),
    )
else:
    save('gemini_next_priority.json', {'error': 'GEMINI_API_KEY no disponible'})

print(str(BASE_DIR))
