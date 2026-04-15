import json
import os
from pathlib import Path

import requests

PROJECT_ROOT = Path('/home/ubuntu/complilink_operativo_v1')
OUTPUT_DIR = PROJECT_ROOT / 'tmp'
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
OUTPUT_PATH = OUTPUT_DIR / 'multi_ai_ceo_next_steps.json'

PROMPT = """
Eres un revisor senior de UX, autenticación y correo transaccional. Analiza este caso real y responde solo JSON válido.

Contexto real actual:
1. El flujo de acceso CEO por código de correo ya tiene un fallback temporal en backend: cuando Resend responde 403 porque el proyecto solo puede enviar correos de prueba al buzón permitido, el sistema reintenta solo para el propietario usando OWNER_BACKUP_EMAIL.
2. Ese fallback ya está cubierto con pruebas unitarias.
3. Ahora queremos completar tres pasos con el menor riesgo posible:
   a) hacer explícito en la pantalla /acceso cuándo el código fue enviado al buzón de respaldo del propietario;
   b) añadir una prueba E2E del flujo completo de pedir código y validarlo;
   c) preparar la salida del fallback temporal cuando el dominio propio de Resend quede verificado.
4. Queremos una solución simple para usuario mexicano no técnico. Debe explicar la situación sin sonar alarmista ni técnica.
5. El frontend ya muestra un statusMessage después de pedir el código y un errorMessage cuando algo falla.
6. El backend puede enriquecer la respuesta del requestEmailCode con flags adicionales si eso simplifica la UX.
7. No queremos abrir caminos ambiguos ni afectar a usuarios que no son el propietario.

Devuelve JSON exacto con esta forma:
{
  "model_position": "string breve",
  "ui_notice_copy": "string",
  "ui_notice_behavior": ["paso 1", "paso 2", "paso 3"],
  "api_contract": ["campo 1", "campo 2", "campo 3"],
  "e2e_strategy": ["paso 1", "paso 2", "paso 3"],
  "resend_exit_plan": ["paso 1", "paso 2", "paso 3"],
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
    output = {
        'ui_notice_copy_candidates': [],
        'ui_notice_behavior': [],
        'api_contract': [],
        'e2e_strategy': [],
        'resend_exit_plan': [],
        'risk_notes': [],
    }
    for provider, data in results.items():
        if not isinstance(data, dict):
            continue
        if data.get('ui_notice_copy'):
            output['ui_notice_copy_candidates'].append(f"{provider}: {data['ui_notice_copy']}")
        for key in ['ui_notice_behavior', 'api_contract', 'e2e_strategy', 'resend_exit_plan', 'risk_notes']:
            for item in data.get(key, []) or []:
                output[key].append(f"{provider}: {item}")
    return output


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
