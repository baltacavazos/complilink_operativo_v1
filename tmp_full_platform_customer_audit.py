import json
import os
import requests
from datetime import datetime
from pathlib import Path

BASE = Path('/home/ubuntu/complilink_operativo_v1')
PAGE_BASE = Path('/home/ubuntu/page_texts')

files_to_read = {
    'landing_md': PAGE_BASE / '3000-ifwslt4380ij879g0ghvu-446467cd.us2.manus.computer.md',
    'auditar_md': PAGE_BASE / '3000-ifwslt4380ij879g0ghvu-446467cd.us2.manus.computer_auditar.md',
    'acceso_md': PAGE_BASE / '3000-ifwslt4380ij879g0ghvu-446467cd.us2.manus.computer_acceso.md',
    'initial_notes_md': BASE / 'tmp_customer_audit_notes.md',
}

materials = {}
for key, path in files_to_read.items():
    materials[key] = path.read_text(encoding='utf-8') if path.exists() else ''

PROMPT = f"""
Actúa como un cliente real en México que llega por primera vez a Auditapatron y también como consultor senior de UX/conversión especializado en simplificación extrema.

Tu objetivo es auditar la plataforma actual para detectar TODO lo que sea:
- confuso,
- redundante,
- demasiado explicado,
- poco elemental,
- distractor del objetivo principal,
- o mezcla innecesaria de experiencias/roles.

Contexto del producto:
- Auditapatron ayuda a trabajadores a subir un recibo, CFDI o documento laboral para detectar diferencias en pagos, deducciones o CFDI.
- La plataforma debe sentirse muy simple, muy clara, muy confiable y enfocada en que el usuario haga solo lo esencial.
- El usuario dueño del proyecto quiere dejar la plataforma ya lo más simplificada y funcional posible.

Materiales a auditar:

[LANDING]
{materials['landing_md'][:18000]}

[/AUDITAR]
{materials['auditar_md'][:18000]}

[/ACCESO]
{materials['acceso_md'][:12000]}

[NOTAS INICIALES]
{materials['initial_notes_md'][:12000]}

Devuelve EXCLUSIVAMENTE JSON válido con esta estructura exacta:
{{
  "overall_verdict": "aprobada_con_ruido" | "necesita_simplificacion_fuerte" | "confusa_para_usuario_nuevo",
  "confidence": 0,
  "top_summary": "máximo 35 palabras",
  "biggest_confusions": [
    {{"surface": "landing|auditar|acceso", "issue": "", "severity": "alta|media|baja", "why_it_hurts": ""}}
  ],
  "redundancies": [
    {{"surface": "landing|auditar|acceso", "element": "", "reason": ""}}
  ],
  "not_elemental_for_user": [
    {{"surface": "landing|auditar|acceso", "element": "", "reason": ""}}
  ],
  "remove_now": ["cambio 1", "cambio 2", "cambio 3", "cambio 4", "cambio 5"],
  "simplify_now": ["cambio 1", "cambio 2", "cambio 3", "cambio 4", "cambio 5"],
  "keep_as_is": ["elemento 1", "elemento 2", "elemento 3"],
  "ideal_user_journey": ["paso 1", "paso 2", "paso 3", "paso 4"],
  "copy_warnings": ["warning 1", "warning 2", "warning 3"],
  "priority_order": ["prioridad 1", "prioridad 2", "prioridad 3", "prioridad 4", "prioridad 5"],
  "final_recommendation": "máximo 80 palabras"
}}

Criterios obligatorios:
- Sé duro y práctico.
- Prioriza reducir fricción y reducir carga mental.
- Si algo parece útil pero no es elemental para el primer uso, márcalo como secundario o para ocultar.
- Penaliza fuerte cualquier mezcla entre experiencia de usuario común y elementos CEO/operativos.
- Penaliza cualquier copy interno, técnico o repetitivo.
- No expliques nada fuera del JSON.
"""


def post_json(url, headers=None, payload=None, timeout=90):
    r = requests.post(url, headers=headers or {}, json=payload or {}, timeout=timeout)
    r.raise_for_status()
    return r.json()


def extract_json(text):
    text = text.strip()
    if text.startswith('```'):
        lines = text.splitlines()
        if len(lines) >= 3:
            text = '\n'.join(lines[1:-1]).strip()
    start = text.find('{')
    end = text.rfind('}')
    if start != -1 and end != -1 and end > start:
        text = text[start:end+1]
    return json.loads(text)


def ask_openai():
    key = os.environ.get('OPENAI_API_KEY')
    if not key:
        return {'error': 'OPENAI_API_KEY missing'}
    payload = {
        'model': 'gpt-4.1-mini',
        'temperature': 0.2,
        'response_format': {'type': 'json_object'},
        'messages': [
            {'role': 'system', 'content': 'Eres auditor de UX y conversión. Responde solo JSON válido.'},
            {'role': 'user', 'content': PROMPT},
        ],
    }
    data = post_json(
        'https://api.openai.com/v1/chat/completions',
        headers={'Authorization': f'Bearer {key}', 'Content-Type': 'application/json'},
        payload=payload,
    )
    return extract_json(data['choices'][0]['message']['content'])


def ask_grok():
    key = os.environ.get('XAI_API_KEY')
    if not key:
        return {'error': 'XAI_API_KEY missing'}
    payload = {
        'model': 'grok-3-mini',
        'temperature': 0.2,
        'response_format': {'type': 'json_object'},
        'messages': [
            {'role': 'system', 'content': 'Eres auditor de UX y conversión. Responde solo JSON válido.'},
            {'role': 'user', 'content': PROMPT},
        ],
    }
    data = post_json(
        'https://api.x.ai/v1/chat/completions',
        headers={'Authorization': f'Bearer {key}', 'Content-Type': 'application/json'},
        payload=payload,
    )
    return extract_json(data['choices'][0]['message']['content'])


def ask_gemini():
    key = os.environ.get('GEMINI_API_KEY')
    if not key:
        return {'error': 'GEMINI_API_KEY missing'}

    payload = {
        'contents': [{'parts': [{'text': PROMPT}]}],
        'generationConfig': {
            'temperature': 0.2,
            'responseMimeType': 'application/json',
        },
    }

    models = ['gemini-2.5-flash', 'gemini-1.5-flash', 'gemini-1.5-pro']
    last_error = None
    for model in models:
        url = f'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={key}'
        try:
            data = post_json(url, headers={'Content-Type': 'application/json'}, payload=payload)
            return extract_json(data['candidates'][0]['content']['parts'][0]['text'])
        except Exception as exc:
            last_error = f'{model}: {exc}'

    return {'error': last_error or 'gemini_failed'}


def safe_call(fn):
    try:
        return fn()
    except Exception as exc:
        return {'error': str(exc)}


def main():
    results = {
        'generated_at': datetime.utcnow().isoformat() + 'Z',
        'results': {
            'chatgpt': safe_call(ask_openai),
            'grok': safe_call(ask_grok),
            'gemini': safe_call(ask_gemini),
        },
    }
    out = BASE / 'tmp_full_platform_customer_audit_results.json'
    out.write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding='utf-8')
    print(str(out))


if __name__ == '__main__':
    main()
