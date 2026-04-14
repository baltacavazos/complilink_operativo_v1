#!/usr/bin/env python3
import json
import os
from pathlib import Path

import requests

PROJECT_ROOT = Path('/home/ubuntu/complilink_operativo_v1')
OUTPUT_DIR = PROJECT_ROOT / 'tmp'
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
OUTPUT_PATH = OUTPUT_DIR / 'multi_ai_access_layout_audit.json'

PROMPT = """
Eres un revisor senior de producto y autenticación web. Analiza este caso real y responde solo JSON válido.

Contexto real auditado:
1. En móvil, el login con Manus abre manus.im y muestra: 'Permission denied' + 'Redirect URI is not set'.
2. El frontend construye la URL de login así:
   - usa VITE_OAUTH_PORTAL_URL + '/app-auth'
   - envía appId
   - envía redirectUri apuntando a /api/oauth/callback en window.location.origin
   - envía state = base64(redirectUri.toString())
   - envía type='signIn'
3. El backend en server/_core/sdk.ts, al intercambiar el code, manda redirectUri = atob(state).
4. El callback backend redirige a /acceso con error manus_callback_failed cuando algo sale mal.
5. La pantalla /acceso en móvil se ve descuadrada; el screenshot y el código sugieren overflow horizontal. Hay píldoras y bloques con texto largo como 'Ruta objetivo: {returnTo}' y un encabezado con justify-between.
6. Se busca la corrección mínima, robusta y de bajo riesgo. Mantener login por correo como fallback. Evitar complejidad extra.

Devuelve JSON con esta forma exacta:
{
  "model_position": "string breve",
  "oauth_root_cause": "string",
  "oauth_fix": ["paso 1", "paso 2"],
  "layout_root_cause": "string",
  "layout_fix": ["paso 1", "paso 2"],
  "risk_notes": ["nota 1", "nota 2"],
  "confidence": "low|medium|high"
}
""".strip()


def call_openai(prompt: str):
    api_key = os.environ.get('OPENAI_API_KEY')
    if not api_key:
        return {"error": "OPENAI_API_KEY missing"}
    headers = {
        'Authorization': f'Bearer {api_key}',
        'Content-Type': 'application/json',
    }
    payload = {
        'model': 'gpt-4.1-mini',
        'response_format': {'type': 'json_object'},
        'messages': [
            {'role': 'system', 'content': 'Responde únicamente con JSON válido.'},
            {'role': 'user', 'content': prompt},
        ],
        'temperature': 0.2,
    }
    response = requests.post('https://api.openai.com/v1/chat/completions', headers=headers, json=payload, timeout=90)
    response.raise_for_status()
    content = response.json()['choices'][0]['message']['content']
    return json.loads(content)


def call_grok(prompt: str):
    api_key = os.environ.get('XAI_API_KEY')
    if not api_key:
        return {"error": "XAI_API_KEY missing"}
    headers = {
        'Authorization': f'Bearer {api_key}',
        'Content-Type': 'application/json',
    }
    payload = {
        'model': 'grok-3-mini',
        'response_format': {'type': 'json_object'},
        'messages': [
            {'role': 'system', 'content': 'Responde únicamente con JSON válido.'},
            {'role': 'user', 'content': prompt},
        ],
        'temperature': 0.2,
    }
    response = requests.post('https://api.x.ai/v1/chat/completions', headers=headers, json=payload, timeout=90)
    response.raise_for_status()
    content = response.json()['choices'][0]['message']['content']
    return json.loads(content)


def call_gemini(prompt: str):
    api_key = os.environ.get('GEMINI_API_KEY')
    if not api_key:
        return {"error": "GEMINI_API_KEY missing"}
    url = f'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}'
    payload = {
        'generationConfig': {
            'temperature': 0.2,
            'responseMimeType': 'application/json',
        },
        'contents': [
            {
                'role': 'user',
                'parts': [{'text': prompt}],
            }
        ],
    }
    response = requests.post(url, json=payload, timeout=90)
    response.raise_for_status()
    content = response.json()['candidates'][0]['content']['parts'][0]['text']
    return json.loads(content)


def normalize(value):
    if isinstance(value, dict):
        return value
    return {'raw': value}


def build_consensus(results):
    oauth_causes = []
    layout_causes = []
    oauth_fixes = []
    layout_fixes = []
    risks = []
    for provider, data in results.items():
        if isinstance(data, dict):
            if data.get('oauth_root_cause'):
                oauth_causes.append(f"{provider}: {data['oauth_root_cause']}")
            if data.get('layout_root_cause'):
                layout_causes.append(f"{provider}: {data['layout_root_cause']}")
            for item in data.get('oauth_fix', []) or []:
                oauth_fixes.append(f"{provider}: {item}")
            for item in data.get('layout_fix', []) or []:
                layout_fixes.append(f"{provider}: {item}")
            for item in data.get('risk_notes', []) or []:
                risks.append(f"{provider}: {item}")
    return {
        'oauth_consensus': oauth_causes,
        'oauth_fix_candidates': oauth_fixes,
        'layout_consensus': layout_causes,
        'layout_fix_candidates': layout_fixes,
        'risk_notes': risks,
    }


def main():
    results = {}
    for name, fn in [('openai', call_openai), ('grok', call_grok), ('gemini', call_gemini)]:
        try:
            results[name] = normalize(fn(PROMPT))
        except Exception as exc:
            results[name] = {'error': str(exc)}
    output = {
        'prompt': PROMPT,
        'results': results,
        'consensus': build_consensus(results),
    }
    OUTPUT_PATH.write_text(json.dumps(output, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(str(OUTPUT_PATH))


if __name__ == '__main__':
    main()
