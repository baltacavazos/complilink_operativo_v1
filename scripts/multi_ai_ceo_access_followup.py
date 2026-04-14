import json
import os
from pathlib import Path

import requests

PROJECT_ROOT = Path('/home/ubuntu/complilink_operativo_v1')
OUTPUT_DIR = PROJECT_ROOT / 'tmp'
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
OUTPUT_PATH = OUTPUT_DIR / 'multi_ai_ceo_access_followup.json'

PROMPT = """
Eres un revisor senior de producto, UX móvil y autenticación web. Analiza este caso real y responde solo JSON válido.

Contexto real auditado:
1. En el dominio público auditapatron.com el acceso con Manus ya está deshabilitado porque en ese dominio disparaba el error 'Redirect URI is not set'.
2. La pantalla /acceso prioriza ahora el acceso por código de correo.
3. El usuario reporta dos problemas persistentes en iPhone: (a) la vista sigue viéndose descuadrada o corrida hacia la derecha; (b) no queda claro cómo entra el CEO.
4. En el código actual de /acceso hay una tarjeta principal con título largo, una caja de 'Ruta objetivo', una tarjeta oscura principal, dos tarjetas secundarias en grid y luego el formulario de correo.
5. El layout usa container global con padding horizontal y la página ya tiene overflow-x-hidden en el main, pero la captura móvil todavía sugiere que algo conserva ancho mínimo excesivo o jerarquía visual demasiado densa.
6. En backend, el propietario solo queda automáticamente como admin/CEO cuando la identidad resuelve a la fila canónica del owner; el flujo por correo debe dejar clarísimo qué correo debe usar el CEO y, si hace falta, reforzar la canonicalización por email del propietario.
7. Se busca la solución mínima, robusta y de bajo riesgo: una pantalla mobile-first 100% centrada, sin scroll lateral, y una instrucción explícita para el CEO.
8. No queremos añadir complejidad visual ni múltiples caminos ambiguos. Debe sentirse obvio para un usuario mexicano no técnico.

Devuelve JSON con esta forma exacta:
{
  "model_position": "string breve",
  "mobile_layout_root_cause": "string",
  "mobile_layout_fix": ["paso 1", "paso 2", "paso 3"],
  "ceo_signin_root_cause": "string",
  "ceo_signin_fix": ["paso 1", "paso 2", "paso 3"],
  "recommended_primary_copy": "string",
  "recommended_ceo_copy": "string",
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
    layout = []
    ceo = []
    primary_copy = []
    ceo_copy = []
    risks = []
    for provider, data in results.items():
        if not isinstance(data, dict):
            continue
        if data.get('mobile_layout_root_cause'):
            layout.append(f"{provider}: {data['mobile_layout_root_cause']}")
        for item in data.get('mobile_layout_fix', []) or []:
            layout.append(f"{provider}: {item}")
        if data.get('ceo_signin_root_cause'):
            ceo.append(f"{provider}: {data['ceo_signin_root_cause']}")
        for item in data.get('ceo_signin_fix', []) or []:
            ceo.append(f"{provider}: {item}")
        if data.get('recommended_primary_copy'):
            primary_copy.append(f"{provider}: {data['recommended_primary_copy']}")
        if data.get('recommended_ceo_copy'):
            ceo_copy.append(f"{provider}: {data['recommended_ceo_copy']}")
        for item in data.get('risk_notes', []) or []:
            risks.append(f"{provider}: {item}")
    return {
        'layout_consensus': layout,
        'ceo_consensus': ceo,
        'primary_copy_candidates': primary_copy,
        'ceo_copy_candidates': ceo_copy,
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
