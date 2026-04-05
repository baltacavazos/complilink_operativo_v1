from __future__ import annotations

import json
import os
import sys
from pathlib import Path
from typing import Any

import requests

PROJECT_ROOT = Path("/home/ubuntu/complilink_operativo_v1")
REPORT_PATH = PROJECT_ROOT / "tri_ai_review_report.md"

REQUIREMENTS = """
Proyecto: plataforma de gestión de casos laborales para contexto corporativo mexicano.

Requisitos:
1. Autenticación con Manus OAuth y control de acceso por tenant/caso.
2. Gestión de casos laborales con estados, timelines y metadatos canónicos tenant_id, case_id, trace_id.
3. Intake documental con carga de archivos a S3, registro de metadatos y hash SHA-256 para trazabilidad.
4. Clasificación básica de documentos laborales mexicanos: recibos de nómina, CFDI, IMSS.
5. Vista de casos activos con filtros por estado, tenant y fecha.
6. Dashboard ejecutivo con KPIs de casos, documentos procesados y alertas operativas.
7. Sistema de consentimiento y políticas de visibilidad por documento y caso.
8. Registro de auditoría con trace_id para trazabilidad de punta a punta.
9. Preparación de contratos canónicos para futura integración con Shared Engine.
10. Diseño responsive con identidad visual profesional para contexto corporativo mexicano.

Restricciones:
- Todos los metadatos tenant_id, case_id y trace_id deben aplicarse consistentemente.
- Hash SHA-256 obligatorio para integridad documental.
- Arquitectura multi-tenant con controles estrictos por tenant y caso.
- Evaluar no solo cobertura funcional sino también robustez, seguridad, UX, trazabilidad y readiness para una V1.
""".strip()

FILES_TO_REVIEW = [
    PROJECT_ROOT / "drizzle/schema.ts",
    PROJECT_ROOT / "server/db.ts",
    PROJECT_ROOT / "server/routers.ts",
    PROJECT_ROOT / "server/caseContracts.ts",
    PROJECT_ROOT / "server/caseContracts.test.ts",
    PROJECT_ROOT / "client/src/pages/Home.tsx",
    PROJECT_ROOT / "todo.md",
]

SYSTEM_PROMPT = """
Eres un auditor senior de producto, ingeniería y seguridad para software legal-laboral enterprise en México.
Evalúa una implementación V1 real de una plataforma multi-tenant de gestión de casos laborales.
Debes ser riguroso, concreto y útil. No seas complaciente.
Responde ÚNICAMENTE JSON válido con esta forma exacta:
{
  "model": "string",
  "readiness_score": 0,
  "summary": "string",
  "requirement_coverage": [
    {
      "id": 1,
      "status": "full|partial|missing",
      "notes": "string"
    }
  ],
  "strengths": ["string"],
  "gaps": ["string"],
  "risks": ["string"],
  "top_actions": ["string"]
}
No uses markdown. No agregues texto adicional fuera del JSON.
""".strip()


def read_project_bundle() -> str:
    sections: list[str] = []
    for path in FILES_TO_REVIEW:
        if not path.exists():
            continue
        content = path.read_text(encoding="utf-8")
        sections.append(f"\n\n### FILE: {path.relative_to(PROJECT_ROOT)}\n{content}")
    return "".join(sections)


def build_user_prompt(bundle: str) -> str:
    return (
        f"{REQUIREMENTS}\n\n"
        "Analiza la implementación incluida abajo. Quiero una auditoría de V1 enfocada en:\n"
        "- cobertura real de requisitos\n"
        "- brechas funcionales o técnicas\n"
        "- seguridad y control de acceso\n"
        "- trazabilidad de tenant_id, case_id y trace_id\n"
        "- robustez del intake documental y hashing\n"
        "- calidad del dashboard y UX corporativa\n"
        "- preparación para Shared Engine\n"
        "- prioridad exacta de los siguientes pasos\n\n"
        f"IMPLEMENTACIÓN A REVISAR:{bundle}"
    )


def parse_json_response(raw_text: str) -> dict[str, Any]:
    text = raw_text.strip()
    if text.startswith("```"):
        text = text.strip("`")
        if text.lower().startswith("json"):
            text = text[4:].strip()
    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end == -1 or end < start:
        raise ValueError(f"No se encontró JSON válido en la respuesta: {raw_text[:400]}")
    return json.loads(text[start : end + 1])


def call_openai(user_prompt: str, api_key: str) -> dict[str, Any]:
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
                {"role": "user", "content": user_prompt},
            ],
        },
        timeout=180,
    )
    response.raise_for_status()
    payload = response.json()
    text = payload["choices"][0]["message"]["content"]
    parsed = parse_json_response(text)
    parsed.setdefault("model", "gpt-4.1-mini")
    return parsed


def call_gemini(user_prompt: str, api_key: str) -> dict[str, Any]:
    response = requests.post(
        f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}",
        headers={"Content-Type": "application/json"},
        json={
            "generationConfig": {
                "temperature": 0.2,
                "responseMimeType": "application/json",
            },
            "contents": [
                {
                    "role": "user",
                    "parts": [
                        {"text": SYSTEM_PROMPT},
                        {"text": user_prompt},
                    ],
                }
            ],
        },
        timeout=180,
    )
    response.raise_for_status()
    payload = response.json()
    text = payload["candidates"][0]["content"]["parts"][0]["text"]
    parsed = parse_json_response(text)
    parsed.setdefault("model", "gemini-2.5-flash")
    return parsed


def call_grok(user_prompt: str, api_key: str) -> dict[str, Any]:
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
                {"role": "user", "content": user_prompt},
            ],
        },
        timeout=180,
    )
    response.raise_for_status()
    payload = response.json()
    text = payload["choices"][0]["message"]["content"]
    parsed = parse_json_response(text)
    parsed.setdefault("model", "grok-4")
    return parsed


def section_for_result(name: str, result: dict[str, Any]) -> str:
    lines = [
        f"## {name}",
        "",
        f"**Modelo:** {result.get('model', name)}",
        "",
        f"**Readiness score:** {result.get('readiness_score', 'N/A')}",
        "",
        f"**Resumen:** {result.get('summary', '')}",
        "",
        "### Cobertura de requisitos",
        "",
        "| ID | Estado | Notas |",
        "|---|---|---|",
    ]
    for item in result.get("requirement_coverage", []):
        lines.append(
            f"| {item.get('id', '')} | {item.get('status', '')} | {str(item.get('notes', '')).replace('|', '/')} |"
        )
    for key, title in [
        ("strengths", "Fortalezas"),
        ("gaps", "Brechas"),
        ("risks", "Riesgos"),
        ("top_actions", "Acciones prioritarias"),
    ]:
        lines.extend(["", f"### {title}", ""])
        values = result.get(key, []) or []
        if not values:
            lines.append("- Sin elementos reportados")
        else:
            for value in values:
                lines.append(f"- {value}")
    lines.append("")
    return "\n".join(lines)


def main() -> int:
    bundle = read_project_bundle()
    user_prompt = build_user_prompt(bundle)

    openai_key = os.environ.get("OPENAI_API_KEY", "").strip()
    if not openai_key:
        try:
            openai_key = input("OPENAI_API_KEY: ").strip()
        except EOFError:
            openai_key = ""

    gemini_key = os.environ.get("GEMINI_API_KEY", "").strip()
    grok_key = os.environ.get("XAI_API_KEY", "").strip()

    results: dict[str, Any] = {}
    errors: dict[str, str] = {}

    if openai_key:
        try:
            results["ChatGPT"] = call_openai(user_prompt, openai_key)
        except Exception as exc:  # noqa: BLE001
            errors["ChatGPT"] = str(exc)
    else:
        errors["ChatGPT"] = "No se proporcionó OPENAI_API_KEY."

    if gemini_key:
        try:
            results["Gemini"] = call_gemini(user_prompt, gemini_key)
        except Exception as exc:  # noqa: BLE001
            errors["Gemini"] = str(exc)
    else:
        errors["Gemini"] = "No se encontró GEMINI_API_KEY en el entorno."

    if grok_key:
        try:
            results["Grok"] = call_grok(user_prompt, grok_key)
        except Exception as exc:  # noqa: BLE001
            errors["Grok"] = str(exc)
    else:
        errors["Grok"] = "No se encontró XAI_API_KEY en el entorno."

    lines = [
        "# Validación multi-IA de CompliLink Operativo V1",
        "",
        "Este reporte reúne la revisión comparada de ChatGPT, Gemini y Grok sobre la implementación actual del proyecto.",
        "",
    ]

    if results:
        for name in ["ChatGPT", "Gemini", "Grok"]:
            if name in results:
                lines.append(section_for_result(name, results[name]))
    else:
        lines.append("No se obtuvo ninguna respuesta válida de los modelos externos.")
        lines.append("")

    lines.extend([
        "## Errores o incidencias",
        "",
        "| Motor | Estado |",
        "|---|---|",
    ])
    if errors:
        for name, error in errors.items():
            lines.append(f"| {name} | {str(error).replace('|', '/')} |")
    else:
        lines.append("| Ninguno | Todos los modelos respondieron correctamente |")

    REPORT_PATH.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(str(REPORT_PATH))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
