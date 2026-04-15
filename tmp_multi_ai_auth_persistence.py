import json
import os
import sys
import requests

PROMPT = '''Contexto técnico resumido de AuditaPatron:
- El cliente considera autenticado al usuario solo si trpc.auth.me responde con usuario; no restaura sesión desde localStorage.
- El servidor crea sesión con cookie httpOnly y maxAge de 1 año.
- La cookie de sesión usa path=/, secure=true cuando aplica y sameSite=none en HTTPS.
- La cookie no define domain explícito; por tanto es host-only para el dominio exacto que la emitió.
- El login visible en dominio público usa código por correo como flujo principal.
- Usuario reporta que en su teléfono, aunque ya inició sesión varias veces, cada vez debe esperar un código por correo de nuevo.

Pregunta:
1) ¿Esto suena a comportamiento por diseño o a fallo de persistencia?
2) ¿Cuál es la causa más probable?
3) ¿Qué explicación breve darías al usuario?
Responde en JSON con las claves: verdict, likely_cause, user_explanation.'''


def ask_openai():
    key = os.getenv('OPENAI_API_KEY')
    if not key:
        return {'provider': 'openai', 'error': 'OPENAI_API_KEY missing'}
    url = 'https://api.openai.com/v1/chat/completions'
    payload = {
        'model': 'gpt-4o-mini',
        'messages': [
            {'role': 'system', 'content': 'Eres un arquitecto de autenticación. Devuelve JSON válido.'},
            {'role': 'user', 'content': PROMPT},
        ],
        'response_format': {'type': 'json_object'},
        'temperature': 0.1,
    }
    r = requests.post(url, headers={'Authorization': f'Bearer {key}', 'Content-Type': 'application/json'}, json=payload, timeout=60)
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
            {'role': 'system', 'content': 'Eres un arquitecto de autenticación. Devuelve JSON válido.'},
            {'role': 'user', 'content': PROMPT},
        ],
        'response_format': {'type': 'json_object'},
        'temperature': 0.1,
    }
    r = requests.post(url, headers={'Authorization': f'Bearer {key}', 'Content-Type': 'application/json'}, json=payload, timeout=60)
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
            'verdict': {'type': 'STRING'},
            'likely_cause': {'type': 'STRING'},
            'user_explanation': {'type': 'STRING'},
        },
        'required': ['verdict', 'likely_cause', 'user_explanation'],
    }
    payload = {
        'contents': [{'parts': [{'text': PROMPT}]}],
        'generationConfig': {
            'temperature': 0.1,
            'responseMimeType': 'application/json',
            'responseSchema': schema,
        },
    }
    r = requests.post(url, headers={'Content-Type': 'application/json'}, json=payload, timeout=60)
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
