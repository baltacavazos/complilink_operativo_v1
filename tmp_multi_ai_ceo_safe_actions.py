from __future__ import annotations

import json
import os
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import requests

PROJECT_CONTEXT = {
    "project_name": "complilink_operativo_v1",
    "visible_brand": "AuditaPatron",
    "core_engine": "Helios",
    "stack": "React + Tailwind + Express + tRPC + Drizzle + Manus OAuth",
    "current_ceo_dashboard": [
        "resumen ejecutivo",
        "KPIs operativos del CEO",
        "alertas con estado, severidad y timestamps visibles",
        "vista de membresías y accesos por caso",
        "estado de auditorías desde la consola",
        "trazabilidad documental con versiones o supersedencia visible",
        "acceso restringido a administradores",
    ],
    "explicit_exclusions": [
        "acciones globales irreversibles",
        "rotación de llaves",
        "apagado de registros",
        "controles técnicos profundos",
        "mezclar V2, branding o móvil en este bloque",
    ],
    "operating_constraints": [
        "dashboard minimalista, seguro y accionable",
        "el CEO debe poder operar sin soporte externo",
        "usar la base actual del proyecto sin re-arquitectura innecesaria",
        "cada acción debe dejar trazabilidad y ser defendible",
        "solo acciones seguras y acotadas para esta iteración",
    ],
    "goal_of_this_consult": "Definir el bloque mínimo y más útil de acciones administrativas seguras para la siguiente iteración del Dashboard CEO.",
}

SYSTEM_PROMPT = (
    "Eres un arquitecto senior de producto, operaciones y gobierno SaaS. "
    "Debes diseñar controles ejecutivos mínimos, seguros y accionables para un dashboard CEO de una plataforma laboral/documental con trazabilidad fuerte. "
    "Tu criterio debe priorizar seguridad operativa, simplicidad de uso y viabilidad inmediata sobre la base actual."
)

USER_PROMPT = f"""
Analiza el siguiente contexto y devuelve EXCLUSIVAMENTE un JSON válido.

Contexto:
{json.dumps(PROJECT_CONTEXT, ensure_ascii=False, indent=2)}

Necesito definir la siguiente iteración del Dashboard CEO. Ya existe una primera versión con lectura ejecutiva, alertas, membresías/accesos, estado de auditorías y trazabilidad documental.
Ahora necesito decidir el bloque mínimo útil de ACCIONES ADMINISTRATIVAS SEGURAS para que el CEO pueda operar sin depender de soporte externo.

Tarea:
1. Propón el conjunto mínimo de acciones administrativas seguras que sí conviene implementar ahora.
2. Indica cuáles deben quedarse fuera por riesgo o complejidad.
3. Define guardrails de backend, permisos, confirmaciones y auditoría para cada acción.
4. Recomienda la UX mínima para que la consola siga siendo no técnica y usable por un CEO.
5. Propón el orden de implementación más sensato sobre la base actual.

Devuelve solo JSON con esta estructura exacta:
{{
  "executive_summary": "string",
  "recommended_now": [
    {{
      "action": "string",
      "why_now": "string",
      "expected_result": "string",
      "risk_level": "low|medium|high"
    }}
  ],
  "defer_for_later": [
    {{
      "action": "string",
      "why_defer": "string"
    }}
  ],
  "guardrails": [
    {{
      "action": "string",
      "required_role": "string",
      "backend_controls": ["string"],
      "ui_confirmation": "string",
      "audit_requirements": ["string"]
    }}
  ],
  "ux_recommendations": ["string"],
  "implementation_sequence": ["string"],
  "one_sentence_verdict": "string"
}}

Criterios obligatorios:
- Prioriza acciones operativas reales, no controles técnicos profundos.
- Evita acciones destructivas globales.
- Reutiliza alertas, auditoría, casos, documentos y membresías ya existentes.
- Cada acción debe ser defendible desde seguridad, trazabilidad y UX.
- No incluyas texto fuera del JSON.
""".strip()


def ensure_output_dir() -> Path:
    out_dir = Path("/home/ubuntu/complilink_operativo_v1/research/ceo_safe_actions")
    out_dir.mkdir(parents=True, exist_ok=True)
    return out_dir


def extract_json(raw_text: str) -> Any:
    raw_text = raw_text.strip()
    if raw_text.startswith("```"):
        raw_text = re.sub(r"^```(?:json)?\s*", "", raw_text)
        raw_text = re.sub(r"\s*```$", "", raw_text)
    try:
        return json.loads(raw_text)
    except Exception:
        pass

    match = re.search(r"\{.*\}", raw_text, re.DOTALL)
    if not match:
        raise ValueError("No se encontró JSON en la respuesta")
    return json.loads(match.group(0))


def call_openai() -> dict[str, Any]:
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        return {"provider": "openai", "ok": False, "error": "OPENAI_API_KEY no disponible"}

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
    data = response.json()
    content = data["choices"][0]["message"]["content"]
    return {
        "provider": "openai",
        "ok": True,
        "model": data.get("model", "gpt-4.1-mini"),
        "content": content,
        "parsed": extract_json(content),
    }


def call_gemini() -> dict[str, Any]:
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        return {"provider": "gemini", "ok": False, "error": "GEMINI_API_KEY no disponible"}

    url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent"
    response = requests.post(
        f"{url}?key={api_key}",
        headers={"Content-Type": "application/json"},
        json={
            "contents": [
                {
                    "role": "user",
                    "parts": [{"text": f"{SYSTEM_PROMPT}\n\n{USER_PROMPT}"}],
                }
            ],
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
    return {
        "provider": "gemini",
        "ok": True,
        "model": "gemini-2.5-flash",
        "content": content,
        "parsed": extract_json(content),
    }


def call_grok() -> dict[str, Any]:
    api_key = os.environ.get("XAI_API_KEY")
    if not api_key:
        return {"provider": "grok", "ok": False, "error": "XAI_API_KEY no disponible"}

    response = requests.post(
        "https://api.x.ai/v1/chat/completions",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json={
            "model": "grok-4",
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
    data = response.json()
    content = data["choices"][0]["message"]["content"]
    return {
        "provider": "grok",
        "ok": True,
        "model": data.get("model", "grok-4"),
        "content": content,
        "parsed": extract_json(content),
    }


def main() -> None:
    out_dir = ensure_output_dir()
    started_at = datetime.now(timezone.utc).isoformat()

    results: list[dict[str, Any]] = []
    for caller in (call_openai, call_gemini, call_grok):
        try:
            results.append(caller())
        except Exception as exc:  # noqa: BLE001
            results.append(
                {
                    "provider": caller.__name__.replace("call_", ""),
                    "ok": False,
                    "error": f"{type(exc).__name__}: {exc}",
                }
            )

    payload = {
        "generated_at": started_at,
        "context": PROJECT_CONTEXT,
        "results": results,
    }

    output_path = out_dir / "multi_ai_ceo_safe_actions_results.json"
    output_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(str(output_path))


if __name__ == "__main__":
    main()
