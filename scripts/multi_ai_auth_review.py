import json
import os
import sys
from urllib import request, error

PROMPT = sys.stdin.read()
results = {}


def post_json(url, headers, payload):
    data = json.dumps(payload).encode('utf-8')
    req = request.Request(url, data=data, headers=headers, method='POST')
    with request.urlopen(req, timeout=60) as resp:
        body = resp.read().decode('utf-8')
        return json.loads(body)


def call_openai(prompt):
    api_key = os.environ.get('OPENAI_API_KEY')
    if not api_key:
        return {'error': 'OPENAI_API_KEY missing'}
    payload = {
        'model': 'gpt-4.1-mini',
        'temperature': 0.2,
        'messages': [
            {'role': 'system', 'content': 'Eres un revisor técnico senior. Responde en JSON válido con keys: verdict, blockers, tests, notes.'},
            {'role': 'user', 'content': prompt},
        ],
        'response_format': {
            'type': 'json_schema',
            'json_schema': {
                'name': 'auth_review',
                'schema': {
                    'type': 'object',
                    'properties': {
                        'verdict': {'type': 'string'},
                        'blockers': {'type': 'array', 'items': {'type': 'string'}},
                        'tests': {'type': 'array', 'items': {'type': 'string'}},
                        'notes': {'type': 'array', 'items': {'type': 'string'}},
                    },
                    'required': ['verdict', 'blockers', 'tests', 'notes'],
                    'additionalProperties': False,
                },
                'strict': True,
            },
        },
    }
    data = post_json(
        'https://api.openai.com/v1/chat/completions',
        {'Authorization': f'Bearer {api_key}', 'Content-Type': 'application/json'},
        payload,
    )
    content = data['choices'][0]['message']['content']
    return json.loads(content)


def call_xai(prompt):
    api_key = os.environ.get('XAI_API_KEY')
    if not api_key:
        return {'error': 'XAI_API_KEY missing'}
    payload = {
        'model': 'grok-3-mini',
        'temperature': 0.2,
        'messages': [
            {'role': 'system', 'content': 'Eres un revisor técnico senior. Responde exclusivamente JSON válido con keys: verdict, blockers, tests, notes.'},
            {'role': 'user', 'content': prompt},
        ],
        'response_format': {
            'type': 'json_schema',
            'json_schema': {
                'name': 'auth_review',
                'schema': {
                    'type': 'object',
                    'properties': {
                        'verdict': {'type': 'string'},
                        'blockers': {'type': 'array', 'items': {'type': 'string'}},
                        'tests': {'type': 'array', 'items': {'type': 'string'}},
                        'notes': {'type': 'array', 'items': {'type': 'string'}},
                    },
                    'required': ['verdict', 'blockers', 'tests', 'notes'],
                    'additionalProperties': False,
                },
                'strict': True,
            },
        },
    }
    data = post_json(
        'https://api.x.ai/v1/chat/completions',
        {'Authorization': f'Bearer {api_key}', 'Content-Type': 'application/json'},
        payload,
    )
    content = data['choices'][0]['message']['content']
    return json.loads(content)


def call_gemini(prompt):
    api_key = os.environ.get('GEMINI_API_KEY')
    if not api_key:
        return {'error': 'GEMINI_API_KEY missing'}
    payload = {
        'system_instruction': {
            'parts': [{'text': 'Eres un revisor técnico senior. Responde exclusivamente JSON válido con keys: verdict, blockers, tests, notes.'}]
        },
        'contents': [{'parts': [{'text': prompt}]}],
        'generationConfig': {
            'temperature': 0.2,
            'responseMimeType': 'application/json',
            'responseSchema': {
                'type': 'OBJECT',
                'properties': {
                    'verdict': {'type': 'STRING'},
                    'blockers': {'type': 'ARRAY', 'items': {'type': 'STRING'}},
                    'tests': {'type': 'ARRAY', 'items': {'type': 'STRING'}},
                    'notes': {'type': 'ARRAY', 'items': {'type': 'STRING'}},
                },
                'required': ['verdict', 'blockers', 'tests', 'notes'],
            },
        },
    }
    data = post_json(
        f'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}',
        {'Content-Type': 'application/json'},
        payload,
    )
    text = data['candidates'][0]['content']['parts'][0]['text']
    return json.loads(text)


for name, fn in [('openai', call_openai), ('grok', call_xai), ('gemini', call_gemini)]:
    try:
        results[name] = fn(PROMPT)
    except error.HTTPError as exc:
        body = exc.read().decode('utf-8', errors='ignore')
        results[name] = {'error': f'HTTP {exc.code}', 'body': body[:4000]}
    except Exception as exc:
        results[name] = {'error': repr(exc)}

print(json.dumps(results, ensure_ascii=False, indent=2))
