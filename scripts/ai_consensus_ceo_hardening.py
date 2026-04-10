#!/usr/bin/env python3
import json
import os
import time
from pathlib import Path

import requests

PROJECT_PROMPT = r'''Actúa como arquitecto/a senior de producto, seguridad aplicada, backend y UX operacional para AuditaPatron.

Contexto real del producto:
- Existe una Consola CEO para visión ejecutiva multi-tenant.
- El snapshot ejecutivo actual acepta filtros por tenantId, severity, caseId, userId, dateWindowDays y query.
- El acceso al snapshot ejecutivo está protegido como adminProcedure.
- Ya existen acciones seguras en la Consola CEO para: actualizar estatus de alertas, actualizar estatus de memberships limitados a casos, y confirmar únicamente el siguiente avance operativo permitido de un caso.
- El sistema ya registra audit logs en las acciones críticas.
- Ya existe búsqueda transversal, filtros avanzados y exportación ejecutiva PDF/CSV desde la Consola CEO.

Reglas operativas reales ya presentes:
- Solo administradores deben operar la Consola CEO.
- La actualización de memberships desde CEO solo aplica a accesos acotados a un caso específico.
- El avance de caso desde CEO solo puede confirmar el siguiente estado sugerido, no saltos arbitrarios.
- Las acciones críticas generan trazabilidad en audit logs.

Objetivo:
Queremos definir el ALCANCE MÍNIMO ÚTIL del endurecimiento V1 de permisos, validaciones y pruebas cruzadas del Dashboard CEO, evitando sobreingeniería.

Lo que necesito que propongas:
1. Qué validaciones adicionales sí conviene incorporar ya en V1 para evitar operaciones ambiguas, peligrosas o inconsistentes.
2. Qué permisos o restricciones conviene reforzar en backend aunque la UI ya oculte acciones.
3. Qué validaciones cruzadas frontend/backend son mínimas para reducir errores operativos sin volver rígida la experiencia.
4. Qué mensajes de error y microcopy deberían ver las personas administradoras cuando una acción segura no puede ejecutarse.
5. Qué pruebas Vitest mínimas deben existir para cubrir este endurecimiento V1.
6. Qué NO construir todavía para no meter complejidad innecesaria.

Restricciones:
- Mantener el alcance pequeño, útil y entregable en una iteración corta.
- No proponer RBAC complejo multinivel todavía.
- No introducir colas, aprobaciones humanas múltiples ni motores de políticas complejos.
- No rediseñar por completo la Consola CEO.
- Priorizar controles que reduzcan riesgo real y errores humanos.
- Responder en español.

Devuelve SOLO JSON válido con esta forma exacta:
{
  "model_positioning": "string",
  "v1_hardening_summary": "string",
  "backend_hardening": [
    {
      "title": "string",
      "why": "string",
      "impact": "high|medium|low",
      "effort": "high|medium|low"
    }
  ],
  "frontend_guardrails": [
    {
      "title": "string",
      "why": "string",
      "impact": "high|medium|low",
      "effort": "high|medium|low"
    }
  ],
  "cross_validations": [
    {
      "scenario": "string",
      "backend_check": "string",
      "frontend_check": "string",
      "expected_outcome": "string"
    }
  ],
  "safe_error_copy": {
    "forbidden": "string",
    "stale_data": "string",
    "invalid_transition": "string",
    "out_of_scope_membership": "string",
    "generic_retry": "string"
  },
  "vitest_minimum_suite": [
    {
      "test_name": "string",
      "covers": "string",
      "priority": "high|medium|low"
    }
  ],
  "do_not_build_yet": ["string"],
  "recommended_v1_scope": ["string"],
  "final_verdict": "string"
}
'''

SYSTEM_MESSAGE = "Eres un arquitecto senior de producto y seguridad aplicada. Debes responder únicamente JSON válido."


def extract_json_text(provider: str, body: dict):
    if provider == "chatgpt":
        return body["choices"][0]["message"]["content"]
    if provider == "grok":
        return body["choices"][0]["message"]["content"]
    if provider == "gemini":
        return body["candidates"][0]["content"]["parts"][0]["text"]
    raise ValueError(provider)


def normalize_response(provider: str, res: requests.Response):
    result = {
        "provider": provider,
        "http_status": res.status_code,
        "ok": res.ok,
        "received_at": int(time.time()),
    }
    try:
        body = res.json()
    except Exception:
        result["error"] = res.text[:4000]
        return result

    result["raw"] = body
    if not res.ok:
        result["error"] = body
        return result

    try:
        text = extract_json_text(provider, body)
        result["text"] = text
        result["parsed"] = json.loads(text)
    except Exception as exc:
        result["parse_error"] = str(exc)
    return result


def call_openai(prompt: str):
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        return {"provider": "chatgpt", "ok": False, "error": "OPENAI_API_KEY missing"}
    url = "https://api.openai.com/v1/chat/completions"
    payload = {
        "model": "gpt-4.1-mini",
        "temperature": 0.2,
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": SYSTEM_MESSAGE},
            {"role": "user", "content": prompt},
        ],
    }
    res = requests.post(
        url,
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        json=payload,
        timeout=90,
    )
    return normalize_response("chatgpt", res)


def call_grok(prompt: str):
    api_key = os.environ.get("XAI_API_KEY")
    if not api_key:
        return {"provider": "grok", "ok": False, "error": "XAI_API_KEY missing"}
    url = "https://api.x.ai/v1/chat/completions"
    payload = {
        "model": "grok-4-fast-non-reasoning",
        "temperature": 0.2,
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": SYSTEM_MESSAGE},
            {"role": "user", "content": prompt},
        ],
    }
    res = requests.post(
        url,
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        json=payload,
        timeout=90,
    )
    return normalize_response("grok", res)


def call_gemini(prompt: str):
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        return {"provider": "gemini", "ok": False, "error": "GEMINI_API_KEY missing"}
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}"
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": 0.2,
            "responseMimeType": "application/json",
        },
    }
    res = requests.post(url, headers={"Content-Type": "application/json"}, json=payload, timeout=90)
    return normalize_response("gemini", res)


def build_consensus(results: dict):
    parsed = {key: value.get("parsed") for key, value in results.items() if isinstance(value, dict) and value.get("parsed")}
    available = list(parsed.keys())

    recommendation_counter = {}
    for provider, payload in parsed.items():
        for item in payload.get("recommended_v1_scope", []):
            normalized = item.strip().lower()
            if not normalized:
                continue
            recommendation_counter.setdefault(normalized, {"count": 0, "providers": [], "text": item.strip()})
            recommendation_counter[normalized]["count"] += 1
            recommendation_counter[normalized]["providers"].append(provider)

    consensus_items = sorted(
        recommendation_counter.values(),
        key=lambda item: (-item["count"], item["text"]),
    )

    return {
        "available_models": available,
        "recommended_scope_consensus": consensus_items[:8],
        "raw_provider_summaries": {
            provider: {
                "v1_hardening_summary": payload.get("v1_hardening_summary"),
                "final_verdict": payload.get("final_verdict"),
            }
            for provider, payload in parsed.items()
        },
    }


def main():
    output_dir = Path("/home/ubuntu/complilink_operativo_v1/tmp")
    output_dir.mkdir(parents=True, exist_ok=True)

    results = {
        "chatgpt": call_openai(PROJECT_PROMPT),
        "grok": call_grok(PROJECT_PROMPT),
        "gemini": call_gemini(PROJECT_PROMPT),
    }
    consensus = build_consensus(results)
    payload = {
        "prompt": PROJECT_PROMPT,
        "results": results,
        "consensus": consensus,
        "generated_at": int(time.time()),
    }

    output_path = output_dir / "ceo_hardening_ai_consensus.json"
    output_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(str(output_path))


if __name__ == "__main__":
    main()
