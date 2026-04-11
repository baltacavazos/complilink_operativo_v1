#!/usr/bin/env python3
import json
import os
import sys
import time
from pathlib import Path

import requests

ROOT = Path('/home/ubuntu/complilink_operativo_v1')
PROMPT_PATH = ROOT / 'tmp' / 'final_review_multi_ai_prompt.md'
OUT_PATH = ROOT / 'tmp' / 'final_review_multi_ai_raw.json'
TIMEOUT = (15, 75)


def log(message: str) -> None:
    print(message, flush=True)


def read_prompt() -> str:
    return PROMPT_PATH.read_text(encoding='utf-8')


def post_json(url: str, headers: dict, payload: dict):
    response = requests.post(url, headers=headers, json=payload, timeout=TIMEOUT)
    response.raise_for_status()
    return response.json()


def ask_openai(prompt: str) -> str:
    api_key = os.environ['OPENAI_API_KEY']
    data = post_json(
        'https://api.openai.com/v1/chat/completions',
        {
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json',
        },
        {
            'model': 'gpt-4.1-mini',
            'temperature': 0.7,
            'max_tokens': 1400,
            'messages': [
                {
                    'role': 'system',
                    'content': 'Eres un crítico senior de UX, landing pages y conversión emocional. Responde en español claro, estratégico y accionable.'
                },
                {'role': 'user', 'content': prompt},
            ],
        },
    )
    return data['choices'][0]['message']['content']


def ask_xai(prompt: str) -> str:
    api_key = os.environ['XAI_API_KEY']
    data = post_json(
        'https://api.x.ai/v1/chat/completions',
        {
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json',
        },
        {
            'model': 'grok-4',
            'temperature': 0.7,
            'max_tokens': 1400,
            'messages': [
                {
                    'role': 'system',
                    'content': 'Eres un crítico senior de UX, landing pages y conversión emocional. Responde en español claro, estratégico y accionable.'
                },
                {'role': 'user', 'content': prompt},
            ],
        },
    )
    return data['choices'][0]['message']['content']


def ask_gemini(prompt: str) -> str:
    api_key = os.environ['GEMINI_API_KEY']
    url = f'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}'
    data = post_json(
        url,
        {'Content-Type': 'application/json'},
        {
            'system_instruction': {
                'parts': [
                    {'text': 'Eres un crítico senior de UX, landing pages y conversión emocional. Responde en español claro, estratégico y accionable.'}
                ]
            },
            'contents': [
                {
                    'parts': [
                        {'text': prompt}
                    ]
                }
            ],
            'generationConfig': {
                'temperature': 0.7,
                'maxOutputTokens': 1400,
            },
        },
    )
    candidates = data.get('candidates', [])
    if not candidates:
        raise RuntimeError(f'Gemini sin candidatos: {json.dumps(data)[:1000]}')
    return ''.join(part.get('text', '') for part in candidates[0]['content']['parts'])


def call_model(name: str, fn, prompt: str, bucket: dict, errors: dict) -> None:
    log(f'==> {name}: iniciando')
    started = time.time()
    try:
        bucket[name] = fn(prompt)
        elapsed = round(time.time() - started, 1)
        log(f'==> {name}: ok en {elapsed}s')
    except Exception as exc:
        elapsed = round(time.time() - started, 1)
        errors[name] = str(exc)
        bucket[name] = ''
        log(f'==> {name}: error en {elapsed}s :: {exc}')


def build_round2_prompt(round1: dict) -> str:
    return f"""Actúa como jurado final de una home de producto digital. Debes depurar y acercar la propuesta a 10/10 usando cambios pequeños.

Contexto resumido:
- Producto: AuditaPatron
- Promesa: claridad laboral a partir de documentos subidos por el usuario
- Restricción: sin cambios estructurales grandes
- Objetivo: simplicidad extrema + engagement emocional + ganas irresistibles de probar el producto

A continuación tienes tres evaluaciones iniciales.

### ChatGPT
{round1.get('chatgpt', '')}

### Grok
{round1.get('grok', '')}

### Gemini
{round1.get('gemini', '')}

Ahora entrega SOLO esto:

## Consenso final
Un párrafo con el acuerdo real entre los tres modelos.

## Corte final de mejoras
Una tabla con columnas: `Orden`, `Mejora`, `Razón`, `Impacto`, `Complejidad`.

## Copy final propuesto
Incluye:
- Hero title
- Hero subtitle
- CTA principal
- Microcopy de la tarjeta derecha

## Qué no tocar
Un párrafo breve indicando qué conviene preservar.

## Nota 10/10
Un párrafo final explicando qué haría que esta home se sintiera casi irresistible sin rediseñarla.
"""


def main() -> int:
    prompt = read_prompt()
    errors = {}
    round1 = {}
    round2 = {}

    models = [
        ('chatgpt', ask_openai),
        ('grok', ask_xai),
        ('gemini', ask_gemini),
    ]

    log('Ronda 1')
    for name, fn in models:
        call_model(name, fn, prompt, round1, errors)
        OUT_PATH.write_text(json.dumps({'round1': round1, 'round2': round2, 'errors': errors}, ensure_ascii=False, indent=2), encoding='utf-8')

    log('Ronda 2')
    round2_prompt = build_round2_prompt(round1)
    for name, fn in models:
        call_model(name, fn, round2_prompt, round2, errors)
        OUT_PATH.write_text(json.dumps({'round1': round1, 'round2': round2, 'errors': errors}, ensure_ascii=False, indent=2), encoding='utf-8')

    payload = {
        'prompt_path': str(PROMPT_PATH),
        'round1': round1,
        'round2': round2,
        'errors': errors,
    }
    OUT_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding='utf-8')
    log(str(OUT_PATH))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
