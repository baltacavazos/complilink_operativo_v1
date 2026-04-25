#!/usr/bin/env python3
import json
import os
import urllib.request
import urllib.error
from pathlib import Path

ROOT = Path('/home/ubuntu/complilink_operativo_v1')
REPORT_PATH = Path('/home/ubuntu/upload/pasted_content_2.txt')
OUT_PATH = ROOT / 'tmp' / 'multi_ai_report_v2_review.json'
OUT_PATH.parent.mkdir(parents=True, exist_ok=True)

report_text = REPORT_PATH.read_text(encoding='utf-8')

current_state = {
    "public_privacy_route": "Existe la ruta pública /legal/privacidad en App.tsx.",
    "current_cta": "Home y /auditar usan actualmente 'Subir mi documento gratis'.",
    "public_ceo_visibility": "El nav público ya no muestra 'Consola CEO'; Access devuelve 'tu panel privado' cuando returnTo empieza con /ceo.",
    "ceo_surface": "La ruta /ceo sigue existiendo internamente y la UI ya muestra mensaje owner-only visible en CeoDashboard.",
    "home_privacy_copy": "Home ya muestra copy fuerte de privacidad, incluyendo 'Nadie de tu empresa puede ver lo que subes'.",
    "hero_state": "El hero actual enfatiza subir un documento y recibir claridad rápida; aún no está reescrito al enfoque visceral de recibo de nómina como wedge único.",
    "audit_state": "/auditar ya usa CTA principal unificado y flujo móvil priorizado; el texto no está reducido aún a la versión ultra mínima propuesta por el reporte.",
    "legal_state": "LegalDocuments ya tiene resumen humano previo al texto completo.",
    "validation_state": "La última ronda quedó con Playwright completo en verde y checkpoint reciente; se busca evitar romper pruebas estabilizadas sin un beneficio claro.",
}

prompt = f'''Analiza el siguiente reporte externo y compáralo contra el estado actual resumido de Auditapatrón.

Quiero que clasifiques cada recomendación en una de estas categorías:
- implement_now
- partially_covered
- defer_high_risk
- reject_for_now

Además, para cada recomendación dame:
1. rationale breve
2. riesgo de conversión (low/medium/high) si no se implementa hoy
3. riesgo técnico (low/medium/high) si se implementa hoy
4. recomendación exacta de ejecución: copy-only, UX-light, structural, or defer

Necesito especial foco en estos puntos:
- CTA cambiar de 'Subir mi documento gratis' a 'Revisar mi recibo gratis'
- hero completamente reescrito al recibo de nómina
- privacidad radical visible y borrado explícito
- renombre del dashboard privado
- /auditar como pantalla de acción pura
- quick wins: dark mode por defecto, botón cerrar rápido, promesa de borrado, ejemplo visual arriba, explicación mínima
- cambios estructurales: escáner pre-login, WhatsApp, demo interactiva, score, ranking

Responde SOLO JSON válido con esta forma:
{{
  "model_position": "string",
  "recommendations": [
    {{
      "id": "string",
      "label": "string",
      "classification": "implement_now|partially_covered|defer_high_risk|reject_for_now",
      "conversion_risk_if_skipped": "low|medium|high",
      "technical_risk_if_done_now": "low|medium|high",
      "execution_type": "copy-only|ux-light|structural|defer",
      "rationale": "string",
      "recommended_action": "string"
    }}
  ],
  "top_5_now": ["string"],
  "top_5_defer": ["string"],
  "notes": "string"
}}

REPORTE EXTERNO:
{report_text}

ESTADO ACTUAL RESUMIDO:
{json.dumps(current_state, ensure_ascii=False, indent=2)}
'''


def post_json(url, payload, headers):
    data = json.dumps(payload).encode('utf-8')
    req = urllib.request.Request(url, data=data, headers=headers, method='POST')
    with urllib.request.urlopen(req, timeout=180) as resp:
        body = resp.read().decode('utf-8')
        return json.loads(body)


def extract_json_text(text):
    text = text.strip()
    if text.startswith('```'):
        parts = text.split('```')
        for part in parts:
            part = part.strip()
            if part.startswith('{') and part.endswith('}'):
                return json.loads(part)
            if '\n' in part:
                maybe = part.split('\n', 1)[1].strip()
                if maybe.startswith('{') and maybe.endswith('}'):
                    return json.loads(maybe)
    return json.loads(text)


def ask_openai():
    key = os.environ.get('OPENAI_API_KEY')
    if not key:
        return {"error": "OPENAI_API_KEY missing"}
    payload = {
        "model": "gpt-4.1-mini",
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": "Eres un auditor experto de UX/CRO y producto. Responde exclusivamente con JSON válido."},
            {"role": "user", "content": prompt},
        ],
    }
    data = post_json(
        'https://api.openai.com/v1/chat/completions',
        payload,
        {
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {key}',
        },
    )
    return extract_json_text(data['choices'][0]['message']['content'])


def ask_grok():
    key = os.environ.get('XAI_API_KEY')
    if not key:
        return {"error": "XAI_API_KEY missing"}
    payload = {
        "model": "grok-4-0709",
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": "Eres un auditor experto de UX/CRO y producto. Responde exclusivamente con JSON válido."},
            {"role": "user", "content": prompt},
        ],
    }
    data = post_json(
        'https://api.x.ai/v1/chat/completions',
        payload,
        {
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {key}',
        },
    )
    return extract_json_text(data['choices'][0]['message']['content'])


def ask_gemini():
    key = os.environ.get('GEMINI_API_KEY')
    if not key:
        return {"error": "GEMINI_API_KEY missing"}
    payload = {
        "generationConfig": {
            "responseMimeType": "application/json"
        },
        "contents": [
            {
                "role": "user",
                "parts": [{"text": prompt}]
            }
        ]
    }
    data = post_json(
        f'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={key}',
        payload,
        {'Content-Type': 'application/json'},
    )
    text = data['candidates'][0]['content']['parts'][0]['text']
    return extract_json_text(text)


result = {}
for name, fn in [("chatgpt", ask_openai), ("grok", ask_grok), ("gemini", ask_gemini)]:
    try:
        result[name] = fn()
    except Exception as exc:
        result[name] = {"error": f"{type(exc).__name__}: {exc}"}

OUT_PATH.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
print(str(OUT_PATH))
