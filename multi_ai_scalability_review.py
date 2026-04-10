import json
import os
import re
from pathlib import Path

import requests

OUTPUT_PATH = Path('/home/ubuntu/complilink_operativo_v1/multi_ai_scalability_review.json')
TIMEOUT = 90

PROMPT = '''
Eres un arquitecto principal de plataformas TypeScript orientadas a alta concurrencia.

Analiza cuellos de botella probables y mejoras inmediatas para AuditaPatron, una plataforma de cumplimiento y auditoría laboral/fiscal pensada para miles de usuarios. Necesito una revisión pragmática, no académica, enfocada en backend y flujos críticos. No mezcles CompliLink ni otros productos salvo cuando aparezcan como integraciones ya existentes.

Contexto operativo confirmado:
- Stack backend: TypeScript, tRPC, Drizzle ORM, MySQL/TiDB, S3.
- Multi-tenant con tenantId, caseId y traceId.
- Flujo crítico /auditar: carga documental, clasificación preliminar, extracción estructurada preliminar, persistencia documental, contratos canónicos, auditoría y despacho al motor inteligente/Helios.
- Ya se blindó la exportación del Dashboard CEO cuando el snapshot está stale, en error o refrescando.
- La siguiente prioridad es robustecer backend y flujos críticos para soportar miles de usuarios.
- Se prefieren mejoras inmediatas dentro del código y la base actual antes de recomendar nueva infraestructura pesada.

Resumen fiel de rutas/operaciones pesadas:
1) analyzeDocumentDraft:
   - getCaseDetailForUser
   - decodeBase64File
   - prepareAuditarUploadAsset
   - computeSha256
   - storagePut del archivo original
   - classifyMexicanLaborDocument
   - analyzeDocumentScanAssist(fileUrl)
   - analyzeStructuredDocumentPreview(fileUrl)
   - upsertCanonicalContract(type=classification, schema=auditar_preview_v1, status=draft)
   - createAuditLog(action=document.preview_analyzed)

2) confirmDocumentDraft:
   - assertCaseWriteAccess
   - getCaseDetailForUser
   - getAuditarDraftById
   - validar TTL del draft
   - assertAuditarDraftNotAlreadyConfirmed (busca contratos previos para evitar duplicado)
   - addDocumentRecord
   - updateDocumentPostProcessing
   - addCaseEvent varias veces
   - addOperationalAlert si consentimiento pendiente
   - upsertCanonicalContract para document, classification, shared_engine y audit
   - buildHeliosOpinionContract
   - sendDocumentToAuditaPatronEngine
   - createAuditLog múltiples veces

3) uploadDocument directo:
   - hace gran parte del mismo trabajo anterior sin preview
   - persiste documento, contratos, alertas, opinión Helios inicial, despacho al motor y auditoría

Helper de concurrencia ya existente en DB:
- withDatabaseLock(lockKey, timeoutSeconds=10, action)
- usa GET_LOCK/RELEASE_LOCK de MySQL/TiDB
- lockKey se recorta a 64 chars
- timeout se limita a 1-30 segundos
- hoy el mensaje de error está redactado para aceptación legal, no para /auditar

Necesito que identifiques especialmente degradaciones probables bajo carga en:
- queries repetitivas o innecesarias
- trabajo duplicado por doble click / reintentos / cargas simultáneas
- confirmación duplicada de drafts
- concurrencia por caso
- presión de CPU/memoria por base64 y hashing
- latencia en S3 + LLM/análisis + motor externo
- explosión de writes por eventos/auditoría/contratos por cada documento
- snapshots/exports del CEO y consultas agregadas
- autenticación y controles por tenant/caso

Restricciones de diseño para tus recomendaciones:
- Prioriza cambios que pueda implementar ya mismo en app/backend/DB actual.
- Si propones rate limiting, deduplicación o locks, indica una versión mínima viable sin Redis.
- Si sugieres colas o asincronía, distingue claramente quick win vs cambio estructural posterior.
- No propongas reescrituras masivas.

Devuélveme JSON válido con esta forma exacta:
{
  "top_bottlenecks": [
    {
      "id": "string_corto",
      "area": "auditar|ceo|db|auth|storage|integration|other",
      "why": "explicacion breve",
      "impact": "low|medium|high|critical",
      "probability": "low|medium|high",
      "first_fix": "accion concreta aplicable en el codebase actual"
    }
  ],
  "guardrails_now": [
    {
      "name": "nombre corto",
      "scope": "ruta o helper",
      "implementation": "cambio concreto de implementacion",
      "expected_benefit": "beneficio esperado"
    }
  ],
  "metrics_to_add": [
    {
      "name": "nombre",
      "where": "punto de instrumentacion",
      "reason": "por que sirve"
    }
  ],
  "tests_to_add": [
    {
      "name": "nombre de prueba",
      "type": "unit|integration|load-ish",
      "reason": "riesgo que cubre"
    }
  ],
  "sequencing": {
    "first": "primer bloque recomendado",
    "second": "segundo bloque recomendado",
    "third": "tercer bloque recomendado"
  }
}

Responde solo JSON. Nada de markdown.
'''.strip()


def extract_json(text: str):
    text = text.strip()
    if not text:
        raise ValueError('Respuesta vacía')
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        match = re.search(r'\{.*\}', text, re.S)
        if not match:
            raise
        return json.loads(match.group(0))


def call_openai():
    api_key = os.environ.get('OPENAI_API_KEY')
    if not api_key:
        return {'error': 'OPENAI_API_KEY no disponible'}
    response = requests.post(
        'https://api.openai.com/v1/chat/completions',
        headers={
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json',
        },
        json={
            'model': 'gpt-4o-mini',
            'temperature': 0.2,
            'response_format': {'type': 'json_object'},
            'messages': [
                {'role': 'system', 'content': 'Responde con JSON válido y compacto.'},
                {'role': 'user', 'content': PROMPT},
            ],
        },
        timeout=TIMEOUT,
    )
    response.raise_for_status()
    payload = response.json()
    content = payload['choices'][0]['message']['content']
    return extract_json(content)


def call_grok():
    api_key = os.environ.get('XAI_API_KEY')
    if not api_key:
        return {'error': 'XAI_API_KEY no disponible'}
    response = requests.post(
        'https://api.x.ai/v1/chat/completions',
        headers={
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json',
        },
        json={
            'model': 'grok-4',
            'temperature': 0.2,
            'messages': [
                {'role': 'system', 'content': 'Responde únicamente JSON válido.'},
                {'role': 'user', 'content': PROMPT},
            ],
        },
        timeout=TIMEOUT,
    )
    response.raise_for_status()
    payload = response.json()
    content = payload['choices'][0]['message']['content']
    return extract_json(content)


def call_gemini():
    api_key = os.environ.get('GEMINI_API_KEY')
    if not api_key:
        return {'error': 'GEMINI_API_KEY no disponible'}

    last_error = None
    for model in ('gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'):
        try:
            response = requests.post(
                f'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent',
                params={'key': api_key},
                headers={'Content-Type': 'application/json'},
                json={
                    'contents': [
                        {
                            'parts': [
                                {'text': 'Responde únicamente JSON válido.'},
                                {'text': PROMPT},
                            ]
                        }
                    ],
                    'generationConfig': {
                        'temperature': 0.2,
                        'responseMimeType': 'application/json',
                    },
                },
                timeout=TIMEOUT,
            )
            response.raise_for_status()
            payload = response.json()
            candidates = payload.get('candidates') or []
            parts = (((candidates[0] if candidates else {}).get('content') or {}).get('parts') or [])
            text = ''.join(part.get('text', '') for part in parts)
            parsed = extract_json(text)
            if isinstance(parsed, dict):
                parsed.setdefault('_model', model)
            return parsed
        except Exception as exc:
            last_error = f'{model}: {type(exc).__name__}: {exc}'

    return {'error': last_error or 'Gemini no disponible'}


def main():
    results = {}
    for name, fn in (
        ('openai', call_openai),
        ('grok', call_grok),
        ('gemini', call_gemini),
    ):
        try:
            results[name] = fn()
        except Exception as exc:
            results[name] = {'error': f'{type(exc).__name__}: {exc}'}
    OUTPUT_PATH.write_text(json.dumps(results, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(str(OUTPUT_PATH))
    print(json.dumps(results, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
