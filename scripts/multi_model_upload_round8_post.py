import json
import os
import re
from pathlib import Path

import requests

PROJECT_ROOT = Path("/home/ubuntu/complilink_operativo_v1")
AUDITAR_PATH = PROJECT_ROOT / "client/src/pages/Auditar.tsx"
OUTPUT_PATH = PROJECT_ROOT / "tmp_upload_round8_post_audit.json"


def extract_relevant_snippet() -> str:
    text = AUDITAR_PATH.read_text(encoding="utf-8")
    lines = text.splitlines()
    start = 0
    end = min(len(lines), 220)

    for idx, line in enumerate(lines):
        if "upload-guardrails-summary" in line:
            start = max(0, idx - 70)
            end = min(len(lines), idx + 35)
            break

    snippet = "\n".join(lines[start:end])
    return snippet[:12000]


PROMPT_TEMPLATE = """Evalúa una micro-ronda UX/UI ya implementada en la vista /auditar de una app laboral.\n\nContexto del objetivo de esta ronda:\n1. Reforzar accesibilidad del stepper de progreso para lectores de pantalla.\n2. Compactar el copy persistente de límites y privacidad en móvil.\n3. Añadir ayuda colapsable para densidad visual sin perder confianza.\n\nCambios implementados observables:\n- El stepper tiene aria-current y aria-label por etapa con posición y estado.\n- Existe un bloque compacto persistente con dos mensajes: límites de archivo y control/privacidad.\n- Existe un details/summary para desplegar el detalle completo de seguridad y carga.\n- La vista ya tenía una tarjeta de progreso por etapas con ETA y estado actual.\n\nSnippet relevante de implementación:\n```tsx\n{snippet}\n```\n\nDevuelve JSON válido con este esquema exacto:\n{{
  "model_verdict": "approve" | "approve_with_small_tweaks" | "needs_revision",
  "score_clarity": 1-10,
  "score_accessibility": 1-10,
  "score_trust": 1-10,
  "main_strength": "string",
  "main_risk": "string",
  "small_tweak": "string",
  "consensus_ready": true | false
}}\n\nPrioriza observaciones concretas, mínimas y accionables. No propongas rediseños grandes."""


def call_openai(prompt: str):
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        return {"error": "OPENAI_API_KEY missing"}

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
                {"role": "system", "content": "Eres un auditor UX/UI estricto y conciso. Responde solo JSON válido."},
                {"role": "user", "content": prompt},
            ],
        },
        timeout=90,
    )
    response.raise_for_status()
    content = response.json()["choices"][0]["message"]["content"]
    return json.loads(content)


def call_grok(prompt: str):
    api_key = os.environ.get("XAI_API_KEY")
    if not api_key:
        return {"error": "XAI_API_KEY missing"}

    response = requests.post(
        "https://api.x.ai/v1/chat/completions",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json={
            "model": "grok-3-mini-beta",
            "temperature": 0.2,
            "response_format": {"type": "json_object"},
            "messages": [
                {"role": "system", "content": "Eres un auditor UX/UI estricto y conciso. Responde solo JSON válido."},
                {"role": "user", "content": prompt},
            ],
        },
        timeout=90,
    )
    response.raise_for_status()
    content = response.json()["choices"][0]["message"]["content"]
    return json.loads(content)


def call_gemini(prompt: str):
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        return {"error": "GEMINI_API_KEY missing"}

    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}"
    response = requests.post(
        url,
        headers={"Content-Type": "application/json"},
        json={
            "generationConfig": {
                "temperature": 0.2,
                "responseMimeType": "application/json",
            },
            "contents": [{"parts": [{"text": prompt}]}],
        },
        timeout=90,
    )
    response.raise_for_status()
    data = response.json()
    content = data["candidates"][0]["content"]["parts"][0]["text"]
    return json.loads(content)


def safe_call(name: str, fn, prompt: str):
    try:
        return {"name": name, "result": fn(prompt)}
    except Exception as exc:  # noqa: BLE001
        return {"name": name, "result": {"error": f"{type(exc).__name__}: {exc}"}}


def build_consensus(results: dict) -> dict:
    valid = [item for item in results.values() if isinstance(item, dict) and not item.get("error")]
    if not valid:
        return {"status": "no_consensus", "summary": "No se obtuvo respuesta válida de los tres modelos."}

    verdicts = [item.get("model_verdict") for item in valid]
    ready_votes = sum(1 for item in valid if item.get("consensus_ready") is True)
    average_clarity = round(sum(item.get("score_clarity", 0) for item in valid) / len(valid), 2)
    average_accessibility = round(sum(item.get("score_accessibility", 0) for item in valid) / len(valid), 2)
    average_trust = round(sum(item.get("score_trust", 0) for item in valid) / len(valid), 2)

    return {
        "status": "consensus",
        "verdicts": verdicts,
        "ready_votes": ready_votes,
        "average_clarity": average_clarity,
        "average_accessibility": average_accessibility,
        "average_trust": average_trust,
        "shared_small_tweaks": [item.get("small_tweak") for item in valid if item.get("small_tweak")],
    }


def main():
    snippet = extract_relevant_snippet()
    prompt = PROMPT_TEMPLATE.format(snippet=snippet)

    raw_results = {
        "chatgpt": safe_call("chatgpt", call_openai, prompt)["result"],
        "grok": safe_call("grok", call_grok, prompt)["result"],
        "gemini": safe_call("gemini", call_gemini, prompt)["result"],
    }

    payload = {
        "snippet_preview": snippet,
        "results": raw_results,
        "consensus": build_consensus(raw_results),
    }
    OUTPUT_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(payload, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
