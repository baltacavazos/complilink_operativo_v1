import json
import os
import sys
from typing import Any

import requests

PROMPT = """
Contexto del producto:
- Plataforma: AuditaPatron / CompliLink Operativo
- Stack: React + Tailwind + dashboard interno + landing + flujo /auditar
- Marca: conservar la base del logo original (lupa + wordmark AuditaPatron, azul marino/turquesa), sin QR dentro de la plataforma
- Requisito nuevo: agregar modo oscuro con interruptor visible, persistencia de preferencia y excelente legibilidad en móvil y escritorio
- Superficies prioritarias: header, hero, dashboard, /auditar y versión compacta móvil
- Restricción UX: debe sentirse nativo al UI, no como imagen pegada; evitar look genérico; mantener confianza, claridad y apariencia premium pero simple

Necesito una recomendación breve y ejecutable para implementar modo oscuro e identidad visual. Devuelve JSON válido con esta forma exacta:
{
  "palette_strategy": "...",
  "logo_strategy": "...",
  "toggle_placement": "...",
  "surface_adjustments": ["...", "...", "...", "..."],
  "risks": ["...", "..."],
  "priority_order": ["...", "...", "..."],
  "micro_interactions": "..."
}
""".strip()


def extract_json(text: str) -> Any:
    text = text.strip()
    if text.startswith("```"):
        parts = text.split("```")
        for part in parts:
            candidate = part.strip()
            if candidate.startswith("json"):
                candidate = candidate[4:].strip()
            if candidate.startswith("{") and candidate.endswith("}"):
                return json.loads(candidate)
    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end != -1 and end > start:
        return json.loads(text[start:end + 1])
    raise ValueError(f"No JSON object found in response: {text[:300]}")


def call_openai() -> Any:
    api_key = os.environ["OPENAI_API_KEY"]
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
                {"role": "system", "content": "Eres un director de diseño de producto. Responde solo JSON válido."},
                {"role": "user", "content": PROMPT},
            ],
        },
        timeout=60,
    )
    response.raise_for_status()
    data = response.json()
    return extract_json(data["choices"][0]["message"]["content"])


def call_gemini() -> Any:
    api_key = os.environ["GEMINI_API_KEY"]
    models = ["gemini-2.5-flash", "gemini-2.0-flash-001", "gemini-2.0-flash-lite-001"]
    last_error = None

    for model in models:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
        try:
            response = requests.post(
                url,
                headers={"Content-Type": "application/json"},
                json={
                    "generationConfig": {
                        "temperature": 0.2,
                        "responseMimeType": "application/json",
                    },
                    "contents": [
                        {
                            "role": "user",
                            "parts": [{"text": PROMPT}],
                        }
                    ],
                },
                timeout=60,
            )
            response.raise_for_status()
            data = response.json()
            text = data["candidates"][0]["content"]["parts"][0]["text"]
            return extract_json(text)
        except Exception as exc:  # noqa: BLE001
            last_error = exc

    if last_error is not None:
        raise last_error
    raise RuntimeError("Gemini call failed without a captured error")


def call_xai() -> Any:
    api_key = os.environ["XAI_API_KEY"]
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
                {"role": "system", "content": "Eres un director de diseño de producto. Responde solo JSON válido."},
                {"role": "user", "content": PROMPT},
            ],
        },
        timeout=60,
    )
    response.raise_for_status()
    data = response.json()
    return extract_json(data["choices"][0]["message"]["content"])


def main() -> None:
    providers = {
        "chatgpt": call_openai,
        "gemini": call_gemini,
        "grok": call_xai,
    }
    result = {}
    errors = {}
    for name, fn in providers.items():
        try:
            result[name] = fn()
        except Exception as exc:  # noqa: BLE001
            errors[name] = str(exc)
    payload = {"results": result, "errors": errors}
    json.dump(payload, sys.stdout, ensure_ascii=False, indent=2)
    sys.stdout.write("\n")


if __name__ == "__main__":
    main()
