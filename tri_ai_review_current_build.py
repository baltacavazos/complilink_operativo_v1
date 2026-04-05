import json
import os
import sys
from datetime import datetime, timezone

import requests

REPORT_PATH = "/home/ubuntu/complilink_operativo_v1/tri_ai_review_current_build.md"

SYSTEM_PROMPT = """
Eres un arquitecto senior de software B2B para cumplimiento, legal ops y HR tech en contexto corporativo mexicano.
Evalúa una plataforma MVP de gestión de casos laborales multi-tenant con enfoque en trazabilidad, seguridad operativa y escalabilidad austera.
Debes responder SOLO JSON válido con esta forma exacta:
{
  "verdict": "string",
  "strengths": ["string", "string"],
  "must_fix_before_pilot": ["string", "string"],
  "can_wait": ["string", "string"],
  "risks": ["string", "string"],
  "recommended_next_step": "string"
}
No agregues markdown ni texto fuera del JSON.
""".strip()

USER_PROMPT = """
Revisa esta build actual de CompliLink Operativo V1.

Contexto del producto:
- Plataforma de gestión de casos laborales para contexto corporativo mexicano.
- Multi-tenant con control de acceso por tenant y por caso.
- Metadata canónica obligatoria: tenant_id, case_id, trace_id.
- Intake documental con storage, hash SHA-256, clasificación básica de documentos laborales mexicanos y políticas de visibilidad.
- Dashboard ejecutivo con KPIs de casos, documentos, alertas y consentimientos.
- Base canónica preparada para futura integración con Shared Engine.

Lo ya implementado en esta build:
- Manus OAuth y backend protegido.
- Bootstrap de workspace, tenants y snapshot operativo.
- Creación/listado/detalle de casos laborales.
- Actualización de workflow del caso.
- Upload documental con SHA-256, clasificación preliminar y registro auditable.
- Consentimientos, políticas documentales y bitácora de auditoría.
- Interfaz responsive tipo centro de control corporativo.
- Pruebas Vitest actuales: 14/14 pasando.

Tu tarea:
1. Evalúa si esta build es apta para un primer piloto interno controlado.
2. Señala lo imprescindible por corregir antes de un piloto serio.
3. Diferencia claramente lo que puede esperar.
4. Prioriza costo mínimo hoy, escalamiento posterior y gobernanza robusta.
5. No propongas reescrituras grandes; prioriza ajustes tácticos de alto impacto.
""".strip()


def parse_json_text(raw_text: str):
    raw_text = raw_text.strip()
    if raw_text.startswith("```"):
        raw_text = raw_text.strip("`")
        raw_text = raw_text.replace("json\n", "", 1).strip()
    try:
        return json.loads(raw_text)
    except json.JSONDecodeError:
        start = raw_text.find("{")
        end = raw_text.rfind("}")
        if start != -1 and end != -1 and end > start:
            return json.loads(raw_text[start : end + 1])
        raise


def call_openai(api_key: str):
    response = requests.post(
        "https://api.openai.com/v1/chat/completions",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json={
            "model": "gpt-4o-mini",
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
    return parse_json_text(content)


def call_grok(api_key: str):
    response = requests.post(
        "https://api.x.ai/v1/chat/completions",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json={
            "model": "grok-3-mini",
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
    return parse_json_text(content)


def call_gemini(api_key: str):
    response = requests.post(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
        params={"key": api_key},
        headers={"Content-Type": "application/json"},
        json={
            "system_instruction": {
                "parts": [{"text": SYSTEM_PROMPT}]
            },
            "contents": [
                {
                    "parts": [
                        {"text": USER_PROMPT}
                    ]
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
    payload = response.json()
    content = payload["candidates"][0]["content"]["parts"][0]["text"]
    return parse_json_text(content)


def safe_call(name: str, fn, api_key: str | None):
    if not api_key:
        return {"error": f"{name}: missing API key"}
    try:
        return fn(api_key)
    except Exception as exc:
        return {"error": f"{name}: {type(exc).__name__}: {exc}"}


def build_consensus(results: dict):
    strengths = []
    must_fix = []
    can_wait = []
    risks = []
    verdicts = []
    next_steps = []

    for model_name, payload in results.items():
        if isinstance(payload, dict) and not payload.get("error"):
            verdicts.append(f"{model_name}: {payload.get('verdict', 'Sin veredicto')}")
            strengths.extend(payload.get("strengths", []))
            must_fix.extend(payload.get("must_fix_before_pilot", []))
            can_wait.extend(payload.get("can_wait", []))
            risks.extend(payload.get("risks", []))
            next_steps.append(f"{model_name}: {payload.get('recommended_next_step', 'Sin siguiente paso')}" )

    def unique(items):
        seen = set()
        ordered = []
        for item in items:
            normalized = " ".join(str(item).split()).strip().lower()
            if not normalized or normalized in seen:
                continue
            seen.add(normalized)
            ordered.append(str(item).strip())
        return ordered

    return {
        "verdicts": unique(verdicts),
        "shared_strengths": unique(strengths)[:8],
        "shared_must_fix": unique(must_fix)[:8],
        "shared_can_wait": unique(can_wait)[:8],
        "shared_risks": unique(risks)[:8],
        "recommended_next_steps": unique(next_steps)[:5],
    }


def write_report(results: dict, consensus: dict):
    timestamp = datetime.now(timezone.utc).isoformat()
    lines = [
        "# Validación multi-IA de la build actual de CompliLink",
        "",
        f"Generado: {timestamp}",
        "",
        "## Consenso sintetizado",
        "",
        "### Veredictos",
        "",
    ]

    for item in consensus["verdicts"]:
        lines.append(f"- {item}")

    sections = [
        ("Fortalezas compartidas", "shared_strengths"),
        ("Must-fix antes del piloto", "shared_must_fix"),
        ("Puede esperar", "shared_can_wait"),
        ("Riesgos señalados", "shared_risks"),
        ("Siguientes pasos recomendados", "recommended_next_steps"),
    ]

    for title, key in sections:
        lines.extend(["", f"### {title}", ""])
        values = consensus.get(key, [])
        if values:
            for value in values:
                lines.append(f"- {value}")
        else:
            lines.append("- Sin consenso suficiente.")

    lines.extend(["", "## Respuestas completas por modelo", ""])
    for model_name, payload in results.items():
        lines.extend([
            f"### {model_name}",
            "",
            "```json",
            json.dumps(payload, ensure_ascii=False, indent=2),
            "```",
            "",
        ])

    with open(REPORT_PATH, "w", encoding="utf-8") as file_obj:
        file_obj.write("\n".join(lines) + "\n")


def main():
    openai_key = os.environ.get("OPENAI_API_KEY")
    if not openai_key:
        if sys.stdin.isatty():
            print("Pega la API key de OpenAI y presiona Enter:", flush=True)
        openai_key = sys.stdin.readline().strip()

    results = {
        "ChatGPT": safe_call("ChatGPT", call_openai, openai_key),
        "Grok": safe_call("Grok", call_grok, os.environ.get("XAI_API_KEY")),
        "Gemini": safe_call("Gemini", call_gemini, os.environ.get("GEMINI_API_KEY")),
    }
    consensus = build_consensus(results)
    write_report(results, consensus)
    print(json.dumps({"report_path": REPORT_PATH, "consensus": consensus}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
