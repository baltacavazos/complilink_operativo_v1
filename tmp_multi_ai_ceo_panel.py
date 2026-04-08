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
    "product_visible_brand": "AuditaPatron",
    "core_engine": "Helios",
    "stack": "React + Tailwind + Express + tRPC + Drizzle + Manus OAuth",
    "current_capabilities": [
        "autenticación y control de acceso",
        "casos laborales",
        "carga documental",
        "trazabilidad y auditoría",
        "consentimientos y políticas",
        "opiniones visibles de Helios por documento",
        "resumen Helios-first de expediente y documentos en /auditar",
    ],
    "constraints": [
        "no abrir arquitectura paralela innecesaria",
        "Helios debe ser el núcleo central",
        "mínima dependencia operativa de Manus para el CEO",
        "solución simple, robusta, escalable y de costo contenido",
        "priorizar MVP y control operativo real",
    ],
    "ceo_goal": "Tener un panel de control para consultar y controlar toda la plataforma sin necesidad de usar Manus.",
}

SYSTEM_PROMPT = (
    "Eres un arquitecto de producto y operaciones SaaS B2B/B2C con criterio de CEO, "
    "experiencia en paneles de control ejecutivos, operación multi-tenant, observabilidad, "
    "riesgo, gobierno de datos y plataformas documentales asistidas por IA. "
    "Debes proponer una solución concreta, mínima pero poderosa, orientada a ejecución real."
)

USER_PROMPT = f"""
Analiza el siguiente contexto y devuelve EXCLUSIVAMENTE un JSON válido.

Contexto del producto:
{json.dumps(PROJECT_CONTEXT, ensure_ascii=False, indent=2)}

Necesito definir el mejor panel de control CEO para operar y supervisar toda la plataforma sin depender de Manus.
El panel debe permitir visibilidad ejecutiva y control operativo real sobre el negocio, el producto y la operación.

Objetivo del análisis:
1. Definir el alcance mínimo viable del panel CEO.
2. Proponer módulos exactos y priorizados.
3. Identificar qué puede controlarse desde ese panel en fase 1 sin complicar demasiado el sistema.
4. Reutilizar al máximo la arquitectura existente.
5. Mantener a Helios como núcleo central.
6. Evitar crear superficies de administración innecesarias o duplicadas.

Devuelve solo JSON con esta estructura exacta:
{{
  "executive_summary": "string breve",
  "panel_principle": "string",
  "recommended_scope_v1": ["string"],
  "modules": [
    {{
      "name": "string",
      "priority": "P0|P1|P2",
      "why_it_matters": "string",
      "primary_views": ["string"],
      "control_actions": ["string"],
      "reuse_existing_foundations": ["string"],
      "notes": "string"
    }}
  ],
  "core_kpis": [
    {{
      "name": "string",
      "formula_or_meaning": "string",
      "why_ceo_needs_it": "string"
    }}
  ],
  "access_model": {{
    "recommended_roles": ["string"],
    "ceo_permissions": ["string"],
    "guardrails": ["string"]
  }},
  "operational_controls_v1": ["string"],
  "data_and_event_surfaces": ["string"],
  "risks_if_overbuilt_too_early": ["string"],
  "implementation_sequence": ["string"],
  "north_star_recommendation": "string"
}}

Criterios obligatorios:
- Piensa como si el CEO necesitara revisar negocio, operación y producto en minutos.
- Prioriza control real sobre: casos, documentos, alertas, usuarios, tenants, integraciones, salud operativa y actividad de Helios.
- La propuesta debe ser implementable sobre la base actual del proyecto.
- Evita una propuesta grandilocuente; prioriza algo usable, mínimo, robusto y evolutivo.
- Si algo debería quedarse fuera de la fase 1, dilo claramente.
- No incluyas texto fuera del JSON.
""".strip()


def ensure_output_dir() -> Path:
    out_dir = Path("/home/ubuntu/complilink_operativo_v1/research/ceo_panel")
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

    url = (
        "https://generativelanguage.googleapis.com/v1beta/models/"
        "gemini-2.5-flash:generateContent"
    )
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

    output_path = out_dir / "multi_ai_ceo_panel_results.json"
    output_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(str(output_path))


if __name__ == "__main__":
    main()
