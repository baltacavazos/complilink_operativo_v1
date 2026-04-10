#!/usr/bin/env python3
import json
import os
import requests

api_key = os.environ['GEMINI_API_KEY']
models = ['gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-2.5-flash']
prompt = 'Devuelve solo JSON: {"top":"una prioridad principal para V1 piloto de un SaaS legal/auditoría", "next_block":"bloque siguiente", "why":"razón corta"}'

last_error = None
for model in models:
    url = f'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}'
    body = {
        'contents': [{'parts': [{'text': prompt}]}],
        'generationConfig': {'temperature': 0.1, 'responseMimeType': 'application/json'}
    }
    try:
        r = requests.post(url, headers={'Content-Type': 'application/json'}, json=body, timeout=30)
        r.raise_for_status()
        data = r.json()
        text = data['candidates'][0]['content']['parts'][0]['text']
        print(json.dumps({'model': model, 'text': text}, ensure_ascii=False, indent=2))
        raise SystemExit(0)
    except Exception as exc:
        last_error = {'model': model, 'error': str(exc)}
        continue

print(json.dumps({'error': last_error}, ensure_ascii=False, indent=2))
raise SystemExit(1)
