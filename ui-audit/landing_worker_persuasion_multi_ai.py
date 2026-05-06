import base64
import json
import os
import re
from datetime import datetime
from pathlib import Path

import requests

ROOT = Path("/home/ubuntu/complilink_operativo_v1/ui-audit")
SCREENSHOT_PATH = Path("/home/ubuntu/screenshots/3000-ifwslt4380ij879_2026-05-06_13-05-09_6786.webp")
INPUT_NOTES_PATH = ROOT / "landing_worker_persuasion_input_2026-05-06.md"
OUTPUT_PATH = ROOT / "landing_worker_persuasion_multi_ai_results_2026-05-06.json"

PROMPT = """Actúa como si fueras un trabajador común en México que entra por primera vez a esta landing. No eres abogado, no eres experto en nómina y no conoces la marca.

Quiero una evaluación brutalmente honesta sobre tres cosas:
1. Si en menos de 5 segundos entiendes para qué sirve la página.
2. Si la página te convence de probar o pagar.
3. Qué cambios concretos la volverían mucho más irresistible, en modo 'shut up and take my money', sin perder credibilidad.

Evalúa el screenshot y también este contexto textual resumido de la página:
- Badge: 'SUBE UNA FOTO O PDF Y REVISA TU PAGO'
- Headline: 'Tu recibo puede revelar señales raras.'
- Support line: 'Revísalo gratis y entiende si hay algo que revisar en tu pago, deducciones o CFDI.'
- Microdescripción: 'Revisa si tu recibo de nómina tiene errores o diferencias en tu pago.'
- Body: 'Empieza con una foto o PDF. No necesitas reunir todo.'
- CTA principal: 'Empezar auditoría gratis'
- Ejemplo visual: 'Señal encontrada: posible diferencia entre recibo y CFDI'

Responde SOLO con JSON válido usando exactamente esta estructura:
{
  "clarity_score": 0,
  "persuasion_score": 0,
  "understands_in_5_seconds": true,
  "would_try_now": true,
  "would_pay_if_it_works": true,
  "what_i_think_it_is": "",
  "main_confusions": ["", "", ""],
  "why_it_is_or_is_not_convincing": "",
  "money_blockers": ["", "", ""],
  "top_3_changes": ["", "", ""],
  "stronger_top_line": "",
  "stronger_subline": "",
  "final_verdict": ""
}

Reglas:
- Usa español de México claro y natural.
- Sé directo, comercial y concreto.
- No expliques tu proceso ni agregues texto fuera del JSON.
- Los scores van del 1 al 10.
"""


def encode_image_data_uri(path: Path) -> str:
    mime = "image/webp"
    data = base64.b64encode(path.read_bytes()).decode("utf-8")
    return f"data:{mime};base64,{data}"


def extract_json(text: str):
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\\s*", "", text)
        text = re.sub(r"\\s*```$", "", text)
    try:
        return json.loads(text)
    except Exception:
        match = re.search(r"\{.*\}", text, re.S)
        if match:
            return json.loads(match.group(0))
        raise


def call_openai(api_key: str, data_uri: str):
    url = "https://api.openai.com/v1/chat/completions"
    payload = {
        "model": "gpt-4.1-mini",
        "temperature": 0.3,
        "messages": [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": PROMPT},
                    {"type": "image_url", "image_url": {"url": data_uri}},
                ],
            }
        ],
    }
    response = requests.post(
        url,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json=payload,
        timeout=180,
    )
    response.raise_for_status()
    data = response.json()
    text = data["choices"][0]["message"]["content"]
    return {"raw": text, "parsed": extract_json(text)}


def call_xai(api_key: str, data_uri: str):
    url = "https://api.x.ai/v1/chat/completions"
    payload = {
        "model": "grok-4",
        "temperature": 0.3,
        "messages": [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": PROMPT},
                    {"type": "image_url", "image_url": {"url": data_uri}},
                ],
            }
        ],
    }
    response = requests.post(
        url,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json=payload,
        timeout=180,
    )
    response.raise_for_status()
    data = response.json()
    text = data["choices"][0]["message"]["content"]
    return {"raw": text, "parsed": extract_json(text)}


def call_gemini(api_key: str):
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}"
    image_b64 = base64.b64encode(SCREENSHOT_PATH.read_bytes()).decode("utf-8")
    payload = {
        "contents": [
            {
                "parts": [
                    {"text": PROMPT},
                    {
                        "inline_data": {
                            "mime_type": "image/webp",
                            "data": image_b64,
                        }
                    },
                ]
            }
        ],
        "generationConfig": {
            "temperature": 0.3,
            "responseMimeType": "application/json",
        },
    }
    response = requests.post(url, headers={"Content-Type": "application/json"}, json=payload, timeout=180)
    response.raise_for_status()
    data = response.json()
    text = data["candidates"][0]["content"]["parts"][0]["text"]
    return {"raw": text, "parsed": extract_json(text)}


def main():
    notes = INPUT_NOTES_PATH.read_text(encoding="utf-8") if INPUT_NOTES_PATH.exists() else ""
    data_uri = encode_image_data_uri(SCREENSHOT_PATH)

    results = {
        "generated_at": datetime.utcnow().isoformat() + "Z",
        "source_notes_path": str(INPUT_NOTES_PATH),
        "screenshot_path": str(SCREENSHOT_PATH),
        "notes_excerpt": notes[:4000],
        "models": {},
    }

    openai_key = os.environ.get("OPENAI_API_KEY")
    xai_key = os.environ.get("XAI_API_KEY")
    gemini_key = os.environ.get("GEMINI_API_KEY")

    if openai_key:
        try:
            results["models"]["openai"] = call_openai(openai_key, data_uri)
        except Exception as exc:
            results["models"]["openai"] = {"error": str(exc)}
    else:
        results["models"]["openai"] = {"error": "OPENAI_API_KEY missing"}

    if xai_key:
        try:
            results["models"]["grok"] = call_xai(xai_key, data_uri)
        except Exception as exc:
            results["models"]["grok"] = {"error": str(exc)}
    else:
        results["models"]["grok"] = {"error": "XAI_API_KEY missing"}

    if gemini_key:
        try:
            results["models"]["gemini"] = call_gemini(gemini_key)
        except Exception as exc:
            results["models"]["gemini"] = {"error": str(exc)}
    else:
        results["models"]["gemini"] = {"error": "GEMINI_API_KEY missing"}

    OUTPUT_PATH.write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")
    print(str(OUTPUT_PATH))


if __name__ == "__main__":
    main()
