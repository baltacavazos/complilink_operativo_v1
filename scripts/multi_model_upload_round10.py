import json
import os
from pathlib import Path

import requests

PROJECT_ROOT = Path("/home/ubuntu/complilink_operativo_v1")
AUDITAR_PATH = PROJECT_ROOT / "client/src/pages/Auditar.tsx"
OUTPUT_PATH = PROJECT_ROOT / "tmp_upload_round10_audit.json"

ANCHORS = (
    "UPLOAD_HELP_MOBILE_HINT",
    "getUploadStepAnnouncement",
    "trackFunnelStep(\"document_draft_confirmed\"",
    "trackFunnelStep(\"document_uploaded\"",
    "aria-live=\"polite\"",
)


def extract_relevant_snippet() -> str:
    text = AUDITAR_PATH.read_text(encoding="utf-8")
    lines = text.splitlines()
    start = 0
    end = min(len(lines), 700)

    for idx, line in enumerate(lines):
        if any(anchor in line for anchor in ANCHORS):
            start = max(0, idx - 180)
            end = min(len(lines), idx + 260)
            break

    snippet = "\n".join(lines[start:end])
    return snippet[:22000]


PROMPT_TEMPLATE = """Eres un auditor UX/UI y producto para una app laboral mexicana en la vista /auditar.

Contexto breve:
- La micro-ronda anterior ya hizo más visible en móvil la ayuda persistente del upload.
- También añadió un anuncio accesible para cada cambio de etapa del stepper.
- Ahora se quiere ejecutar la siguiente ronda en el orden más sensato posible.

Objetivos candidatos de esta nueva ronda:
1. Afinar el anuncio accesible del stepper para que suene más natural y contextual en lector de pantalla.
2. Probar y pulir el bloque principal de upload en pantallas móviles pequeñas, evitando densidad o scroll lateral.
3. Consolidar la medición del impacto en conversión móvil, especialmente confirmación y guardado.

Fragmento relevante de implementación actual:
```tsx
{snippet}
```

Devuelve JSON válido con este esquema exacto:
{{
  "recommended_order": ["stepper_accessibility", "small_mobile_polish", "conversion_measurement"],
  "why_this_order": "string",
  "top_priority_now": "stepper_accessibility" | "small_mobile_polish" | "conversion_measurement",
  "stepper_accessibility_tweak": "string",
  "small_mobile_polish_tweak": "string",
  "conversion_measurement_tweak": "string",
  "biggest_risk_if_skipped": "string",
  "confidence": 1-10,
  "consensus_ready": true | false
}}

Reglas:
- Prioriza cambios pequeños y de alto impacto.
- No propongas rediseños grandes.
- Si ya existe parte de la medición, enfócate en la brecha mínima para interpretar mejor confirmación y guardado móvil.
- Piensa para usuarios en México: lenguaje claro, simple y confiable.
"""


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
                {"role": "system", "content": "Eres un auditor UX/UI y de producto. Responde solo JSON válido."},
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
                {"role": "system", "content": "Eres un auditor UX/UI y de producto. Responde solo JSON válido."},
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

    model_candidates = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"]
    last_error = None

    for model_name in model_candidates:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={api_key}"
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
        if response.ok:
            data = response.json()
            content = data["candidates"][0]["content"]["parts"][0]["text"]
            parsed = json.loads(content)
            parsed["_gemini_model"] = model_name
            return parsed
        last_error = f"{response.status_code} {response.text[:300]}"

    raise RuntimeError(f"Gemini failed across fallback models: {last_error}")


def safe_call(fn, prompt: str):
    try:
        return fn(prompt)
    except Exception as exc:  # noqa: BLE001
        return {"error": f"{type(exc).__name__}: {exc}"}


def build_consensus(results: dict) -> dict:
    valid = [item for item in results.values() if isinstance(item, dict) and not item.get("error")]
    if not valid:
        return {"status": "no_consensus", "summary": "No se obtuvo respuesta válida de los modelos."}

    order_votes = [tuple(item.get("recommended_order", [])) for item in valid if item.get("recommended_order")]
    unique_orders = {}
    for order in order_votes:
        unique_orders[order] = unique_orders.get(order, 0) + 1

    top_order = max(unique_orders, key=unique_orders.get) if unique_orders else ()

    return {
        "status": "consensus",
        "top_order": list(top_order),
        "top_order_votes": unique_orders.get(top_order, 0) if top_order else 0,
        "top_priority_votes": [item.get("top_priority_now") for item in valid],
        "average_confidence": round(sum(item.get("confidence", 0) for item in valid) / len(valid), 2),
        "ready_votes": sum(1 for item in valid if item.get("consensus_ready") is True),
        "stepper_tweaks": [item.get("stepper_accessibility_tweak") for item in valid if item.get("stepper_accessibility_tweak")],
        "mobile_tweaks": [item.get("small_mobile_polish_tweak") for item in valid if item.get("small_mobile_polish_tweak")],
        "measurement_tweaks": [item.get("conversion_measurement_tweak") for item in valid if item.get("conversion_measurement_tweak")],
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
