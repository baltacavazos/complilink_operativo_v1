#!/usr/bin/env python3
import json
import os
import requests
import time

api_key = os.environ['XAI_API_KEY']
models = ['grok-3-mini-beta', 'grok-4', 'grok-3-mini']
prompt = 'Devuelve solo JSON: {"top":"una prioridad principal para V1 piloto de un SaaS legal/auditoría", "next_block":"bloque siguiente", "why":"razón corta"}'
last_error = None
for model in models:
    for attempt in range(1, 4):
        try:
            r = requests.post(
                'https://api.x.ai/v1/chat/completions',
                headers={'Authorization': f'Bearer {api_key}', 'Content-Type': 'application/json'},
                json={
                    'model': model,
                    'temperature': 0.1,
                    'messages': [
                        {'role': 'system', 'content': 'Eres un arquitecto SaaS B2B. Devuelve solo JSON válido.'},
                        {'role': 'user', 'content': prompt},
                    ],
                    'response_format': {'type': 'json_object'},
                },
                timeout=30,
            )
            if r.status_code == 429 and attempt < 3:
                time.sleep(10 * attempt)
                continue
            r.raise_for_status()
            data = r.json()
            text = data['choices'][0]['message']['content']
            print(json.dumps({'model': model, 'text': text}, ensure_ascii=False, indent=2))
            raise SystemExit(0)
        except Exception as exc:
            last_error = {'model': model, 'attempt': attempt, 'error': str(exc)}
            if attempt < 3:
                time.sleep(10 * attempt)
                continue
            break

print(json.dumps({'error': last_error}, ensure_ascii=False, indent=2))
raise SystemExit(1)
