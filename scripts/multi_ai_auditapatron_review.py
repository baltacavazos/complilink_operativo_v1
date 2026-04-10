from __future__ import annotations

import json
import os
import re
from pathlib import Path
from typing import Callable

import requests

ROOT = Path('/home/ubuntu/complilink_operativo_v1')
OUTPUT = ROOT / 'tmp' / 'multi_ai_scalability_review.json'
OUTPUT.parent.mkdir(parents=True, exist_ok=True)

TARGETS = [
    (ROOT / 'server' / 'routers.ts', [r'validateAuditarUploadMetadata', r'prepareAuditarUploadAsset', r'const \{ sizeBytes \} = prepareAuditarUploadAsset\(', r'protectedProcedure', r'uploadDocument: protectedProcedure', r'analyzeDocumentDraft: protectedProcedure']),
    (ROOT / 'client' / 'src' / 'pages' / 'CeoDashboard.tsx', [r'handleExport', r'isSnapshotStale', r'getCeoExportBlockReason']),
    (ROOT / 'client' / 'src' / 'pages' / 'ceoDashboardExports.ts', [r'escapeCsv', r'buildCeoCsvReport', r'downloadCeoPdfReport']),
    (ROOT / 'server' / 'caseWorkflows.test.ts', [r'excessively long file names', r'real binary signature']),
    (ROOT / 'server' / 'caseContracts.ts', [r'export function decodeBase64File', r'estimatedBytes > options.maxBytes']),
]


def extract_snippet(path: Path, pattern: str, radius: int = 18) -> str:
    text = path.read_text()
    lines = text.splitlines()
    for idx, line in enumerate(lines):
        if re.search(pattern, line):
            start = max(0, idx - radius)
            end = min(len(lines), idx + radius + 1)
            numbered = '\n'.join(f'{i + 1:04d}: {lines[i]}' for i in range(start, end))
            return f'FILE: {path.relative_to(ROOT)}\nPATTERN: {pattern}\n{numbered}'
    return f'FILE: {path.relative_to(ROOT)}\nPATTERN: {pattern}\nNOT FOUND'


snippets: list[str] = []
for path, patterns in TARGETS:
    for pattern in patterns:
        snippets.append(extract_snippet(path, pattern))

context = '\n\n---\n\n'.join(snippets)

PROMPT = f"""
Eres un arquitecto senior de software revisando AuditaPatron V1.

Objetivo: proponer el siguiente endurecimiento PRIORITARIO después de estos cambios ya hechos:
1. exportes CEO bloqueados cuando el snapshot está stale, refrescando o con error;
2. exportes CEO ya neutralizan fórmulas CSV, normalizan tabs/saltos de línea y acotan texto exportable para PDF/CSV;
3. /auditar ya corre bajo protectedProcedure;
4. /auditar ya tiene rate limiting, deduplicación efímera, rechazo temprano de base64 sobredimensionado, validación de MIME/nombre antes de decodificar, límite de longitud del nombre y validación de magic bytes para PDF/JPG/PNG/WEBP;
5. analyze/upload/confirm ya validan escritura sobre el caso antes de locks, storage o trabajo pesado;
6. ya existen regresiones Vitest para nombres excesivos, binarios cuyo contenido real no coincide con el MIME declarado, exportes CEO endurecidos y autorización fail-fast.

Necesito una respuesta breve y accionable en JSON con esta forma exacta:
{{
  "top_risks": [
    {{"title": "...", "why": "...", "impact": "high|medium|low", "confidence": "high|medium|low"}}
  ],
  "next_best_change": {{
    "title": "...",
    "why_now": "...",
    "implementation_hint": "...",
    "test_hint": "..."
  }},
  "do_not_do_yet": ["..."],
  "notes": "máximo 120 palabras"
}}

Descarta explícitamente recomendaciones ya cubiertas por el contexto.
Si ves un riesgo de exportación CSV/PDF o de integridad del snapshot ejecutivo, priorízalo con preferencia.

Contexto de código relevante:

{context}
""".strip()


def post_json(url: str, headers: dict[str, str], payload: dict) -> dict:
    response = requests.post(url, headers=headers, json=payload, timeout=90)
    response.raise_for_status()
    return response.json()


results: dict[str, dict] = {}
errors: dict[str, str] = {}


def parse_json_text(text: str) -> dict:
    text = text.strip()
    if text.startswith('```'):
        text = re.sub(r'^```(?:json)?\s*', '', text)
        text = re.sub(r'\s*```$', '', text)
    return json.loads(text)


try:
    openai_key = os.environ.get('OPENAI_API_KEY')
    if openai_key:
        payload = {
            'model': 'gpt-4.1-mini',
            'response_format': {'type': 'json_object'},
            'messages': [
                {'role': 'system', 'content': 'Devuelve exclusivamente JSON válido.'},
                {'role': 'user', 'content': PROMPT},
            ],
            'temperature': 0.2,
        }
        data = post_json(
            'https://api.openai.com/v1/chat/completions',
            {'Authorization': f'Bearer {openai_key}', 'Content-Type': 'application/json'},
            payload,
        )
        content = data['choices'][0]['message']['content']
        results['openai'] = parse_json_text(content)
    else:
        errors['openai'] = 'OPENAI_API_KEY missing'
except Exception as exc:  # noqa: BLE001
    errors['openai'] = str(exc)

try:
    grok_key = os.environ.get('XAI_API_KEY')
    if grok_key:
        payload = {
            'model': 'grok-4-fast-non-reasoning',
            'messages': [
                {'role': 'system', 'content': 'Devuelve exclusivamente JSON válido.'},
                {'role': 'user', 'content': PROMPT},
            ],
            'temperature': 0.2,
            'response_format': {'type': 'json_object'},
        }
        data = post_json(
            'https://api.x.ai/v1/chat/completions',
            {'Authorization': f'Bearer {grok_key}', 'Content-Type': 'application/json'},
            payload,
        )
        content = data['choices'][0]['message']['content']
        results['grok'] = parse_json_text(content)
    else:
        errors['grok'] = 'XAI_API_KEY missing'
except Exception as exc:  # noqa: BLE001
    errors['grok'] = str(exc)

try:
    gemini_key = os.environ.get('GEMINI_API_KEY')
    if gemini_key:
        payload = {
            'contents': [
                {
                    'role': 'user',
                    'parts': [{'text': PROMPT}],
                }
            ],
            'generationConfig': {
                'temperature': 0.2,
                'responseMimeType': 'application/json',
            },
        }
        gemini_models = [
            'gemini-2.5-flash',
            'gemini-2.0-flash',
            'gemini-1.5-flash',
        ]
        last_gemini_error: str | None = None
        for gemini_model in gemini_models:
            try:
                data = post_json(
                    f'https://generativelanguage.googleapis.com/v1beta/models/{gemini_model}:generateContent?key={gemini_key}',
                    {'Content-Type': 'application/json'},
                    payload,
                )
                content = data['candidates'][0]['content']['parts'][0]['text']
                parsed = parse_json_text(content)
                parsed['_model'] = gemini_model
                results['gemini'] = parsed
                last_gemini_error = None
                break
            except Exception as gemini_exc:  # noqa: BLE001
                last_gemini_error = f'{gemini_model}: {gemini_exc}'
        if last_gemini_error is not None:
            errors['gemini'] = last_gemini_error
    else:
        errors['gemini'] = 'GEMINI_API_KEY missing'
except Exception as exc:  # noqa: BLE001
    errors['gemini'] = str(exc)

combined = {
    'prompt': PROMPT,
    'results': results,
    'errors': errors,
}
OUTPUT.write_text(json.dumps(combined, ensure_ascii=False, indent=2))
print(str(OUTPUT))
