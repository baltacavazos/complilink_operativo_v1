import json
import os
import time
from pathlib import Path

import requests

PROJECT_ROOT = Path("/home/ubuntu/complilink_operativo_v1")
OUTPUT_PATH = PROJECT_ROOT / "bidirectional_webhook_model_comparison.json"

SYSTEM_PROMPT = (
    "Eres un arquitecto senior de integraciones y webhooks. "
    "Debes responder con JSON válido, compacto y accionable."
)

USER_PROMPT = """
Contexto:
- AuditaPatron es la experiencia frontal para el trabajador: captura documentos, muestra expediente y trazabilidad.
- CompliLink MX es la capa operativa que recibe documentos y ejecuta el procesamiento pesado.
- Ya existe un contrato confirmado de salida desde AuditaPatron hacia CompliLink MX.
- El contrato confirmado de salida es:
  - evento: document.uploaded
  - headers requeridos: X-AuditaPatron-Timestamp y X-AuditaPatron-Signature
  - firma: HMAC-SHA256 sobre la cadena timestamp.body
  - CompliLink deduplica por sha256
  - AuditaPatron debe reintentar solo errores 5xx con backoff 30s, 60s, 120s
- Tipos documentales externos confirmados: recibo_nomina, cfdi_nomina, constancia_imss, constancia_infonavit, contrato_laboral, opinion_cumplimiento
- Capacidades actuales de AuditaPatron:
  - Backend Express con endpoints HTTP públicos posibles
  - Base de datos con labor_cases, case_documents, case_events, operational_alerts, canonical_contracts y audit_logs
  - Hoy NO existe un webhook público de retorno desde CompliLink hacia AuditaPatron
  - Hoy NO hay helpers dedicados para actualizar automáticamente documentos/casos tras análisis externo
- Objetivo del negocio: máxima automatización bidireccional con mínima intervención humana, alta robustez, bajo costo inicial y rápida operación.

Tarea:
Diseña la arquitectura mínima y robusta para el RETORNO desde CompliLink MX hacia AuditaPatron.
Quiero que definas:
1. el conjunto mínimo de eventos de retorno recomendados,
2. el payload mínimo por evento,
3. la estrategia de autenticación y firma del retorno,
4. la estrategia de idempotencia,
5. cómo debe reaccionar AuditaPatron en BD y trazabilidad,
6. cómo manejar reintentos, duplicados y eventos fuera de orden,
7. qué campos deben quedarse internos en AuditaPatron y no viajar en el webhook,
8. un veredicto final de implementación MVP de doble vía.

Responde SOLO con JSON válido usando exactamente esta forma:
{
  "recommended_inbound_events": [
    {
      "event": "string",
      "purpose": "string",
      "required_fields": ["string"],
      "optional_fields": ["string"]
    }
  ],
  "security": {
    "signature_algorithm": "string",
    "signature_input": "string",
    "required_headers": ["string"],
    "timestamp_tolerance_seconds": 0
  },
  "idempotency": {
    "key_strategy": "string",
    "duplicate_behavior": "string"
  },
  "auditapatron_reactions": {
    "db_updates": ["string"],
    "case_events": ["string"],
    "alerts": ["string"],
    "audit_logs": ["string"]
  },
  "resilience": {
    "retry_policy_for_complilink": "string",
    "out_of_order_handling": "string",
    "dead_letter_recommendation": "string"
  },
  "keep_internal_only": ["string"],
  "mvp_verdict": "string"
}
""".strip()


def post_openai():
    api_key = os.environ.get("OPENAI_API_KEY", "").strip()
    if not api_key:
        return {"error": "missing_openai_api_key"}

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
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": USER_PROMPT},
            ],
        },
        timeout=120,
    )
    response.raise_for_status()
    payload = response.json()
    content = payload["choices"][0]["message"]["content"]
    return json.loads(content)


def post_gemini():
    api_key = os.environ.get("GEMINI_API_KEY", "").strip()
    if not api_key:
        return {"error": "missing_gemini_api_key"}

    response = requests.post(
        f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}",
        headers={"Content-Type": "application/json"},
        json={
            "generationConfig": {
                "temperature": 0.2,
                "responseMimeType": "application/json",
            },
            "systemInstruction": {
                "parts": [{"text": SYSTEM_PROMPT}]
            },
            "contents": [
                {
                    "role": "user",
                    "parts": [{"text": USER_PROMPT}],
                }
            ],
        },
        timeout=120,
    )
    response.raise_for_status()
    payload = response.json()
    text = payload["candidates"][0]["content"]["parts"][0]["text"]
    return json.loads(text)


def post_grok():
    api_key = os.environ.get("XAI_API_KEY", "").strip()
    if not api_key:
        return {"error": "missing_xai_api_key"}

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
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": USER_PROMPT},
            ],
            "response_format": {"type": "json_object"},
        },
        timeout=120,
    )
    response.raise_for_status()
    payload = response.json()
    content = payload["choices"][0]["message"]["content"]
    return json.loads(content)


if __name__ == "__main__":
    started_at = time.time()
    results = {
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "prompt": USER_PROMPT,
        "models": {},
    }

    for name, fn in (("chatgpt", post_openai), ("gemini", post_gemini), ("grok", post_grok)):
        try:
            results["models"][name] = {
                "status": "ok",
                "output": fn(),
            }
        except Exception as exc:  # noqa: BLE001
            results["models"][name] = {
                "status": "error",
                "error": str(exc),
            }

    results["duration_seconds"] = round(time.time() - started_at, 2)
    OUTPUT_PATH.write_text(json.dumps(results, ensure_ascii=False, indent=2))
    print(str(OUTPUT_PATH))
