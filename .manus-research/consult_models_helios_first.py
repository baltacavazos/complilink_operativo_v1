import json
import os
from pathlib import Path

import requests

PROMPT = """Contexto: AuditaPatron es una plataforma para trabajadores mexicanos. El usuario ya aprobó reforzar el mensaje visible de que AuditaPatron ayuda a revisar con claridad si la persona está bien dada de alta en IMSS e Infonavit. Además, definió una regla de arquitectura fundamental: toda la información del usuario en AuditaPatron debe venir del motor Helios. Eso incluye documentos subidos por el usuario y resultados relacionados con IMSS, Infonavit y demás verificaciones; el usuario sube su documento, Helios lo analiza, lo almacena y emite sus resultados.

Quiero una respuesta breve pero sustanciosa en español con este formato exacto:
1. Veredicto general sobre este enfoque: sólido / sólido con matices / riesgoso
2. Qué sí conviene mostrar ya en la UI pública, en 2 frases
3. Qué NO conviene prometer todavía en la UI pública, en 1 frase
4. Mejor ubicación para mencionar IMSS e Infonavit: titular / subtítulo hero / lista de beneficios / sección explicativa
5. Propuesta de copy principal de máximo 28 palabras
6. Propuesta de microcopy de apoyo de máximo 20 palabras
7. Recomendación arquitectónica en 3 puntos muy concretos para que Helios sea la fuente de análisis, almacenamiento y resultados sin confundir al usuario
8. Riesgo principal de producto o confianza en 1 frase

Evalúa desde UX, marketing, claridad, arquitectura de producto y riesgo reputacional. Importa mucho no sonar engañoso ni hacer promesas absolutas."""

OUTDIR = Path('/home/ubuntu/complilink_operativo_v1/.manus-research')
OUTDIR.mkdir(parents=True, exist_ok=True)


def save(name: str, payload: dict) -> None:
    (OUTDIR / f'{name}_helios_first.json').write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + '\n',
        encoding='utf-8',
    )


def call_gemini() -> dict:
    api_key = os.environ['GEMINI_API_KEY']
    url = f'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}'
    payload = {
        'contents': [
            {
                'parts': [
                    {'text': PROMPT}
                ]
            }
        ]
    }
    response = requests.post(url, json=payload, timeout=60)
    response.raise_for_status()
    return response.json()


def call_openai() -> dict:
    api_key = os.environ['OPENAI_API_KEY']
    url = 'https://api.openai.com/v1/chat/completions'
    payload = {
        'model': 'gpt-4o-mini',
        'messages': [
            {
                'role': 'system',
                'content': 'Responde en español con criterio de UX, arquitectura de producto, marketing y comunicación responsable.'
            },
            {
                'role': 'user',
                'content': PROMPT
            }
        ]
    }
    response = requests.post(
        url,
        headers={'Authorization': f'Bearer {api_key}'},
        json=payload,
        timeout=60,
    )
    response.raise_for_status()
    return response.json()


def call_grok() -> dict:
    api_key = os.environ['XAI_API_KEY']
    url = 'https://api.x.ai/v1/chat/completions'
    payload = {
        'model': 'grok-4',
        'messages': [
            {
                'role': 'system',
                'content': 'Responde en español con criterio de UX, arquitectura de producto, marketing y comunicación responsable.'
            },
            {
                'role': 'user',
                'content': PROMPT
            }
        ]
    }
    response = requests.post(
        url,
        headers={'Authorization': f'Bearer {api_key}'},
        json=payload,
        timeout=60,
    )
    response.raise_for_status()
    return response.json()


def main() -> None:
    results = {}
    for name, fn in (('gemini', call_gemini), ('openai', call_openai), ('grok', call_grok)):
        try:
            payload = fn()
            save(name, payload)
            results[name] = 'ok'
        except Exception as exc:
            save(name, {'error': str(exc)})
            results[name] = f'error: {exc}'
    print(json.dumps(results, ensure_ascii=False))


if __name__ == '__main__':
    main()
