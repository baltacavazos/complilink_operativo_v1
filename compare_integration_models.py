from __future__ import annotations

import json
import os
import re
from pathlib import Path
from typing import Any

import requests

ROOT = Path("/home/ubuntu/complilink_operativo_v1")
SERVICE_PATH = ROOT / "server" / "auditaPatronIntegrationService.ts"
TEST_PATH = ROOT / "server" / "auditaPatronIntegrationService.test.ts"
OUTPUT_PATH = ROOT / "integration_model_comparison.json"

PDF_1_SUMMARY = """
Documento 1: Conectar AuditaPatron con CompliLink MX.
- Health check: GET https://complilink.mx/api/auditapatron/health
- Webhook: POST https://complilink.mx/api/auditapatron/webhook
- El documento indica firma HMAC-SHA256 con headers X-AuditaPatron-Signature y X-AuditaPatron-Timestamp.
- El ejemplo inicial habla de event=document.submitted y documentType dentro de data.
- El payload de ejemplo usa campos anidados en data: documentType, employerRfc, workerName, fileUrl, fileMimeType, period.
- Se mencionan tipos soportados: recibo_nomina, constancia_imss, constancia_infonavit, contrato_laboral, cfdi_nomina, opinion_cumplimiento.
""".strip()

PDF_2_SUMMARY = """
Documento 2: Respuesta del arquitecto de CompliLink MX — Contrato de integración confirmado.
- Confirmación explícita del lado receptor ya preparado y publicado.
- Evento actualmente esperado: document.uploaded.
- Payload exacto esperado:
  {
    event,
    documentId,
    sourceUserId,
    docType,
    fileUrl,
    sha256,
    mimeType,
    uploadedAt,
    fileSizeBytes?,
    auditId?,
    caseId?,
    metadata?
  }
- Respuestas esperadas:
  * HTTP 201 para documento nuevo con success=true e isDuplicate=false.
  * HTTP 200 para duplicado por sha256 con isDuplicate=true.
- Errores esperados: 401 missing_signature, 401 invalid_signature, 400 missing_fields, 400 invalid_payload, 400 unknown_event, 429 rate_limit_exceeded, 500 internal_error.
- Idempotencia: deduplicación por sha256. Reintentos seguros.
- Reintentos: solo en 5xx con backoff exponencial 30s -> 60s -> 120s, máximo 3 intentos. No reintentar 4xx.
- Firma HMAC: signature = HMAC_SHA256(secret, timestamp + '.' + body).
- Test mode: si documentId empieza con test_, valida firma y responde OK sin procesar.
- Doc types confirmados: recibo_nomina, constancia_imss, constancia_infonavit, contrato_laboral, cfdi_nomina, opinion_cumplimiento.
""".strip()

PROMPT_TEMPLATE = """
Analiza la integración entre AuditaPatron y CompliLink MX con base en dos fuentes documentales y el código actual del adaptador.

Quiero una respuesta estrictamente en JSON válido con esta forma exacta:
{{
  "summary": "string breve",
  "current_mismatches": [
    {{
      "area": "string",
      "severity": "high|medium|low",
      "issue": "string",
      "required_change": "string"
    }}
  ],
  "target_contract": {{
    "event": "string",
    "required_fields": ["string"],
    "optional_fields": ["string"],
    "signature_algorithm": "string",
    "signature_input": "string",
    "required_headers": ["string"],
    "retry_policy": "string",
    "idempotency_rule": "string"
  }},
  "doc_type_mapping": [
    {{
      "current_internal_type": "string",
      "target_doc_type": "string",
      "notes": "string"
    }}
  ],
  "implementation_sequence": ["string"],
  "risks": ["string"],
  "go_no_go": "go|go_with_changes|no_go"
}}

Criterios:
1. Debes priorizar el Documento 2 como contrato fuente de verdad si contradice el Documento 1.
2. Debes comparar explícitamente el código actual contra el contrato confirmado.
3. Debes identificar incompatibilidades exactas, no generalidades.
4. Debes proponer un mapeo concreto entre tipos documentales internos y docType de CompliLink MX.
5. No expliques fuera del JSON.

Documento 1:
__PDF1__

Documento 2:
__PDF2__

Código actual del adaptador TypeScript:
```ts
__SERVICE_CODE__
```

Pruebas actuales del adaptador:
```ts
__TEST_CODE__
```
""".strip()


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def build_prompt() -> str:
    return (
        PROMPT_TEMPLATE.replace("__PDF1__", PDF_1_SUMMARY)
        .replace("__PDF2__", PDF_2_SUMMARY)
        .replace("__SERVICE_CODE__", read_text(SERVICE_PATH))
        .replace("__TEST_CODE__", read_text(TEST_PATH))
    )


def extract_json(text: str) -> Any:
    text = text.strip()
    if not text:
        raise ValueError("Respuesta vacía")
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", text, re.DOTALL)
        if not match:
            raise
        return json.loads(match.group(0))


def call_openai(prompt: str) -> dict[str, Any]:
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY no disponible")
    response = requests.post(
        "https://api.openai.com/v1/chat/completions",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json={
            "model": "gpt-4.1-mini",
            "temperature": 0.2,
            "response_format": {"type": "json_object"},
            "messages": [
                {
                    "role": "system",
                    "content": "Eres un arquitecto de integración. Responde solo JSON válido.",
                },
                {"role": "user", "content": prompt},
            ],
        },
        timeout=120,
    )
    response.raise_for_status()
    data = response.json()
    content = data["choices"][0]["message"]["content"]
    return {"raw": content, "parsed": extract_json(content)}


def call_gemini(prompt: str) -> dict[str, Any]:
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY no disponible")
    response = requests.post(
        f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}",
        headers={"Content-Type": "application/json"},
        json={
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {
                "temperature": 0.2,
                "responseMimeType": "application/json",
            },
        },
        timeout=120,
    )
    response.raise_for_status()
    data = response.json()
    content = data["candidates"][0]["content"]["parts"][0]["text"]
    return {"raw": content, "parsed": extract_json(content)}


def call_grok(prompt: str) -> dict[str, Any]:
    api_key = os.environ.get("XAI_API_KEY")
    if not api_key:
        raise RuntimeError("XAI_API_KEY no disponible")
    response = requests.post(
        "https://api.x.ai/v1/chat/completions",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json={
            "model": "grok-4",
            "temperature": 0.2,
            "messages": [
                {
                    "role": "system",
                    "content": "Eres un arquitecto de integración. Responde exclusivamente con JSON válido.",
                },
                {"role": "user", "content": prompt},
            ],
        },
        timeout=120,
    )
    response.raise_for_status()
    data = response.json()
    content = data["choices"][0]["message"]["content"]
    return {"raw": content, "parsed": extract_json(content)}


def main() -> None:
    prompt = build_prompt()

    results: dict[str, Any] = {"prompt_version": 2, "results": {}}
    errors: dict[str, str] = {}

    for name, fn in (("chatgpt", call_openai), ("gemini", call_gemini), ("grok", call_grok)):
        try:
            results["results"][name] = fn(prompt)
        except Exception as exc:  # noqa: BLE001
            errors[name] = f"{type(exc).__name__}: {exc}"

    if errors:
        results["errors"] = errors

    OUTPUT_PATH.write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")
    print(str(OUTPUT_PATH))


if __name__ == "__main__":
    main()
