import json
import os
from pathlib import Path

import requests

PROJECT_ROOT = Path('/home/ubuntu/complilink_operativo_v1')
OUTPUT_PATH = PROJECT_ROOT / 'tmp' / 'multi_ai_ceo_email_fix_results.json'
OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)

PROMPT = """
Responde solo JSON válido. Eres un staff engineer de autenticación y deliverability.

Caso real:
- App pública: auditapatron.com
- El acceso CEO prioritario es por código enviado por correo.
- El usuario intentó entrar como CEO con balt@cavazos.com.
- El backend usa Resend con from=onboarding@resend.dev.
- Resend respondió 403 con este mensaje: solo se pueden enviar testing emails al correo propio de la cuenta (baltacavazos85@gmail.com); para enviar a otros destinatarios hay que verificar un dominio y cambiar el from a un email de ese dominio.
- Objetivo: solución mínima, robusta y de bajo riesgo para restaurar ya el acceso CEO.
- Restricciones: no queremos romper el flujo actual, y si hace falta un parche temporal debe ser explícito.

Devuelve JSON exacto con esta forma:
{
  "root_cause": "string",
  "fix_now": ["paso 1", "paso 2", "paso 3"],
  "temporary_fallback": ["paso 1", "paso 2"],
  "code_change_needed": true,
  "config_change_needed": true,
  "best_user_message": "string",
  "risk_notes": ["nota 1", "nota 2"],
  "confidence": "low|medium|high"
}
""".strip()


def call_openai(prompt: str):
    api_key = os.environ.get('OPENAI_API_KEY')
    headers = {'Authorization': f'Bearer {api_key}', 'Content-Type': 'application/json'}
    payload = {
        'model': 'gpt-4.1-mini',
        'response_format': {'type': 'json_object'},
        'messages': [
            {'role': 'system', 'content': 'Responde únicamente con JSON válido.'},
            {'role': 'user', 'content': prompt},
        ],
        'temperature': 0.1,
    }
    response = requests.post('https://api.openai.com/v1/chat/completions', headers=headers, json=payload, timeout=90)
    response.raise_for_status()
    return json.loads(response.json()['choices'][0]['message']['content'])


def call_grok(prompt: str):
    api_key = os.environ.get('XAI_API_KEY')
    headers = {'Authorization': f'Bearer {api_key}', 'Content-Type': 'application/json'}
    payload = {
        'model': 'grok-4-fast-reasoning',
        'response_format': {'type': 'json_object'},
        'messages': [
            {'role': 'system', 'content': 'Responde únicamente con JSON válido.'},
            {'role': 'user', 'content': prompt},
        ],
        'temperature': 0.1,
    }
    response = requests.post('https://api.x.ai/v1/chat/completions', headers=headers, json=payload, timeout=90)
    response.raise_for_status()
    return json.loads(response.json()['choices'][0]['message']['content'])


def call_gemini(prompt: str):
    api_key = os.environ.get('GEMINI_API_KEY')
    url = f'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}'
    payload = {
        'generationConfig': {'temperature': 0.1, 'responseMimeType': 'application/json'},
        'contents': [{'role': 'user', 'parts': [{'text': prompt}]}],
    }
    response = requests.post(url, json=payload, timeout=90)
    response.raise_for_status()
    return json.loads(response.json()['candidates'][0]['content']['parts'][0]['text'])


results = {}
for name, fn in [('openai', call_openai), ('grok', call_grok), ('gemini', call_gemini)]:
    try:
        results[name] = fn(PROMPT)
    except Exception as exc:
        results[name] = {'error': str(exc)}

consensus = {
    'root_causes': {k: v.get('root_cause') for k, v in results.items() if isinstance(v, dict)},
    'fix_now': {k: v.get('fix_now') for k, v in results.items() if isinstance(v, dict)},
    'temporary_fallback': {k: v.get('temporary_fallback') for k, v in results.items() if isinstance(v, dict)},
    'code_change_needed': {k: v.get('code_change_needed') for k, v in results.items() if isinstance(v, dict)},
    'config_change_needed': {k: v.get('config_change_needed') for k, v in results.items() if isinstance(v, dict)},
}

OUTPUT_PATH.write_text(json.dumps({'prompt': PROMPT, 'results': results, 'consensus': consensus}, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(str(OUTPUT_PATH))
