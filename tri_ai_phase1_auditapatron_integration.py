import json
import os
import time
from typing import Any

import requests

PROJECT_CONTEXT = """
Proyecto actual: /home/ubuntu/complilink_operativo_v1

Estado técnico ya existente:
- La mutación cases.uploadDocument ya decodifica base64, calcula SHA-256, sube a S3, clasifica el documento y genera contratos canónicos.
- server/routers.ts ya crea documentContract y shared_engine envelope al subir documentos.
- server/caseContracts.ts ya tiene computeSha256, classifyMexicanLaborDocument, buildCanonicalDocumentContract y buildSharedEngineEnvelope.
- drizzle/schema.ts ya tiene case_documents con documentId, storageKey, storageUrl, sha256, documentType, sourceChannel, consentStatus, visibility, processedAt y timestamps.

Objetivo de Fase 1:
- NO rehacer la plataforma.
- Reutilizar la tubería documental actual.
- Dejar lista la integración de AuditaPatron con un motor inteligente externo.
- Cada archivo subido por usuarios debe alimentar el motor.
- Preparar comunicación server-to-server segura.
- Mantener trazabilidad documental completa.

Contexto del PDF de integración:
- Recomienda un webhook POST /api/auditapatron/webhook con HMAC.
- Recomienda campos mínimos: documentId, fileUrl, fileKey, sha256, mimeType, docType, sourceUserId, auditId/caseId, uploadedAt.
- Recomienda no exponer secretos al frontend.
- Recomienda payload versionado y pruebas end-to-end.

Necesidad de decisión inmediata:
Dado el código existente, propone la implementación mínima y más robusta para Fase 1 del lado AuditaPatron. Prioriza reutilización, mínima complejidad y capacidad de arrancar hoy.
""".strip()

SYSTEM_PROMPT = """
Eres un arquitecto de software senior. Responde SOLO en JSON válido, sin markdown. Debes proponer una implementación mínima, concreta y accionable. Evita rediseños totales. Prioriza reusar lo existente. Si un dato falta, haz una suposición explícita y conservadora.
""".strip()

USER_PROMPT = f"""
Analiza este contexto:
{PROJECT_CONTEXT}

Devuelve JSON con esta estructura exacta:
{{
  "recommended_scope": "string",
  "implementation_shape": "string",
  "files_to_change": [
    {{"path": "string", "change": "string", "priority": "high|medium|low"}}
  ],
  "schema_strategy": {{
    "choice": "reuse_existing|minimal_extension|new_tables",
    "reason": "string",
    "minimum_fields_if_needed": ["string"]
  }},
  "integration_contract": {{
    "transport": "string",
    "direction": "string",
    "auth": "string",
    "event_name": "string",
    "minimum_payload_fields": ["string"],
    "idempotency_strategy": "string"
  }},
  "env_and_secret_strategy": {{
    "needed_envs": [
      {{"key": "string", "purpose": "string", "required": true}}
    ],
    "server_only": ["string"]
  }},
  "testing_strategy": {{
    "unit_tests": ["string"],
    "integration_tests": ["string"],
    "failure_cases": ["string"]
  }},
  "risks": [
    {{"risk": "string", "mitigation": "string"}}
  ],
  "first_patch_order": ["string"],
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
        "temperature": 0.2,
    }
    r = requests.post(url, headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}, json=payload, timeout=120)
    r.raise_for_status()
    data = r.json()
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
        "temperature": 0.2,
    }
    r = requests.post(url, headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}, json=payload, timeout=120)
    r.raise_for_status()
    data = r.json()
    return json.loads(data["choices"][0]["message"]["content"])


def post_gemini(api_key: str) -> dict[str, Any]:
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}"
    payload = {
        "system_instruction": {"parts": [{"text": SYSTEM_PROMPT}]},
        "contents": [{"role": "user", "parts": [{"text": USER_PROMPT}]}],
        "generationConfig": {
            "temperature": 0.2,
            "responseMimeType": "application/json",
        },
    }
    r = requests.post(url, headers={"Content-Type": "application/json"}, json=payload, timeout=120)
    r.raise_for_status()
    data = r.json()
    text = data["candidates"][0]["content"]["parts"][0]["text"]
    return json.loads(text)


def safe_call(name: str, fn, api_key: str | None):
    started = time.time()
    if not api_key:
        return {"status": "unavailable", "error": "missing_api_key", "elapsed_seconds": 0}
    try:
        result = fn(api_key)
        return {"status": "ok", "elapsed_seconds": round(time.time() - started, 2), "result": result}
    except Exception as exc:
        return {"status": "error", "elapsed_seconds": round(time.time() - started, 2), "error": str(exc)}


def main():
    output = {
        "context_summary": PROJECT_CONTEXT,
        "models": {
            "chatgpt": safe_call("chatgpt", post_openai, os.getenv("OPENAI_API_KEY")),
            "grok": safe_call("grok", post_xai, os.getenv("XAI_API_KEY")),
            "gemini": safe_call("gemini", post_gemini, os.getenv("GEMINI_API_KEY")),
        },
    }
    out_path = "/home/ubuntu/complilink_operativo_v1/tri_ai_phase1_auditapatron_integration_output.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)
    print(out_path)


if __name__ == "__main__":
    main()
