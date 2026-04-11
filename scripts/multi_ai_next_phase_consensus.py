import json
import os
import re
import sys
from typing import Any, Dict

import requests

OUTPUT_PATH = "/home/ubuntu/complilink_operativo_v1/multi_ai_next_phase_consensus.json"

SYSTEM_PROMPT = (
    "Eres un arquitecto técnico senior para una aplicación web B2B/B2C de auditoría laboral. "
    "Debes responder SOLO JSON válido, sin markdown ni texto adicional."
)

USER_PROMPT = """
Contexto actual del producto:
- Proyecto web: AuditaPatron / CompliLink Operativo.
- Ya se corrigió una regresión crítica en la exportación PDF del dashboard CEO.
- La sesión CEO, la conmutación CEO ↔ vista usuario demo y los exportes manuales quedaron estables en una ronda mínima de validación.
- El usuario autorizó avanzar con TODO lo siguiente en una sola iteración.

Tres frentes aprobados:
1) Pruebas E2E del flujo crítico CEO ↔ vista usuario ↔ expediente.
2) Validación automática de exportes CSV/PDF.
3) Instrumentación de métricas de uso y embudo operativo.

Necesito una recomendación ejecutiva y técnica. Devuelve SOLO un objeto JSON con esta forma exacta:
{
  "recommended_order": ["...", "...", "..."],
  "why_this_order": "...",
  "e2e_minimum_scope": "...",
  "export_validation_minimum_scope": "...",
  "metrics_minimum_scope": "...",
  "main_risks": ["...", "...", "..."],
  "success_criteria": ["...", "...", "..."],
  "notes_for_credit_efficiency": "..."
}

Reglas:
- Prioriza estabilidad real y velocidad de implementación.
- No propongas rediseños grandes ni features fuera de alcance.
- Piensa en una iteración inmediata, no en roadmap largo.
- El orden recomendado debe ser concreto y accionable.
""".strip()


def extract_json(text: str) -> Dict[str, Any]:
    text = text.strip()
    try:
        return json.loads(text)
    except Exception:
        pass

    match = re.search(r"\{.*\}", text, flags=re.S)
    if not match:
        raise ValueError(f"No se pudo extraer JSON de la respuesta: {text[:400]}")
    return json.loads(match.group(0))


def call_openai() -> Dict[str, Any]:
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY no está disponible")

    response = requests.post(
        "https://api.openai.com/v1/chat/completions",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json={
            "model": "gpt-4.1-mini",
            "temperature": 0.2,
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": USER_PROMPT},
            ],
            "response_format": {"type": "json_object"},
        },
        timeout=90,
    )
    response.raise_for_status()
    data = response.json()
    content = data["choices"][0]["message"]["content"]
    return extract_json(content)


def call_grok() -> Dict[str, Any]:
    api_key = os.environ.get("XAI_API_KEY")
    if not api_key:
        raise RuntimeError("XAI_API_KEY no está disponible")

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
        timeout=90,
    )
    response.raise_for_status()
    data = response.json()
    content = data["choices"][0]["message"]["content"]
    return extract_json(content)


def call_gemini() -> Dict[str, Any]:
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY no está disponible")

    url = (
        "https://generativelanguage.googleapis.com/v1beta/models/"
        f"gemini-2.5-flash:generateContent?key={api_key}"
    )
    response = requests.post(
        url,
        headers={"Content-Type": "application/json"},
        json={
            "system_instruction": {
                "parts": [{"text": SYSTEM_PROMPT}]
            },
            "contents": [
                {
                    "role": "user",
                    "parts": [{"text": USER_PROMPT}],
                }
            ],
            "generationConfig": {
                "temperature": 0.2,
                "responseMimeType": "application/json",
            },
        },
        timeout=90,
    )
    response.raise_for_status()
    data = response.json()
    content = data["candidates"][0]["content"]["parts"][0]["text"]
    return extract_json(content)


def safe_call(name: str, func):
    try:
        return {"status": "ok", "response": func()}
    except Exception as exc:
        return {"status": "error", "error": f"{type(exc).__name__}: {exc}"}


def main() -> int:
    result = {
        "openai": safe_call("openai", call_openai),
        "grok": safe_call("grok", call_grok),
        "gemini": safe_call("gemini", call_gemini),
    }

    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)

    print(OUTPUT_PATH)
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
