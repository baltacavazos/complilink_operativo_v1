import json
import os
import pathlib
import textwrap
from typing import Any

import requests

ROOT = pathlib.Path('/home/ubuntu/complilink_operativo_v1')
OUT = ROOT / 'tmp' / 'backup_docs_consensus.json'
OUT.parent.mkdir(parents=True, exist_ok=True)


def read_text(path: pathlib.Path, limit: int = 12000) -> str:
    if not path.exists():
        return f'[missing] {path}'
    text = path.read_text(encoding='utf-8')
    return text[:limit]


def load_context() -> str:
    readme = read_text(ROOT / 'README.md', 14000)
    package_json = read_text(ROOT / 'package.json', 14000)
    env_ts = read_text(ROOT / 'server' / '_core' / 'env.ts', 12000)
    routers = read_text(ROOT / 'server' / 'routers.ts', 14000)
    db_ts = read_text(ROOT / 'server' / 'db.ts', 14000)
    schema = read_text(ROOT / 'drizzle' / 'schema.ts', 14000)
    auditar = read_text(ROOT / 'client' / 'src' / 'pages' / 'Auditar.tsx', 14000)
    structure_path = pathlib.Path('/tmp/auditapatron_structure.txt')
    structure = read_text(structure_path, 14000)

    return textwrap.dedent(
        f"""
        Contexto del proyecto AuditaPatron / CompliLink Operativo V1.

        Objetivo inmediato:
        - Preparar CONFIGURACION.md
        - Preparar ARQUITECTURA.md
        - Preparar documentación de servicios terceros
        - Dejar listo el flujo local del respaldo para ejecutarlo apenas exista un token válido de Dropbox

        Requisitos del respaldo:
        - ZIP del proyecto con formato AuditaPatron_backup_YYYYMMDD_HHMM.zip
        - Subida a /Backups/AuditaPatron/
        - README.md actualizado con changelog
        - CONFIGURACION.md con variables de entorno, API keys, puertos y URLs sin exponer valores reales
        - ARQUITECTURA.md con estructura del proyecto, conexiones frontend/backend y diagrama descriptivo
        - Dump de base de datos si aplica
        - Documentación de servicios de terceros
        - Retener últimos 5 backups

        Estado actual confirmado:
        - /auditar ya distingue borrador vs confirmado
        - existe CTA único de Reanalizar
        - existen métricas de conversión selección→confirmación
        - Vitest pasa para los cambios recientes
        - Dropbox sigue bloqueado por invalid_access_token

        README.md:
        {readme}

        package.json:
        {package_json}

        server/_core/env.ts:
        {env_ts}

        server/routers.ts:
        {routers}

        server/db.ts:
        {db_ts}

        drizzle/schema.ts:
        {schema}

        client/src/pages/Auditar.tsx:
        {auditar}

        Estructura resumida del proyecto:
        {structure}
        """
    ).strip()


PROMPT = textwrap.dedent(
    """
    Actúa como arquitecto técnico y responsable de continuidad operativa.
    Con base en el contexto entregado, devuelve JSON válido con esta estructura exacta:
    {
      "configuracion": {
        "secciones": ["..."],
        "variables_criticas": [
          {"nombre": "", "categoria": "", "descripcion": "", "exponer_valor": false}
        ],
        "puertos_urls": [
          {"nombre": "", "valor_o_fuente": "", "descripcion": ""}
        ],
        "riesgos_documentales": ["..."]
      },
      "arquitectura": {
        "resumen": "",
        "modulos": [
          {"nombre": "", "responsabilidad": "", "archivos_clave": ["..."]}
        ],
        "flujos": [
          {"nombre": "", "pasos": ["..."]}
        ],
        "diagrama_mermaid": "",
        "riesgos_operativos": ["..."]
      },
      "servicios_terceros": [
        {"servicio": "", "uso": "", "variables": ["..."], "riesgos": ["..."]}
      ],
      "backup_local": {
        "artefactos": ["..."],
        "pasos": ["..."],
        "validaciones": ["..."],
        "supuestos": ["..."]
      },
      "recomendaciones_priorizadas": [
        {"prioridad": 1, "accion": "", "motivo": ""}
      ]
    }

    Reglas:
    - No inventes servicios ni variables que no se deduzcan razonablemente del contexto.
    - Si algo es incierto, menciónalo en riesgos o supuestos.
    - Sé concreto y orientado a ejecución.
    - Todo en español.
    - Devuelve solo JSON válido.
    """
).strip()


FULL_PROMPT = load_context() + "\n\n" + PROMPT


def extract_text_openai_response(payload: dict[str, Any]) -> str:
    if isinstance(payload.get('output_text'), str) and payload['output_text'].strip():
        return payload['output_text']
    outputs = []
    for item in payload.get('output', []):
        if item.get('type') == 'message':
            for content in item.get('content', []):
                if content.get('type') in ('output_text', 'text') and content.get('text'):
                    outputs.append(content['text'])
    return '\n'.join(outputs).strip()


def call_openai() -> dict[str, Any]:
    api_key = os.environ.get('OPENAI_API_KEY')
    if not api_key:
        return {'ok': False, 'error': 'OPENAI_API_KEY no disponible'}
    r = requests.post(
        'https://api.openai.com/v1/responses',
        headers={
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json',
        },
        json={
            'model': 'gpt-4.1-mini',
            'input': FULL_PROMPT,
            'temperature': 0.2,
        },
        timeout=120,
    )
    body = r.json()
    text = extract_text_openai_response(body)
    return {'ok': r.ok, 'status': r.status_code, 'text': text, 'raw': body if not r.ok else None}


def call_grok() -> dict[str, Any]:
    api_key = os.environ.get('XAI_API_KEY')
    if not api_key:
        return {'ok': False, 'error': 'XAI_API_KEY no disponible'}
    r = requests.post(
        'https://api.x.ai/v1/chat/completions',
        headers={
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json',
        },
        json={
            'model': 'grok-3-mini',
            'temperature': 0.2,
            'messages': [
                {'role': 'system', 'content': 'Responde únicamente con JSON válido.'},
                {'role': 'user', 'content': FULL_PROMPT},
            ],
        },
        timeout=120,
    )
    body = r.json()
    text = ''
    try:
        text = body['choices'][0]['message']['content'].strip()
    except Exception:
        pass
    return {'ok': r.ok, 'status': r.status_code, 'text': text, 'raw': body if not r.ok else None}


def call_gemini() -> dict[str, Any]:
    api_key = os.environ.get('GEMINI_API_KEY')
    if not api_key:
        return {'ok': False, 'error': 'GEMINI_API_KEY no disponible'}
    url = f'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}'
    r = requests.post(
        url,
        headers={'Content-Type': 'application/json'},
        json={
            'contents': [
                {'parts': [{'text': FULL_PROMPT}]}
            ],
            'generationConfig': {
                'temperature': 0.2,
                'responseMimeType': 'application/json',
            },
        },
        timeout=120,
    )
    body = r.json()
    text = ''
    try:
        text = body['candidates'][0]['content']['parts'][0]['text'].strip()
    except Exception:
        pass
    return {'ok': r.ok, 'status': r.status_code, 'text': text, 'raw': body if not r.ok else None}


result = {
    'openai': call_openai(),
    'grok': call_grok(),
    'gemini': call_gemini(),
}
OUT.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
print(str(OUT))
