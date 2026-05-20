import json
import os
import time
from pathlib import Path

import requests

BRIEF = {
    "product": "Auditapatron",
    "audience": "trabajador de a pie en Mexico, no tecnico, con poco tiempo y posible desconfianza inicial",
    "current_state": {
        "home": {
            "headline": "Sube tu recibo y te decimos que revisar.",
            "support": [
                "Sube tu recibo o comprobante y te mostramos lo mas importante.",
                "Empieza con un solo archivo y entiende rapido si hay algo raro o pendiente.",
                "Primero ves el resultado. Si te sirve, luego decides si lo guardas."
            ],
            "cta": "Revisa tu recibo gratis",
            "microdemo": "Microvideo guiado de ~15 segundos con pasos Subir / Ver / Seguir"
        },
        "auditar": {
            "mobile_upload": "Existe copy tipo 'Elige si quieres tomar foto o subir un archivo', pero queremos que sea mas obvio, grande y confiable desde el primer toque.",
            "first_reading": "Ya hay lectura inicial y estados post-upload, pero queremos tarjetas todavia mas cortas con una sola recomendacion clara por pantalla.",
            "post_reading": "Ya existe texto corto para WhatsApp en partes internas del flujo, pero queremos una salida clara y visible inmediatamente despues de la primera lectura."
        },
        "constraints": [
            "Extrema simplicidad",
            "No usar jerga legal ni tecnica",
            "Debe sentirse confiable y facil desde celular",
            "No mencionar nombres internos del sistema",
            "WhatsApp como ayuda opcional, no invasiva"
        ]
    },
    "asks": [
        "Como debe verse la mejor UI para elegir entre camara y archivo en movil?",
        "Como convertir la lectura inicial en tarjetas mas cortas y accionables?",
        "Como introducir un boton o salida a WhatsApp despues de la primera lectura sin romper confianza ni distraer del producto?",
        "Dame recomendaciones concretas de copy, jerarquia y comportamiento UI.",
        "Prioriza impacto alto y bajo riesgo."
    ],
    "required_json_shape": {
        "verdict": "string",
        "top_priorities": ["string", "string", "string"],
        "mobile_upload_recommendation": {
            "ui_pattern": "string",
            "copy": "string",
            "risk": "string"
        },
        "first_reading_recommendation": {
            "ui_pattern": "string",
            "copy": "string",
            "risk": "string"
        },
        "whatsapp_recommendation": {
            "ui_pattern": "string",
            "copy": "string",
            "risk": "string"
        },
        "do_not_do": ["string", "string", "string"]
    }
}

PROMPT = f"""
Actua como experto en UX para consumidores masivos en Mexico. Analiza Auditapatron como si fueras un cliente comun y propone la mejor siguiente ronda de simplificacion.

Contexto:\n{json.dumps(BRIEF, ensure_ascii=False, indent=2)}

Responde SOLO JSON valido con exactamente esta forma:\n{json.dumps(BRIEF['required_json_shape'], ensure_ascii=False, indent=2)}
""".strip()


def extract_json(text: str):
    text = text.strip()
    if text.startswith("```"):
        text = text.strip("`")
        if text.lower().startswith("json"):
            text = text[4:].strip()
    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end != -1:
        text = text[start:end+1]
    return json.loads(text)


def call_openai():
    key = os.environ.get("OPENAI_API_KEY")
    if not key:
        return {"error": "OPENAI_API_KEY missing"}
    r = requests.post(
        "https://api.openai.com/v1/chat/completions",
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
        json={
            "model": "gpt-4.1-mini",
            "temperature": 0.2,
            "response_format": {"type": "json_object"},
            "messages": [
                {"role": "system", "content": "Eres un especialista en UX claro, practico y obsesionado con simplicidad extrema para usuarios no tecnicos en Mexico. Devuelves JSON valido."},
                {"role": "user", "content": PROMPT},
            ],
        },
        timeout=90,
    )
    r.raise_for_status()
    data = r.json()
    content = data["choices"][0]["message"]["content"]
    return extract_json(content)


def call_grok():
    key = os.environ.get("XAI_API_KEY")
    if not key:
        return {"error": "XAI_API_KEY missing"}
    r = requests.post(
        "https://api.x.ai/v1/chat/completions",
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
        json={
            "model": "grok-4-fast-non-reasoning",
            "temperature": 0.2,
            "response_format": {"type": "json_object"},
            "messages": [
                {"role": "system", "content": "Eres un especialista en UX claro, practico y obsesionado con simplicidad extrema para usuarios no tecnicos en Mexico. Devuelves JSON valido."},
                {"role": "user", "content": PROMPT},
            ],
        },
        timeout=90,
    )
    r.raise_for_status()
    data = r.json()
    content = data["choices"][0]["message"]["content"]
    return extract_json(content)


def call_gemini():
    key = os.environ.get("GEMINI_API_KEY")
    if not key:
        return {"error": "GEMINI_API_KEY missing"}
    models = [
        "gemini-2.5-flash",
        "gemini-2.5-flash-preview-05-20",
        "gemini-2.0-flash",
    ]
    payload = {
        "contents": [{"role": "user", "parts": [{"text": PROMPT}]}],
        "generationConfig": {
            "temperature": 0.2,
            "responseMimeType": "application/json",
        },
    }
    last_error = None
    for model in models:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={key}"
        try:
            r = requests.post(url, headers={"Content-Type": "application/json"}, json=payload, timeout=90)
            if r.status_code >= 400:
                last_error = {"status": r.status_code, "body": r.text[:500], "model": model}
                continue
            data = r.json()
            text = data["candidates"][0]["content"]["parts"][0]["text"]
            return extract_json(text)
        except Exception as exc:
            last_error = {"error": str(exc), "model": model}
            time.sleep(1)
    return {"error": "gemini_failed", "details": last_error}


results = {
    "brief": BRIEF,
    "chatgpt": call_openai(),
    "grok": call_grok(),
    "gemini": call_gemini(),
}

Path("/home/ubuntu/complilink_operativo_v1/tmp_next_steps_consensus_results.json").write_text(
    json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8"
)
print(json.dumps(results, ensure_ascii=False, indent=2))
