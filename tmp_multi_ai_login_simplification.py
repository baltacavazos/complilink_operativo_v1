import json
import os
import requests

PROMPT = '''Contexto resumido del login móvil actual de AuditaPatron:
- El acceso principal visible es por código enviado al correo.
- La pantalla actual todavía muestra demasiadas capas: explicación del CEO, aviso de estabilidad del dominio, opción secundaria adicional, estado del OTP, reenvío, usar otro correo y errores largos.
- En móvil el usuario lo percibe como caótico y confuso.
- El usuario quiere la forma más sencilla posible de iniciar sesión.
- Restricción práctica: hoy el mecanismo estable es correo con código; no queremos obligar al usuario a entender varias rutas de acceso.
- El objetivo es que el flujo se sienta casi mágico y muy claro para usuarios recurrentes.

Quiero una recomendación de producto y UX para este caso. Responde en JSON válido con estas claves exactas:
{
  "recommended_primary_flow": "string",
  "must_remove": ["string"],
  "must_keep": ["string"],
  "otp_error_strategy": "string",
  "returning_user_strategy": "string",
  "screen_structure": ["string"],
  "microcopy_example": {
    "headline": "string",
    "subheadline": "string",
    "email_label": "string",
    "cta_request_code": "string",
    "code_label": "string",
    "cta_verify": "string",
    "expired_error": "string"
  }
}

Prioriza simplicidad extrema, confianza y mínimo esfuerzo cognitivo en móvil. No propongas múltiples rutas principales a la vez.'''


def ask_openai():
    key = os.getenv('OPENAI_API_KEY')
    if not key:
        return {'provider': 'openai', 'error': 'OPENAI_API_KEY missing'}
    url = 'https://api.openai.com/v1/chat/completions'
    payload = {
        'model': 'gpt-4o-mini',
        'messages': [
            {'role': 'system', 'content': 'Eres un experto en UX de autenticación móvil. Devuelve JSON válido y conciso.'},
            {'role': 'user', 'content': PROMPT},
        ],
        'response_format': {'type': 'json_object'},
        'temperature': 0.2,
    }
    r = requests.post(url, headers={'Authorization': f'Bearer {key}', 'Content-Type': 'application/json'}, json=payload, timeout=90)
    r.raise_for_status()
    content = r.json()['choices'][0]['message']['content']
    return {'provider': 'openai', 'response': json.loads(content)}


def ask_grok():
    key = os.getenv('XAI_API_KEY')
    if not key:
        return {'provider': 'grok', 'error': 'XAI_API_KEY missing'}
    url = 'https://api.x.ai/v1/chat/completions'
    payload = {
        'model': 'grok-3-mini',
        'messages': [
            {'role': 'system', 'content': 'Eres un experto en UX de autenticación móvil. Devuelve JSON válido y conciso.'},
            {'role': 'user', 'content': PROMPT},
        ],
        'response_format': {'type': 'json_object'},
        'temperature': 0.2,
    }
    r = requests.post(url, headers={'Authorization': f'Bearer {key}', 'Content-Type': 'application/json'}, json=payload, timeout=90)
    r.raise_for_status()
    content = r.json()['choices'][0]['message']['content']
    return {'provider': 'grok', 'response': json.loads(content)}


def ask_gemini():
    key = os.getenv('GEMINI_API_KEY')
    if not key:
        return {'provider': 'gemini', 'error': 'GEMINI_API_KEY missing'}
    url = f'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={key}'
    schema = {
        'type': 'OBJECT',
        'properties': {
            'recommended_primary_flow': {'type': 'STRING'},
            'must_remove': {'type': 'ARRAY', 'items': {'type': 'STRING'}},
            'must_keep': {'type': 'ARRAY', 'items': {'type': 'STRING'}},
            'otp_error_strategy': {'type': 'STRING'},
            'returning_user_strategy': {'type': 'STRING'},
            'screen_structure': {'type': 'ARRAY', 'items': {'type': 'STRING'}},
            'microcopy_example': {
                'type': 'OBJECT',
                'properties': {
                    'headline': {'type': 'STRING'},
                    'subheadline': {'type': 'STRING'},
                    'email_label': {'type': 'STRING'},
                    'cta_request_code': {'type': 'STRING'},
                    'code_label': {'type': 'STRING'},
                    'cta_verify': {'type': 'STRING'},
                    'expired_error': {'type': 'STRING'},
                },
                'required': ['headline', 'subheadline', 'email_label', 'cta_request_code', 'code_label', 'cta_verify', 'expired_error'],
            },
        },
        'required': ['recommended_primary_flow', 'must_remove', 'must_keep', 'otp_error_strategy', 'returning_user_strategy', 'screen_structure', 'microcopy_example'],
    }
    payload = {
        'contents': [{'parts': [{'text': PROMPT}]}],
        'generationConfig': {
            'temperature': 0.2,
            'responseMimeType': 'application/json',
            'responseSchema': schema,
        },
    }
    r = requests.post(url, headers={'Content-Type': 'application/json'}, json=payload, timeout=90)
    r.raise_for_status()
    content = r.json()['candidates'][0]['content']['parts'][0]['text']
    return {'provider': 'gemini', 'response': json.loads(content)}


def main():
    results = []
    for fn in (ask_openai, ask_grok, ask_gemini):
        try:
            results.append(fn())
        except Exception as e:
            results.append({'provider': fn.__name__, 'error': str(e)})
    print(json.dumps(results, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
