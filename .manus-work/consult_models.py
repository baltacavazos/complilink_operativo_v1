import json
import os
from pathlib import Path

import requests

BASE_DIR = Path("/home/ubuntu/complilink_operativo_v1/.manus-work")
BASE_DIR.mkdir(parents=True, exist_ok=True)

prompt = (
    "Eres un arquitecto UX/Frontend senior. Resume en JSON conciso y accionable cómo implementar estas 3 mejoras en una página React llamada /auditar: "
    "1) distinguir visualmente en el timeline del expediente los documentos en estado borrador analizado vs confirmado y guardado, sin confundir al usuario ni mezclar documentos temporales con confirmados; "
    "2) añadir un único botón Reanalizar que aparezca cuando existe un borrador activo y reinicie el ciclo desde ese borrador sin tocar documentos ya confirmados; "
    "3) registrar métricas de conversión para medir selección de archivo, inicio de análisis, borrador analizado, reanálisis y guardado confirmado. "
    "Devuelve SOLO JSON con esta forma exacta: "
    '{"timeline_indicator":{"placement":"","visual_treatment":"","copy":"","caveat":""},"reanalyze_cta":{"label":"","placement":"","behavior":"","guardrail":""},"analytics_events":[{"name":"","when":"","required_fields":[""]}],"risks":[""]}'
)


def save(name: str, payload: object) -> None:
    (BASE_DIR / name).write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def post_json(url: str, headers: dict[str, str], body: dict) -> dict:
    response = requests.post(url, headers=headers, json=body, timeout=60)
    try:
        data = response.json()
    except Exception:
        data = {"status_code": response.status_code, "text": response.text}
    return {"status_code": response.status_code, "body": data}


openai_key = os.environ.get("OPENAI_API_KEY")
xai_key = os.environ.get("XAI_API_KEY")
gemini_key = os.environ.get("GEMINI_API_KEY")

if openai_key:
    save(
        "openai_auditar_recommendations.json",
        post_json(
            "https://api.openai.com/v1/chat/completions",
            {
                "Authorization": f"Bearer {openai_key}",
                "Content-Type": "application/json",
            },
            {
                "model": "gpt-4o-mini",
                "temperature": 0.2,
                "response_format": {"type": "json_object"},
                "messages": [
                    {"role": "system", "content": "Responde solo JSON válido."},
                    {"role": "user", "content": prompt},
                ],
            },
        ),
    )
else:
    save("openai_auditar_recommendations.json", {"error": "OPENAI_API_KEY no disponible"})

if xai_key:
    save(
        "grok_auditar_recommendations.json",
        post_json(
            "https://api.x.ai/v1/chat/completions",
            {
                "Authorization": f"Bearer {xai_key}",
                "Content-Type": "application/json",
            },
            {
                "model": "grok-4",
                "temperature": 0.2,
                "response_format": {"type": "json_object"},
                "messages": [
                    {"role": "system", "content": "Responde solo JSON válido."},
                    {"role": "user", "content": prompt},
                ],
            },
        ),
    )
else:
    save("grok_auditar_recommendations.json", {"error": "XAI_API_KEY no disponible"})

if gemini_key:
    save(
        "gemini_auditar_recommendations.json",
        post_json(
            f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={gemini_key}",
            {"Content-Type": "application/json"},
            {
                "contents": [{"parts": [{"text": prompt}]}],
                "generationConfig": {
                    "temperature": 0.2,
                    "responseMimeType": "application/json",
                },
            },
        ),
    )
else:
    save("gemini_auditar_recommendations.json", {"error": "GEMINI_API_KEY no disponible"})

print(str(BASE_DIR))
