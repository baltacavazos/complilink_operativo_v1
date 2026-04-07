import json
import os
import pathlib
import textwrap
import time
from typing import Any

import requests

BASE_DIR = pathlib.Path('/home/ubuntu/complilink_operativo_v1')
OUT_DIR = BASE_DIR / 'research' / 'helios_next_steps'
OUT_DIR.mkdir(parents=True, exist_ok=True)

PROMPT = textwrap.dedent('''
Eres un principal product designer y staff engineer. Debes proponer cambios mínimos, claros y mobile-first para AuditaPatron.

Contexto del producto:
- AuditaPatron ayuda a trabajadores a subir documentos laborales y entenderlos con lenguaje simple.
- Helios debe sentirse como el cerebro central del expediente: interpreta documentos, separa lo claro de lo estimado, fortalece el expediente y sugiere el siguiente paso.
- La experiencia debe seguir siendo extremadamente simple, autoexplicativa y poco técnica.
- No queremos una UI tipo chatbot. Helios debe sentirse integrado al flujo normal del producto.

Contexto visible actual de la home:
- Hero principal: "Tus derechos laborales, claros, protegidos y mejor respaldados."
- Subcopy: "Helios interpreta tus documentos, separa lo claro de lo estimado y fortalece tu expediente sin complicaciones."
- Tarjeta derecha: "Helios ordena tu expediente y fortalece tu respaldo", con barra de "Claridad acumulada" y tres mensajes simples.

Contexto visible actual de /auditar:
- Ya existe opinión preliminar visible de Helios para el último documento y también por documento dentro del expediente.
- Existen estados y vocabulario ya definidos en backend para Helios.
- Status permitidos: pending_dispatch, sent, processing, completed, partial, error, timeout, not_configured.
- Modo permitido: mock o remote.
- El contrato actual de opinión incluye: engine=helios, mode, traceId, tenantId, caseId, documentId, requestedOpinionType=labor_preliminary_opinion, status y opinion.

Necesitamos definir la siguiente ronda aprobada por el usuario:
1. un microestado visible que indique cuándo Helios está interpretando un documento o fortaleciendo el expediente,
2. una sección muy breve que explique qué hace Helios por la persona usuaria,
3. la preparación técnica mínima para una futura evolución a modo remoto, sin rehacer la interfaz.

Restricciones:
- Mobile-first.
- Nada de jerga técnica en lo visible.
- Cambios mínimos, no rediseño completo.
- Debe sentirse humano, confiable y claro.
- Helios debe verse como cerebro central, no como adorno.
- Reutilizar al máximo el contrato existente.

Devuelve SOLO JSON válido con esta forma exacta:
{
  "design_direction": "string corto",
  "home_explainer": {
    "section_title": "string",
    "section_intro": "string",
    "cards": [
      {"title": "string", "body": "string"},
      {"title": "string", "body": "string"},
      {"title": "string", "body": "string"}
    ]
  },
  "auditar_microstate": {
    "placement": "string",
    "title": "string",
    "body": "string",
    "status_mapping": [
      {"status": "pending_dispatch", "label": "string", "description": "string"},
      {"status": "sent", "label": "string", "description": "string"},
      {"status": "processing", "label": "string", "description": "string"},
      {"status": "completed", "label": "string", "description": "string"},
      {"status": "partial", "label": "string", "description": "string"},
      {"status": "error", "label": "string", "description": "string"},
      {"status": "timeout", "label": "string", "description": "string"},
      {"status": "not_configured", "label": "string", "description": "string"}
    ]
  },
  "remote_ready_contract": {
    "ui_rule": "string",
    "backend_rule": "string",
    "mode_strategy": "string",
    "minimum_fields": ["string", "string", "string"],
    "future_events": ["string", "string", "string"]
  },
  "copy_principles": ["string", "string", "string"],
  "implementation_priority": ["string", "string", "string"],
  "risks_to_avoid": ["string", "string", "string"]
}
''').strip()


def call_openai() -> dict[str, Any]:
    api_key = os.environ.get('OPENAI_API_KEY')
    if not api_key:
        return {"provider": "openai", "ok": False, "error": "OPENAI_API_KEY missing"}
    payload = {
        "model": "gpt-4.1-mini",
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": "Responde únicamente con JSON válido."},
            {"role": "user", "content": PROMPT},
        ],
        "temperature": 0.4,
    }
    response = requests.post(
        'https://api.openai.com/v1/chat/completions',
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
    parsed = json.loads(content)
    return {"provider": "openai", "ok": True, "model": payload['model'], "result": parsed, "raw": data}


def call_grok() -> dict[str, Any]:
    api_key = os.environ.get('XAI_API_KEY')
    if not api_key:
        return {"provider": "grok", "ok": False, "error": "XAI_API_KEY missing"}
    payload = {
        "model": "grok-4-0709",
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": "Responde únicamente con JSON válido."},
            {"role": "user", "content": PROMPT},
        ],
        "temperature": 0.4,
    }
    response = requests.post(
        'https://api.x.ai/v1/chat/completions',
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
    parsed = json.loads(content)
    return {"provider": "grok", "ok": True, "model": payload['model'], "result": parsed, "raw": data}


def call_gemini() -> dict[str, Any]:
    api_key = os.environ.get('GEMINI_API_KEY')
    if not api_key:
        return {"provider": "gemini", "ok": False, "error": "GEMINI_API_KEY missing"}
    payload = {
        "contents": [{
            "role": "user",
            "parts": [{"text": PROMPT}]
        }],
        "generationConfig": {
            "temperature": 0.4,
            "responseMimeType": "application/json"
        }
    }
    url = f'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}'
    response = requests.post(url, headers={'Content-Type': 'application/json'}, json=payload, timeout=120)
    response.raise_for_status()
    data = response.json()
    candidates = data.get('candidates', [])
    if not candidates:
        raise RuntimeError('Gemini returned no candidates')
    parts = candidates[0].get('content', {}).get('parts', [])
    text = ''.join(part.get('text', '') for part in parts)
    parsed = json.loads(text)
    return {"provider": "gemini", "ok": True, "model": 'gemini-2.5-flash', "result": parsed, "raw": data}


def safe_call(name: str, fn):
    started = time.time()
    try:
        result = fn()
        result['elapsed_seconds'] = round(time.time() - started, 2)
        return result
    except Exception as exc:
        return {
            "provider": name,
            "ok": False,
            "error": f"{type(exc).__name__}: {exc}",
            "elapsed_seconds": round(time.time() - started, 2),
        }


results = {
    'openai': safe_call('openai', call_openai),
    'grok': safe_call('grok', call_grok),
    'gemini': safe_call('gemini', call_gemini),
}

for provider, data in results.items():
    path = OUT_DIR / f'{provider}.json'
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding='utf-8')

summary = {
    'generated_at': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
    'providers': {provider: {'ok': data.get('ok', False), 'elapsed_seconds': data.get('elapsed_seconds')} for provider, data in results.items()},
}
(OUT_DIR / 'summary.json').write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding='utf-8')

print(json.dumps(summary, ensure_ascii=False, indent=2))
