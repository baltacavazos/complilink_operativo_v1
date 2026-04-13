import json
import os
from pathlib import Path

import requests

PROJECT_ROOT = Path("/home/ubuntu/complilink_operativo_v1")
AUDITAR_PATH = PROJECT_ROOT / "client/src/pages/Auditar.tsx"
OUTPUT_PATH = PROJECT_ROOT / "tmp_upload_round9_post_audit.json"


def extract_relevant_snippet() -> str:
    text = AUDITAR_PATH.read_text(encoding="utf-8")
    lines = text.splitlines()
    start = 0
    end = min(len(lines), 260)

    for idx, line in enumerate(lines):
        if "getUploadHelpMobileHint" in line or "upload-step-announcement" in line:
            start = max(0, idx - 90)
            end = min(len(lines), idx + 80)
            break

    snippet = "\n".join(lines[start:end])
    return snippet[:14000]


PROMPT_TEMPLATE = """Evalúa una micro-ronda UX/UI ya implementada en la vista /auditar de una app laboral.

Objetivo de esta ronda:
1. Hacer más visible en móvil la ayuda persistente del bloque de upload.
2. Anunciar de forma accesible para lector de pantalla cada cambio de etapa del stepper.

Cambios implementados observables:
- Existe una pista móvil breve y siempre visible para recordar que la ayuda incluye seguridad, límites y momento de guardado.
- Existe un anuncio accesible dedicado para comunicar el cambio de etapa del progreso.
- El flujo ya contaba con stepper accesible, copy compacto y ayuda colapsable.

Snippet relevante de implementación:
```tsx
{snippet}
```

Devuelve JSON válido con este esquema exacto:
{{
  "model_verdict": "approve" | "approve_with_small_tweaks" | "needs_revision",
  "score_clarity": 1-10,
  "score_accessibility": 1-10,
  "score_trust": 1-10,
  "main_strength": "string",
  "main_risk": "string",
  "small_tweak": "string",
  "consensus_ready": true | false
}}

Prioriza observaciones concretas, mínimas y accionables. No propongas rediseños grandes."""


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


def safe_call(fn, prompt: str):
    try:
        return fn(prompt)
    except Exception as exc:  # noqa: BLE001
        return {"error": f"{type(exc).__name__}: {exc}"}


def build_consensus(results: dict) -> dict:
    valid = [item for item in results.values() if isinstance(item, dict) and not item.get("error")]
    if not valid:
        return {"status": "no_consensus", "summary": "No se obtuvo respuesta válida de los modelos."}

    return {
        "status": "consensus",
        "verdicts": [item.get("model_verdict") for item in valid],
        "ready_votes": sum(1 for item in valid if item.get("consensus_ready") is True),
        "average_clarity": round(sum(item.get("score_clarity", 0) for item in valid) / len(valid), 2),
        "average_accessibility": round(sum(item.get("score_accessibility", 0) for item in valid) / len(valid), 2),
        "average_trust": round(sum(item.get("score_trust", 0) for item in valid) / len(valid), 2),
        "shared_small_tweaks": [item.get("small_tweak") for item in valid if item.get("small_tweak")],
    }


def main():
    snippet = extract_relevant_snippet()
    prompt = PROMPT_TEMPLATE.format(snippet=snippet)
    results = {
        "chatgpt": safe_call(call_openai, prompt),
        "grok": safe_call(call_grok, prompt),
        "gemini": safe_call(call_gemini, prompt),
    }
    payload = {
        "snippet_preview": snippet,
        "results": results,
        "consensus": build_consensus(results),
    }
    OUTPUT_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(payload, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
