import json
import os
from pathlib import Path

import requests

PROJECT_ROOT = Path('/home/ubuntu/complilink_operativo_v1')
OUTPUT_PATH = PROJECT_ROOT / 'tmp' / 'ceo_filters_ai_consensus.json'
OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)

SYSTEM_PROMPT = (
    'Eres un principal product designer y staff engineer para un dashboard administrativo SaaS multi-tenant. '
    'Debes proponer un bloque mínimo útil de filtros y búsqueda avanzada para una consola CEO que debe permanecer simple, '
    'rápida, segura, trazable y apta para dejarse abierta todo el día. Responde en JSON estricto.'
)

USER_PROMPT = '''
Contexto del producto:
- Plataforma: AuditaPatron / CompliLink Operativo.
- Vista actual: Consola CEO ya implementada con resumen ejecutivo, alertas, accesos por caso, documentos y acciones administrativas seguras.
- Restricciones: no introducir acciones globales irreversibles; preservar trazabilidad; evitar complejidad innecesaria.
- Siguiente bloque: filtros y búsqueda avanzada.

Necesito una recomendación mínima pero robusta para implementar AHORA el bloque de filtros y búsqueda avanzada en la Consola CEO.

Evalúa específicamente:
1. Qué filtros deben estar siempre visibles en la parte superior.
2. Qué filtros pueden ir en una zona secundaria o colapsable.
3. Cómo debe comportarse una búsqueda única transversal para encontrar tenants, casos, alertas, accesos y documentos sin confundir al usuario.
4. Qué chips/resúmenes de filtros activos conviene mostrar.
5. Qué estado vacío, contador y acción de limpiar filtros conviene tener.
6. Cómo hacer que el bloque sea útil tanto en Resumen CEO como en Alertas, Accesos y Documentos.
7. Qué métricas o tarjetas deben reaccionar al filtro y cuáles deberían permanecer globales.
8. Qué riesgos de UX o de interpretación evitar.

Devuelve JSON con esta forma exacta:
{
  "always_visible_filters": ["..."],
  "secondary_filters": ["..."],
  "search_behavior": ["..."],
  "active_filter_feedback": ["..."],
  "cross_section_behavior": ["..."],
  "kpi_behavior": ["..."],
  "ux_risks": ["..."],
  "implementation_notes": ["..."]
}
'''

SCHEMA = {
    'type': 'json_schema',
    'json_schema': {
        'name': 'ceo_filter_design',
        'strict': True,
        'schema': {
            'type': 'object',
            'properties': {
                'always_visible_filters': {'type': 'array', 'items': {'type': 'string'}},
                'secondary_filters': {'type': 'array', 'items': {'type': 'string'}},
                'search_behavior': {'type': 'array', 'items': {'type': 'string'}},
                'active_filter_feedback': {'type': 'array', 'items': {'type': 'string'}},
                'cross_section_behavior': {'type': 'array', 'items': {'type': 'string'}},
                'kpi_behavior': {'type': 'array', 'items': {'type': 'string'}},
                'ux_risks': {'type': 'array', 'items': {'type': 'string'}},
                'implementation_notes': {'type': 'array', 'items': {'type': 'string'}},
            },
            'required': [
                'always_visible_filters',
                'secondary_filters',
                'search_behavior',
                'active_filter_feedback',
                'cross_section_behavior',
                'kpi_behavior',
                'ux_risks',
                'implementation_notes',
            ],
            'additionalProperties': False,
        },
    },
}


def call_openai() -> dict:
    api_key = os.environ['OPENAI_API_KEY']
    response = requests.post(
        'https://api.openai.com/v1/chat/completions',
        headers={
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json',
        },
        json={
            'model': 'gpt-4.1-mini',
            'temperature': 0.2,
            'response_format': SCHEMA,
            'messages': [
                {'role': 'system', 'content': SYSTEM_PROMPT},
                {'role': 'user', 'content': USER_PROMPT},
            ],
        },
        timeout=120,
    )
    response.raise_for_status()
    payload = response.json()
    content = payload['choices'][0]['message']['content']
    return json.loads(content)


def call_grok() -> dict:
    api_key = os.environ['XAI_API_KEY']
    response = requests.post(
        'https://api.x.ai/v1/chat/completions',
        headers={
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json',
        },
        json={
            'model': 'grok-4-fast-reasoning',
            'temperature': 0.2,
            'response_format': SCHEMA,
            'messages': [
                {'role': 'system', 'content': SYSTEM_PROMPT},
                {'role': 'user', 'content': USER_PROMPT},
            ],
        },
        timeout=120,
    )
    response.raise_for_status()
    payload = response.json()
    content = payload['choices'][0]['message']['content']
    return json.loads(content)


def main() -> None:
    output = {
        'openai': None,
        'grok': None,
    }

    errors = {}

    try:
        output['openai'] = call_openai()
    except Exception as exc:  # noqa: BLE001
        errors['openai'] = str(exc)

    try:
        output['grok'] = call_grok()
    except Exception as exc:  # noqa: BLE001
        errors['grok'] = str(exc)

    output['errors'] = errors
    OUTPUT_PATH.write_text(json.dumps(output, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(str(OUTPUT_PATH))


if __name__ == '__main__':
    main()
