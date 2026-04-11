import json
import os
import time
from pathlib import Path

import requests

PROJECT_ROOT = Path('/home/ubuntu/complilink_operativo_v1')
HOME_FILE = PROJECT_ROOT / 'client/src/pages/Home.tsx'
OUTPUT_FILE = PROJECT_ROOT / 'hero_iteration4_consensus_results.json'

MODEL_CONFIGS = {
    'chatgpt': {
        'env_key': 'OPENAI_API_KEY',
        'url': 'https://api.openai.com/v1/chat/completions',
        'model': 'gpt-4.1-mini',
        'headers': lambda key: {
            'Authorization': f'Bearer {key}',
            'Content-Type': 'application/json',
        },
        'build_payload': lambda model, prompt: {
            'model': model,
            'temperature': 0.4,
            'response_format': {'type': 'json_object'},
            'messages': [
                {
                    'role': 'system',
                    'content': (
                        'Eres un estratega senior de CRO y UX writing para una landing legal-laboral en español. '
                        'Debes responder solo JSON válido.'
                    ),
                },
                {'role': 'user', 'content': prompt},
            ],
        },
        'extract_text': lambda data: data['choices'][0]['message']['content'],
    },
    'grok': {
        'env_key': 'XAI_API_KEY',
        'url': 'https://api.x.ai/v1/chat/completions',
        'model': 'grok-4-0709',
        'headers': lambda key: {
            'Authorization': f'Bearer {key}',
            'Content-Type': 'application/json',
        },
        'build_payload': lambda model, prompt: {
            'model': model,
            'temperature': 0.4,
            'response_format': {'type': 'json_object'},
            'messages': [
                {
                    'role': 'system',
                    'content': (
                        'Eres un estratega senior de CRO y UX writing para una landing legal-laboral en español. '
                        'Debes responder solo JSON válido.'
                    ),
                },
                {'role': 'user', 'content': prompt},
            ],
        },
        'extract_text': lambda data: data['choices'][0]['message']['content'],
    },
    'gemini': {
        'env_key': 'GEMINI_API_KEY',
        'url': 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
        'model': None,
        'headers': lambda key: {'Content-Type': 'application/json', 'x-goog-api-key': key},
        'build_payload': lambda model, prompt: {
            'generationConfig': {
                'temperature': 0.4,
                'responseMimeType': 'application/json',
            },
            'systemInstruction': {
                'parts': [
                    {
                        'text': (
                            'Eres un estratega senior de CRO y UX writing para una landing legal-laboral en español. '
                            'Debes responder solo JSON válido.'
                        )
                    }
                ]
            },
            'contents': [{'parts': [{'text': prompt}]}],
        },
        'extract_text': lambda data: data['candidates'][0]['content']['parts'][0]['text'],
    },
}

JSON_SCHEMA_DESCRIPTION = {
    'objetivo_general': 'string',
    'resultado_instantaneo': {
        'enfoque': 'string',
        'copy_recomendado': 'string',
        'mapeo_documentos': [
            {
                'opcion_id': 'string',
                'documento': 'string',
                'razon': 'string',
                'cta': 'string',
            }
        ],
        'riesgo_principal': 'string',
    },
    'medicion': {
        'eventos_recomendados': [
            {
                'name': 'string',
                'trigger': 'string',
                'payload': ['string'],
                'prioridad': 'alta|media|baja',
            }
        ],
        'guardrails': ['string'],
    },
    'carrusel_hallazgos': {
        'enfoque': 'string',
        'slides': [
            {
                'title': 'string',
                'description': 'string',
                'impact': 'string',
            }
        ],
        'microinteraccion': 'string',
    },
    'recomendacion_integrada': {
        'prioridad_implementacion': ['string'],
        'copy_clave': ['string'],
        'advertencias': ['string'],
    },
}


def build_prompt(home_text: str) -> str:
    return f'''Necesito tu criterio experto para mejorar el hero de una landing llamada AuditaPatron, orientada a personas trabajadoras que quieren revisar pagos, CFDI, contrato, IMSS e Infonavit con claridad y sensación de control.

Contexto importante del hero actual:
1. Ya existen dos variantes visibles del hero: "alert" y "control".
2. Ya existe un mini prediagnóstico con tres opciones: para-mi, primer-documento y privacidad.
3. Ya existe tracking básico de clics CTA y tracking por variante.
4. Ya existe una tarjeta lateral con un hallazgo concreto por variante.
5. El tono debe combinar urgencia, claridad, confianza y empoderamiento. No debe sonar alarmista de forma irresponsable ni usar lenguaje legal complejo.
6. La app debe sentirse fácil, móvil, sobria y útil.

Ahora queremos implementar tres mejoras al mismo tiempo:
A) Añadir un resultado instantáneo del prediagnóstico que recomiende el documento exacto a subir y empuje a la acción.
B) Medir también scroll del hero y cambio de variante, además de clics.
C) Convertir la tarjeta lateral en un carrusel con 3 hallazgos laborales resumidos.

Quiero que propongas la mejor implementación conjunta, cuidando simplicidad, claridad, conversión y no saturar la pantalla móvil.

Responde SOLO JSON válido con esta estructura exacta:
{json.dumps(JSON_SCHEMA_DESCRIPTION, ensure_ascii=False, indent=2)}

Aquí está el extracto relevante de la homepage actual para que entiendas el tono, el copy y la estructura existente:

```tsx
{home_text[:18000]}
```
'''


def call_model(name: str, config: dict, prompt: str):
    api_key = os.getenv(config['env_key'])
    if not api_key:
        return {
            'ok': False,
            'error': f'Falta la variable de entorno {config["env_key"]}',
        }

    url = config['url']
    if name == 'gemini':
        payload = config['build_payload'](config['model'], prompt)
    else:
        payload = config['build_payload'](config['model'], prompt)

    try:
        response = requests.post(url, headers=config['headers'](api_key), json=payload, timeout=120)
        response.raise_for_status()
        data = response.json()
        text = config['extract_text'](data)
        parsed = json.loads(text)
        return {
            'ok': True,
            'model': config['model'] or 'gemini-2.5-flash',
            'response': parsed,
        }
    except Exception as exc:
        details = None
        if 'response' in locals():
            try:
                details = response.text[:4000]
            except Exception:
                details = None
        return {
            'ok': False,
            'model': config['model'] or 'gemini-2.5-flash',
            'error': str(exc),
            'details': details,
        }



def build_consensus(results: dict) -> dict:
    successful = {k: v['response'] for k, v in results.items() if v.get('ok')}
    consensus = {
        'shared_themes': [],
        'copy_patterns': [],
        'tracking_consensus': [],
        'risks_to_avoid': [],
    }

    if not successful:
        return consensus

    for provider, data in successful.items():
        consensus['shared_themes'].append({
            'provider': provider,
            'objetivo_general': data.get('objetivo_general'),
            'resultado_enfoque': data.get('resultado_instantaneo', {}).get('enfoque'),
            'carrusel_enfoque': data.get('carrusel_hallazgos', {}).get('enfoque'),
        })
        eventos = data.get('medicion', {}).get('eventos_recomendados', [])
        consensus['tracking_consensus'].append({
            'provider': provider,
            'event_names': [event.get('name') for event in eventos],
            'guardrails': data.get('medicion', {}).get('guardrails', []),
        })
        consensus['copy_patterns'].append({
            'provider': provider,
            'copy_clave': data.get('recomendacion_integrada', {}).get('copy_clave', []),
        })
        consensus['risks_to_avoid'].append({
            'provider': provider,
            'advertencias': data.get('recomendacion_integrada', {}).get('advertencias', []),
        })

    return consensus


if __name__ == '__main__':
    home_text = HOME_FILE.read_text(encoding='utf-8')
    prompt = build_prompt(home_text)
    results = {}

    for name, config in MODEL_CONFIGS.items():
        results[name] = call_model(name, config, prompt)
        time.sleep(1)

    output = {
        'generated_at': time.strftime('%Y-%m-%d %H:%M:%S'),
        'results': results,
        'consensus': build_consensus(results),
    }

    OUTPUT_FILE.write_text(json.dumps(output, ensure_ascii=False, indent=2), encoding='utf-8')
    print(f'Escribí resultados en {OUTPUT_FILE}')
