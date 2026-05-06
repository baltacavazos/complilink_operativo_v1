from __future__ import annotations

import base64
import json
import mimetypes
import os
from pathlib import Path
from typing import Any

import requests

SCREENSHOT_PATH = Path("/home/ubuntu/screenshots/3000-ifwslt4380ij879_2026-05-06_00-12-05_6093.webp")
OUTPUT_PATH = Path("/home/ubuntu/complilink_operativo_v1/ui-audit/landing_clarity_multi_ai_results_2026-05-06.json")
SCREENSHOT_CDN_URL = "https://files.manuscdn.com/user_upload_by_module/session_file/310519663473809458/VKMrchzdLZuAgwEk.webp"

PROMPT = """Actúa como una persona trabajadora mexicana común, sin experiencia legal ni técnica, que entra por primera vez a esta landing. Evalúa si en 3 a 5 segundos queda claro para qué sirve el producto.

Contexto del primer pantallazo:
- Eyebrow: \"Sube una foto o PDF y revisa tu pago\"
- Headline: \"Tu recibo puede revelar señales raras.\"
- Support line: \"Revísalo gratis y entiende si hay algo que revisar en tu pago, deducciones o CFDI.\"
- Extra line: \"Empieza con una foto o PDF. No necesitas reunir todo.\"
- CTA principal: \"Empezar auditoría gratis\"
- Panel derecho: \"Señal encontrada: posible diferencia entre recibo y CFDI\"

Responde con JSON estricto usando esta forma:
{
  \"clarity_score\": 0,
  \"understands_purpose_quickly\": false,
  \"current_clarity_verdict\": \"\",
  \"microdescription_needed\": false,
  \"why\": \"\",
  \"confusing_terms\": [],
  \"best_action\": \"keep_as_is\" o \"add_microdescription\",
  \"proposed_microdescription\": \"máximo 18 palabras, o cadena vacía si no hace falta\",
  \"confidence\": \"high\" o \"medium\" o \"low\"
}

Criterio importante: no pienses como marketer ni como abogado; piensa como usuario común. Si el problema es solo de precisión fina pero ya se entiende la función principal, dilo. Si recomendarías una microdescripción, que sea muy corta y muy clara."""


def load_image_data() -> tuple[str, str]:
    mime_type = mimetypes.guess_type(SCREENSHOT_PATH.name)[0] or "image/webp"
    data = base64.b64encode(SCREENSHOT_PATH.read_bytes()).decode("utf-8")
    return mime_type, data


def extract_json_from_text(text: str) -> Any:
    text = text.strip()
    if not text:
        raise ValueError("Empty response text")

    try:
        return json.loads(text)
    except json.JSONDecodeError:
        start = text.find("{")
        end = text.rfind("}")
        if start != -1 and end != -1 and end > start:
            return json.loads(text[start : end + 1])
        raise


def call_openai(image_url: str) -> dict[str, Any]:
    api_key = os.environ["OPENAI_API_KEY"]
    payload = {
        "model": "gpt-4.1-mini",
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": "Responde únicamente JSON válido."},
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": PROMPT},
                    {"type": "image_url", "image_url": {"url": image_url}},
                ],
            },
        ],
        "temperature": 0.2,
    }
    response = requests.post(
        "https://api.openai.com/v1/chat/completions",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json=payload,
        timeout=90,
    )
    response.raise_for_status()
    data = response.json()
    content = data["choices"][0]["message"]["content"]
    return extract_json_from_text(content)


def call_xai(image_url: str) -> dict[str, Any]:
    api_key = os.environ["XAI_API_KEY"]
    payload = {
        "model": "grok-4",
        "messages": [
            {"role": "system", "content": "Devuelve solo JSON válido, sin markdown."},
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": PROMPT},
                    {"type": "image_url", "image_url": {"url": image_url}},
                ],
            },
        ],
        "temperature": 0.2,
    }
    response = requests.post(
        "https://api.x.ai/v1/chat/completions",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json=payload,
        timeout=90,
    )
    response.raise_for_status()
    data = response.json()
    content = data["choices"][0]["message"]["content"]
    return extract_json_from_text(content)


def call_gemini(mime_type: str, image_b64: str) -> dict[str, Any]:
    api_key = os.environ["GEMINI_API_KEY"]
    payload = {
        "contents": [
            {
                "parts": [
                    {"text": PROMPT},
                    {"inline_data": {"mime_type": mime_type, "data": image_b64}},
                ]
            }
        ],
        "generationConfig": {
            "temperature": 0.2,
            "responseMimeType": "application/json",
        },
    }
    response = requests.post(
        f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}",
        headers={"Content-Type": "application/json"},
        json=payload,
        timeout=90,
    )
    response.raise_for_status()
    data = response.json()
    text = data["candidates"][0]["content"]["parts"][0]["text"]
    return extract_json_from_text(text)


def main() -> None:
    mime_type, image_b64 = load_image_data()
    results: dict[str, Any] = {
        "inputs": {
            "screenshot_path": str(SCREENSHOT_PATH),
            "screenshot_cdn_url": SCREENSHOT_CDN_URL,
        },
        "models": {},
    }

    for model_name, fn in (
        ("openai", lambda: call_openai(SCREENSHOT_CDN_URL)),
        ("grok", lambda: call_xai(SCREENSHOT_CDN_URL)),
        ("gemini", lambda: call_gemini(mime_type, image_b64)),
    ):
        try:
            results["models"][model_name] = {
                "status": "ok",
                "response": fn(),
            }
        except Exception as exc:  # noqa: BLE001
            results["models"][model_name] = {
                "status": "error",
                "error": f"{type(exc).__name__}: {exc}",
            }

    OUTPUT_PATH.write_text(json.dumps(results, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(str(OUTPUT_PATH))


if __name__ == "__main__":
    main()
