#!/usr/bin/env python3
import json
import os
import sys
from typing import Any

import requests

OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY")
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")
XAI_API_KEY = os.environ.get("XAI_API_KEY")

PROMPT = """
Eres un advisor de product launch para una web app llamada AuditaPatron.

Contexto actual del producto:
- Existe una landing pública funcional y una Consola CEO.
- El proyecto tiene servidor corriendo, TypeScript sin errores y dependencias OK.
- Ya se implementó para el bloque bridge del dashboard CEO:
  - agenda automática diaria/semanal,
  - presets reutilizables de filtros/exportación/correo,
  - worker de ejecución al arrancar servidor,
  - prueba Vitest focalizada aprobada.
- Se quiere decidir si ya conviene publicar la primera versión, con disciplina de alcance.

Necesito una respuesta estrictamente en JSON con esta forma exacta:
{
  "publish_now": true,
  "blocking_checks": ["...", "..."],
  "show_in_v1": ["...", "..."],
  "postpone_after_launch": ["...", "..."],
  "rationale": "...",
  "confidence": "high|medium|low"
}

Criterios:
- Favorece una V1 realista y no inflada.
- Máximo 5 items por lista.
- blocking_checks solo debe incluir revisiones realmente necesarias antes de publicar.
- postpone_after_launch debe incluir mejoras valiosas pero no críticas.
- Responde solo JSON, sin markdown.
""".strip()


def extract_json(text: str) -> Any:
    text = text.strip()
    if text.startswith("```"):
        parts = text.split("```")
        for part in parts:
            part = part.strip()
            if part.startswith("json"):
                part = part[4:].strip()
            if part.startswith("{") and part.endswith("}"):
                return json.loads(part)
    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end != -1 and end > start:
        return json.loads(text[start : end + 1])
    return json.loads(text)


def call_openai() -> Any:
    if not OPENAI_API_KEY:
        return {"error": "OPENAI_API_KEY missing"}
    response = requests.post(
        "https://api.openai.com/v1/chat/completions",
        headers={
            "Authorization": f"Bearer {OPENAI_API_KEY}",
            "Content-Type": "application/json",
        },
        json={
            "model": "gpt-4.1-mini",
            "temperature": 0.2,
            "response_format": {"type": "json_object"},
            "messages": [
                {"role": "system", "content": "Responde exclusivamente JSON válido."},
                {"role": "user", "content": PROMPT},
            ],
        },
        timeout=60,
    )
    response.raise_for_status()
    data = response.json()
    return extract_json(data["choices"][0]["message"]["content"])


def call_gemini() -> Any:
    if not GEMINI_API_KEY:
        return {"error": "GEMINI_API_KEY missing"}
    url = (
        "https://generativelanguage.googleapis.com/v1beta/models/"
        "gemini-2.5-flash:generateContent?key=" + GEMINI_API_KEY
    )
    payload = {
        "contents": [{"parts": [{"text": PROMPT}]}],
        "generationConfig": {
            "temperature": 0.2,
            "responseMimeType": "application/json",
        },
    }
    response = requests.post(url, json=payload, timeout=60)
    response.raise_for_status()
    data = response.json()
    text = data["candidates"][0]["content"]["parts"][0]["text"]
    return extract_json(text)


def call_xai() -> Any:
    if not XAI_API_KEY:
        return {"error": "XAI_API_KEY missing"}
    response = requests.post(
        "https://api.x.ai/v1/chat/completions",
        headers={
            "Authorization": f"Bearer {XAI_API_KEY}",
            "Content-Type": "application/json",
        },
        json={
            "model": "grok-3-mini",
            "temperature": 0.2,
            "response_format": {"type": "json_object"},
            "messages": [
                {"role": "system", "content": "Responde exclusivamente JSON válido."},
                {"role": "user", "content": PROMPT},
            ],
        },
        timeout=60,
    )
    response.raise_for_status()
    data = response.json()
    return extract_json(data["choices"][0]["message"]["content"])


def safe_call(name: str, fn):
    try:
        return fn()
    except Exception as exc:  # noqa: BLE001
        return {"error": f"{type(exc).__name__}: {exc}"}


def main() -> int:
    result = {
        "openai": safe_call("openai", call_openai),
        "gemini": safe_call("gemini", call_gemini),
        "xai": safe_call("xai", call_xai),
    }
    json.dump(result, sys.stdout, ensure_ascii=False, indent=2)
    sys.stdout.write("\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
