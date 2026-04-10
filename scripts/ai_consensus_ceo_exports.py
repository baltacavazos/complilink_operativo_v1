import json
import os
from pathlib import Path

import requests

PROJECT_ROOT = Path('/home/ubuntu/complilink_operativo_v1')
OUTPUT_PATH = PROJECT_ROOT / 'tmp' / 'ceo_exports_ai_consensus.json'
OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)

SYSTEM_PROMPT = (
    'Eres un arquitecto senior de producto y UX para dashboards ejecutivos B2B. '
    'Responde SIEMPRE en JSON válido y conciso.'
)

USER_PROMPT = '''
Contexto real del producto:
- Existe una Consola CEO en AuditaPatron para administradores.
- Ya hay filtros avanzados activos por tenant, severidad, caso, usuario, ventana temporal y búsqueda transversal.
- El backend actual expone dashboard.ceoSnapshot(input?) y acepta: tenantId, severity, caseId, userId, dateWindowDays, query.
- El frontend actual ya muestra KPIs globales, listados filtrados de tenants, casos, alertas, accesos y documentos, más acciones seguras.
- El próximo bloque a implementar es reportes ejecutivos exportables.

Restricciones reales:
- Se busca el bloque mínimo útil, no una suite compleja de BI.
- Debe reutilizar el snapshot y los filtros actuales siempre que sea posible.
- Debe servir para operación interna inmediata.
- Debe evitar complejidad excesiva de backend.
- La respuesta debe ser accionable para un desarrollador full-stack.

Devuélveme JSON con esta forma exacta:
{
  "recommended_scope": ["string", "string", "string"],
  "export_formats": ["string"],
  "ui_entrypoint": "string",
  "report_sections": ["string"],
  "technical_strategy": ["string"],
  "risks": ["string"],
  "tests": ["string"],
  "not_recommended_yet": ["string"]
}

Criterio: prioriza una primera versión que permita exportar la vista filtrada actual del CEO de forma clara, confiable y defendible.
'''.strip()


def call_openai() -> dict:
    api_key = os.environ.get('OPENAI_API_KEY')
    if not api_key:
        return {'error': 'OPENAI_API_KEY no disponible'}
    url = 'https://api.openai.com/v1/chat/completions'
    payload = {
        'model': 'gpt-4.1-mini',
        'temperature': 0.2,
        'response_format': {'type': 'json_object'},
        'messages': [
            {'role': 'system', 'content': SYSTEM_PROMPT},
            {'role': 'user', 'content': USER_PROMPT},
        ],
    }
    response = requests.post(
        url,
        headers={'Authorization': f'Bearer {api_key}', 'Content-Type': 'application/json'},
        json=payload,
        timeout=60,
    )
    response.raise_for_status()
    data = response.json()
    content = data['choices'][0]['message']['content']
    return json.loads(content)


def call_grok() -> dict:
    api_key = os.environ.get('XAI_API_KEY')
    if not api_key:
        return {'error': 'XAI_API_KEY no disponible'}
    url = 'https://api.x.ai/v1/chat/completions'
    payload = {
        'model': 'grok-4-fast-reasoning',
        'temperature': 0.2,
        'response_format': {'type': 'json_object'},
        'messages': [
            {'role': 'system', 'content': SYSTEM_PROMPT},
            {'role': 'user', 'content': USER_PROMPT},
        ],
    }
    response = requests.post(
        url,
        headers={'Authorization': f'Bearer {api_key}', 'Content-Type': 'application/json'},
        json=payload,
        timeout=60,
    )
    response.raise_for_status()
    data = response.json()
    content = data['choices'][0]['message']['content']
    return json.loads(content)


def call_gemini() -> dict:
    api_key = os.environ.get('GEMINI_API_KEY')
    if not api_key:
        return {'error': 'GEMINI_API_KEY no disponible'}
    url = f'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}'
    prompt = f"{SYSTEM_PROMPT}\n\n{USER_PROMPT}"
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
    response = requests.post(url, headers={'Content-Type': 'application/json'}, json=payload, timeout=60)
    response.raise_for_status()
    data = response.json()
    content = data['candidates'][0]['content']['parts'][0]['text']
    return json.loads(content)


def main() -> None:
    results = {}
    for name, fn in [('openai', call_openai), ('grok', call_grok), ('gemini', call_gemini)]:
        try:
            results[name] = fn()
        except Exception as exc:  # noqa: BLE001
            results[name] = {'error': str(exc)}

    available = [item for item in results.values() if isinstance(item, dict) and 'error' not in item]
    consensus = {
        'recommended_export_formats': [],
        'shared_sections': [],
        'shared_ui_entrypoint': [],
        'shared_priorities': [],
        'deferred_items': [],
    }
    if available:
        export_formats = []
        sections = []
        entrypoints = []
        priorities = []
        deferred = []
        for item in available:
            export_formats.extend(item.get('export_formats', []))
            sections.extend(item.get('report_sections', []))
            entrypoints.append(item.get('ui_entrypoint', ''))
            priorities.extend(item.get('technical_strategy', []))
            deferred.extend(item.get('not_recommended_yet', []))
        def top_unique(values):
            ordered = []
            seen = set()
            for value in values:
                normalized = str(value).strip()
                if not normalized:
                    continue
                key = normalized.lower()
                if key in seen:
                    continue
                seen.add(key)
                ordered.append(normalized)
            return ordered[:8]
        consensus = {
            'recommended_export_formats': top_unique(export_formats),
            'shared_sections': top_unique(sections),
            'shared_ui_entrypoint': top_unique(entrypoints),
            'shared_priorities': top_unique(priorities),
            'deferred_items': top_unique(deferred),
        }

    payload = {
        'system_prompt': SYSTEM_PROMPT,
        'user_prompt': USER_PROMPT,
        'results': results,
        'consensus': consensus,
    }
    OUTPUT_PATH.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
    print(str(OUTPUT_PATH))


if __name__ == '__main__':
    main()
