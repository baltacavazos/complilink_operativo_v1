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
    "stack": "React + Tailwind + Express + tRPC + Drizzle + Manus OAuth",
    "current_ceo_dashboard": [
        "resumen ejecutivo",
        "KPIs operativos del CEO",
        "alertas con estado y severidad",
        "membresías y accesos por caso",
        "avance operativo de auditorías",
        "acciones administrativas seguras ya implementadas",
        "acceso restringido a administradores",
    ],
    "next_candidate_block": "filtros y búsqueda avanzada para la Consola CEO",
    "mandatory_dimensions": [
        "tenant",
        "caso",
        "usuario",
        "severidad",
        "fecha",
    ],
    "operating_constraints": [
        "la consola debe seguir siendo minimalista, ejecutiva y fácil de dejar abierta todo el día",
        "no re-arquitecturar el proyecto si puede reutilizarse el snapshot y las superficies actuales",
        "no mezclar usuarios con providers",
        "solo administradores deben ver y operar esta consola",
        "todo filtro debe ser útil para supervisión real, no decorativo",
        "la búsqueda debe reducir tiempo operativo, no añadir complejidad",
    ],
}

SYSTEM_PROMPT = (
    "Eres un arquitecto senior de producto, UX operacional y gobierno SaaS. "
    "Debes definir el bloque mínimo y más útil de filtros y búsqueda avanzada para un dashboard CEO, "
    "priorizando claridad, seguridad, valor operativo inmediato y viabilidad sobre una base ya existente."
)

USER_PROMPT = f"""
Analiza el siguiente contexto y devuelve EXCLUSIVAMENTE un JSON válido.

Contexto:
{json.dumps(PROJECT_CONTEXT, ensure_ascii=False, indent=2)}

Necesito decidir el siguiente bloque del Dashboard CEO. Ya existe una primera iteración con resumen, alertas, accesos, auditorías y acciones seguras puntuales.
Ahora toca definir el bloque mínimo útil de FILTROS Y BÚSQUEDA AVANZADA.

Tarea:
1. Define qué filtros sí conviene implementar ahora y cuáles no.
2. Define qué búsquedas rápidas conviene soportar en esta iteración.
3. Recomienda presets o vistas guardadas mínimas para un CEO.
4. Indica guardrails de backend, permisos y UX para que siga siendo simple y segura.
5. Propón el orden de implementación más sensato.

Devuelve solo JSON con esta estructura exacta:
{{
  "executive_summary": "string",
  "recommended_filters_now": [
    {{
      "filter": "string",
      "why_now": "string",
      "default_behavior": "string",
      "risk_level": "low|medium|high"
    }}
  ],
  "recommended_search_now": [
    {{
      "search_target": "string",
      "why_now": "string",
      "matching_strategy": "string"
    }}
  ],
  "defer_for_later": [
    {{
      "item": "string",
      "why_defer": "string"
    }}
  ],
  "recommended_presets": [
    {{
      "preset": "string",
      "purpose": "string"
    }}
  ],
  "guardrails": [
    {{
      "topic": "string",
      "controls": ["string"]
    }}
  ],
  "implementation_sequence": ["string"],
  "one_sentence_verdict": "string"
}}

Criterios obligatorios:
- Prioriza el mínimo útil y accionable.
- Mantén la consola ligera y entendible por un CEO no técnico.
- Reutiliza al máximo snapshot, tablas y vistas ya existentes.
- No conviertas la consola en un panel operativo de soporte.
- No incluyas texto fuera del JSON.
""".strip()


def ensure_output_dir() -> Path:
    out_dir = Path("/home/ubuntu/complilink_operativo_v1/research/ceo_filters_search")
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

    output_path = out_dir / "multi_ai_ceo_filters_results.json"
    output_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(str(output_path))


if __name__ == "__main__":
    main()
