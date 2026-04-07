import json
import os
import sys
from datetime import datetime, timezone

import requests

REPORT_PATH = "/home/ubuntu/complilink_operativo_v1/tri_ai_simplify_launch_today.md"

SYSTEM_PROMPT = """
Eres un estratega senior de producto B2B, UX y operaciones SaaS para legal ops y HR tech en contexto corporativo mexicano.
Tu tarea es simplificar de forma radical un MVP llamado CompliLink para que pueda operar hoy mismo con la menor complejidad posible.
Debes pensar como un dueño ocupado que quiere algo intuitivo, limpio, autoexplicativo y con solo lo indispensable para operar desde hoy.
Debes responder SOLO JSON válido con esta forma exacta:
{
  "go_live_verdict": "string",
  "overall_direction": "string",
  "must_keep": ["string"],
  "remove_or_hide_now": ["string"],
  "simplified_navigation": ["string"],
  "simplified_home_sections": ["string"],
  "plain_language_labels": [
    {
      "current_concept": "string",
      "simpler_label": "string"
    }
  ],
  "services_to_contract_today": [
    {
      "service": "string",
      "plan": "string",
      "reason": "string",
      "approx_monthly_usd": "string"
    }
  ],
  "services_to_delay": [
    {
      "service": "string",
      "reason": "string"
    }
  ],
  "critical_blockers_for_today": ["string"],
  "recommended_change_plan": [
    {
      "priority": "P0|P1|P2",
      "change": "string",
      "reason": "string"
    }
  ],
  "one_sentence_positioning": "string"
}
No agregues markdown ni texto fuera del JSON.
""".strip()

USER_PROMPT = """
Evalúa CompliLink con este contexto real:

Objetivo principal:
- Que CompliLink opere hoy mismo.
- Debe requerir los servicios mínimos contratados para operar.
- Debe sentirse extremadamente intuitivo, limpio y autoexplicativo.
- Debe tener solo lo mínimo indispensable para empezar a usarlo hoy.
- NO queremos priorizar command center, Shared Engine ni integraciones futuras en esta etapa.

Estado actual del producto:
- MVP de gestión de casos laborales para contexto corporativo mexicano.
- Ya existen flujos base de expedientes, documentos, consentimientos, auditoría y control de acceso.
- Ya existe autenticación con Manus OAuth.
- Ya existe trazabilidad con tenant_id, case_id y trace_id.
- Ya existen pruebas técnicas pasando.
- El usuario percibe la experiencia actual como demasiado complicada.

Lo que sí importa hoy:
- Ver casos activos.
- Crear o abrir un caso.
- Subir documentos básicos del caso.
- Confirmar visibilidad/consentimiento cuando aplique.
- Ver una auditoría o historial básico.
- Operar con muy pocos clics y lenguaje simple.

Lo que NO debe dominar el producto hoy:
- Arquitectura compleja visible para el usuario.
- Terminología técnica innecesaria.
- Dashboards densos o tipo centro de comando.
- Módulos futuros o integraciones no críticas.
- Configuración avanzada expuesta de inicio.

Tu tarea:
1. Define qué debe quedarse y qué debe ocultarse o eliminarse del MVP visual/operativo.
2. Propón una navegación muy simple para que una persona no técnica entienda la app sola.
3. Indica qué servicios mínimos contratar hoy para operar de inmediato y cuáles deben esperar.
4. Señala cualquier bloqueo crítico real para salir hoy.
5. Devuelve un plan de cambios previo a implementación, no una reescritura total.
6. Prioriza costo mínimo hoy y escalamiento posterior.
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
            return json.loads(raw_text[start:end + 1])
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
    return parse_json_text(payload["choices"][0]["message"]["content"])


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
    return parse_json_text(payload["choices"][0]["message"]["content"])


def call_gemini(api_key: str):
    response = requests.post(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
        params={"key": api_key},
        headers={"Content-Type": "application/json"},
        json={
            "system_instruction": {"parts": [{"text": SYSTEM_PROMPT}]},
            "contents": [{"parts": [{"text": USER_PROMPT}]}],
            "generationConfig": {
                "temperature": 0.2,
                "responseMimeType": "application/json",
            },
        },
        timeout=120,
    )
    response.raise_for_status()
    payload = response.json()
    return parse_json_text(payload["candidates"][0]["content"]["parts"][0]["text"])


def safe_call(name: str, fn, api_key: str | None):
    if not api_key:
        return {"error": f"{name}: missing API key"}
    try:
        return fn(api_key)
    except Exception as exc:
        return {"error": f"{name}: {type(exc).__name__}: {exc}"}


def merge_unique_strings(values):
    seen = set()
    result = []
    for value in values:
        normalized = " ".join(str(value).split()).strip().lower()
        if not normalized or normalized in seen:
            continue
        seen.add(normalized)
        result.append(str(value).strip())
    return result


def merge_labeled_pairs(items):
    seen = set()
    result = []
    for item in items:
        if not isinstance(item, dict):
            continue
        current_concept = str(item.get("current_concept", "")).strip()
        simpler_label = str(item.get("simpler_label", "")).strip()
        key = (current_concept.lower(), simpler_label.lower())
        if not current_concept or not simpler_label or key in seen:
            continue
        seen.add(key)
        result.append({
            "current_concept": current_concept,
            "simpler_label": simpler_label,
        })
    return result


def merge_service_rows(items, keys):
    seen = set()
    result = []
    for item in items:
        if not isinstance(item, dict):
            continue
        row = {key: str(item.get(key, "")).strip() for key in keys}
        identity = tuple(row[key].lower() for key in keys)
        if not row[keys[0]] or identity in seen:
            continue
        seen.add(identity)
        result.append(row)
    return result


def build_consensus(results: dict):
    go_live_verdicts = []
    directions = []
    must_keep = []
    remove_or_hide = []
    navigation = []
    home_sections = []
    labels = []
    services_today = []
    services_delay = []
    blockers = []
    plan = []
    positioning = []

    for model_name, payload in results.items():
        if isinstance(payload, dict) and not payload.get("error"):
            verdict = str(payload.get("go_live_verdict", "")).strip()
            if verdict:
                go_live_verdicts.append(f"{model_name}: {verdict}")
            direction = str(payload.get("overall_direction", "")).strip()
            if direction:
                directions.append(f"{model_name}: {direction}")
            must_keep.extend(payload.get("must_keep", []))
            remove_or_hide.extend(payload.get("remove_or_hide_now", []))
            navigation.extend(payload.get("simplified_navigation", []))
            home_sections.extend(payload.get("simplified_home_sections", []))
            labels.extend(payload.get("plain_language_labels", []))
            services_today.extend(payload.get("services_to_contract_today", []))
            services_delay.extend(payload.get("services_to_delay", []))
            blockers.extend(payload.get("critical_blockers_for_today", []))
            plan.extend(payload.get("recommended_change_plan", []))
            sentence = str(payload.get("one_sentence_positioning", "")).strip()
            if sentence:
                positioning.append(f"{model_name}: {sentence}")

    return {
        "go_live_verdicts": merge_unique_strings(go_live_verdicts),
        "overall_directions": merge_unique_strings(directions),
        "must_keep": merge_unique_strings(must_keep)[:10],
        "remove_or_hide_now": merge_unique_strings(remove_or_hide)[:10],
        "simplified_navigation": merge_unique_strings(navigation)[:8],
        "simplified_home_sections": merge_unique_strings(home_sections)[:8],
        "plain_language_labels": merge_labeled_pairs(labels)[:10],
        "services_to_contract_today": merge_service_rows(
            services_today,
            ["service", "plan", "reason", "approx_monthly_usd"],
        )[:8],
        "services_to_delay": merge_service_rows(
            services_delay,
            ["service", "reason"],
        )[:8],
        "critical_blockers_for_today": merge_unique_strings(blockers)[:8],
        "recommended_change_plan": merge_service_rows(
            plan,
            ["priority", "change", "reason"],
        )[:12],
        "one_sentence_positioning": merge_unique_strings(positioning)[:5],
    }


def write_report(results: dict, consensus: dict):
    timestamp = datetime.now(timezone.utc).isoformat()
    lines = [
        "# Consulta comparada para simplificar CompliLink y operarlo hoy",
        "",
        f"Generado: {timestamp}",
        "",
        "## Consenso sintetizado",
        "",
        "### Veredictos de salida",
        "",
    ]

    verdicts = consensus.get("go_live_verdicts", [])
    if verdicts:
        for item in verdicts:
            lines.append(f"- {item}")
    else:
        lines.append("- Sin veredictos suficientes.")

    sections = [
        ("Dirección general", "overall_directions"),
        ("Qué debe quedarse", "must_keep"),
        ("Qué debe ocultarse o salir por ahora", "remove_or_hide_now"),
        ("Navegación simplificada", "simplified_navigation"),
        ("Secciones mínimas de la pantalla principal", "simplified_home_sections"),
        ("Bloqueos críticos para hoy", "critical_blockers_for_today"),
        ("Posicionamiento en una frase", "one_sentence_positioning"),
    ]

    for title, key in sections:
        lines.extend(["", f"### {title}", ""])
        values = consensus.get(key, [])
        if values:
            for value in values:
                lines.append(f"- {value}")
        else:
            lines.append("- Sin consenso suficiente.")

    lines.extend(["", "### Etiquetas en lenguaje simple", ""])
    label_rows = consensus.get("plain_language_labels", [])
    if label_rows:
        lines.extend([
            "| Concepto actual | Etiqueta más simple |",
            "|---|---|",
        ])
        for row in label_rows:
            lines.append(f"| {row['current_concept']} | {row['simpler_label']} |")
    else:
        lines.append("- Sin consenso suficiente.")

    lines.extend(["", "### Servicios a contratar hoy", ""])
    service_rows = consensus.get("services_to_contract_today", [])
    if service_rows:
        lines.extend([
            "| Servicio | Plan | Motivo | Costo mensual aproximado (USD) |",
            "|---|---|---|---:|",
        ])
        for row in service_rows:
            lines.append(
                f"| {row['service']} | {row['plan']} | {row['reason']} | {row['approx_monthly_usd']} |"
            )
    else:
        lines.append("- Sin consenso suficiente.")

    lines.extend(["", "### Servicios que pueden esperar", ""])
    delay_rows = consensus.get("services_to_delay", [])
    if delay_rows:
        lines.extend([
            "| Servicio | Motivo para esperar |",
            "|---|---|",
        ])
        for row in delay_rows:
            lines.append(f"| {row['service']} | {row['reason']} |")
    else:
        lines.append("- Sin consenso suficiente.")

    lines.extend(["", "### Plan de cambios recomendado antes de implementar", ""])
    plan_rows = consensus.get("recommended_change_plan", [])
    if plan_rows:
        lines.extend([
            "| Prioridad | Cambio | Motivo |",
            "|---|---|---|",
        ])
        for row in plan_rows:
            lines.append(f"| {row['priority']} | {row['change']} | {row['reason']} |")
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
