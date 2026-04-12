import json
import os
import time
from typing import Any

import requests

CONTRACT_SUMMARY = """
Contrato externo final del bridge AuditaPatrón → CompliLink (fuente autoritativa: PDF adjunto):
- Endpoint de entrada hacia CompliLink: POST /api/integrations/auditapatron/bridge.
- Autenticación aceptada: Authorization: Bearer <shared-secret> o x-auditapatron-token: <shared-secret>.
- Firma opcional preparada: x-auditapatron-signature = HMAC-SHA256(raw_body).
- Payload de entrada obligatorio: providerId (int), userId (int), title (string), mimeType (string), y al menos uno de base64Data o fileUrl.
- Payload opcional incluye: documentId, category, obligation, originalFileName, notes, sourceModule, sourceCaseId, sourceDocumentId, uploadedAt, traceId, processingStatus, idempotencyKey, tags, operationalContext.
- Regla de idempotencia contractual: clave canónica eventId; claves de respaldo correlationId + eventName; retención 7 días; ante duplicado devolver mismo acuse sin reprocesar.
- Catálogo final de eventos de retorno normalizado: document.processed.v1, document.rejected.v1, document.retry_requested.v1.
- Política de reintentos: solo document.retry_requested.v1 es retryable; document.processed.v1 y document.rejected.v1 son finales.
- Respuestas HTTP esperadas del receptor: 200 con acuse enriquecido (received, intakeId, documentId, processingStatus, traceId, correlationId, remoteEventId, receivedAt, memoryLinks, recommendedNextAction, responseContract), 400 por payload inválido con issues[], 403 por autenticación fallida, 500 por error interno.
- Existe además un contrato consultable GET /api/integrations/auditapatron/bridge/contract que devuelve contractReady, target, responseContract, target=auditapatron, deliveryMode=outbound_webhook, method=POST, contentType=application/json.
""".strip()

IMPLEMENTATION_SUMMARY = """
Resumen de implementación actual observado en el código:
- server/auditaPatronIntegrationService.ts construye un payload saliente con evento fijo document.uploaded y campos: documentId, sourceUserId, docType, fileUrl, sha256, mimeType, uploadedAt, fileSizeBytes, auditId, caseId, dispatchId, correlationId, metadata.
- En ese mismo archivo, los eventos de retorno soportados hoy son: document.processing.started, document.analysis.completed, contract.analysis.detailed, document.analyzed, audit.completed.
- La verificación de firma actual usa timestamp + payloadBody + secret, leyendo X-AuditaPatron-Signature y X-AuditaPatron-Timestamp.
- server/auditaPatronReturnWebhook.ts registra el webhook entrante en POST /api/auditapatron/complilink-webhook.
- Ese webhook exige firma válida y responde 401 cuando la verificación falla.
- El webhook actual valida payload.event y payload.documentId, y devuelve 400 por missing_fields o unknown_event.
- La idempotencia actual del webhook entrante se construye con un hash sha256 de: event, documentId, compliLinkId, correlationId, timestamp, signature y rawBody; luego se persiste con registerCompliLinkWebhookEvent.
- Si detecta duplicado, responde 200 con { success: true, duplicate: true, event, documentId, caseId, traceId, correlationId }.
- Si procesa bien, responde 200 con { success: true, event, documentId, caseId, traceId, correlationId }.
- buildEventDescriptor todavía mapea eventos antiguos de análisis (processing.started, analysis.completed, analyzed, contract.analysis.detailed), no el catálogo final del PDF.
- El webhook de retorno está modelado como entrada desde CompliLink hacia el proyecto actual, no como el contrato de entrada contractual final hacia CompliLink descrito en el PDF.
""".strip()

SYSTEM_PROMPT = """
Eres un arquitecto de integración senior. Debes comparar un contrato externo final contra una implementación real ya existente. Responde SOLO en JSON válido, sin markdown. No rediseñes toda la plataforma. Detecta incompatibilidades concretas, prioriza cambios mínimos y separa claramente lo que es obligatorio para cumplir contrato de lo que es deseable pero opcional.
""".strip()

USER_PROMPT = f"""
Compara estas dos fuentes:

[CONTRATO AUTORITATIVO]
{CONTRACT_SUMMARY}

[IMPLEMENTACIÓN ACTUAL]
{IMPLEMENTATION_SUMMARY}

Devuelve JSON con esta estructura exacta:
{{
  "overall_alignment": "high|medium|low",
  "obligatory_gaps": [
    {{
      "area": "string",
      "contract_requirement": "string",
      "current_behavior": "string",
      "impact": "high|medium|low",
      "recommended_change": "string"
    }}
  ],
  "optional_gaps": [
    {{
      "area": "string",
      "recommendation": "string",
      "reason": "string"
    }}
  ],
  "schema_assessment": {{
    "needs_db_change": true,
    "reason": "string",
    "suggested_minimum_fields": ["string"]
  }},
  "endpoint_plan": {{
    "should_keep_existing_return_webhook": true,
    "new_or_updated_ingress_endpoint": "string",
    "new_or_updated_contract_endpoint": "string",
    "notes": "string"
  }},
  "security_assessment": {{
    "auth_mode_to_support_now": ["string"],
    "signature_mode": "string",
    "response_code_change_needed": "string"
  }},
  "event_mapping": {{
    "replace_existing_return_events": true,
    "final_event_names": ["string"],
    "transition_note": "string"
  }},
  "test_plan": ["string"],
  "minimal_patch_order": ["string"],
  "verdict": "string"
}}
""".strip()


def post_openai(api_key: str) -> dict[str, Any]:
    url = "https://api.openai.com/v1/chat/completions"
    payload = {
        "model": "gpt-4o-mini",
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": USER_PROMPT},
        ],
        "temperature": 0.1,
    }
    response = requests.post(
        url,
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        json=payload,
        timeout=120,
    )
    response.raise_for_status()
    data = response.json()
    return json.loads(data["choices"][0]["message"]["content"])


def post_xai(api_key: str) -> dict[str, Any]:
    url = "https://api.x.ai/v1/chat/completions"
    payload = {
        "model": "grok-4",
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": USER_PROMPT},
        ],
        "temperature": 0.1,
    }
    response = requests.post(
        url,
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        json=payload,
        timeout=120,
    )
    response.raise_for_status()
    data = response.json()
    return json.loads(data["choices"][0]["message"]["content"])


def post_gemini(api_key: str) -> dict[str, Any]:
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}"
    payload = {
        "system_instruction": {"parts": [{"text": SYSTEM_PROMPT}]},
        "contents": [{"role": "user", "parts": [{"text": USER_PROMPT}]}],
        "generationConfig": {
            "temperature": 0.1,
            "responseMimeType": "application/json",
        },
    }
    response = requests.post(url, headers={"Content-Type": "application/json"}, json=payload, timeout=120)
    response.raise_for_status()
    data = response.json()
    text = data["candidates"][0]["content"]["parts"][0]["text"]
    return json.loads(text)


def safe_call(fn, api_key: str | None):
    started = time.time()
    if not api_key:
        return {"status": "unavailable", "elapsed_seconds": 0, "error": "missing_api_key"}
    try:
        result = fn(api_key)
        return {"status": "ok", "elapsed_seconds": round(time.time() - started, 2), "result": result}
    except Exception as exc:
        return {"status": "error", "elapsed_seconds": round(time.time() - started, 2), "error": str(exc)}


def main():
    output = {
        "contract_summary": CONTRACT_SUMMARY,
        "implementation_summary": IMPLEMENTATION_SUMMARY,
        "models": {
            "chatgpt": safe_call(post_openai, os.getenv("OPENAI_API_KEY")),
            "grok": safe_call(post_xai, os.getenv("XAI_API_KEY")),
            "gemini": safe_call(post_gemini, os.getenv("GEMINI_API_KEY")),
        },
    }
    out_path = "/home/ubuntu/complilink_operativo_v1/tri_ai_bridge_contract_alignment_output.json"
    with open(out_path, "w", encoding="utf-8") as file_handle:
        json.dump(output, file_handle, ensure_ascii=False, indent=2)
    print(out_path)


if __name__ == "__main__":
    main()
