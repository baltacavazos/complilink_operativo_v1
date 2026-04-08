from __future__ import annotations

import json
import os
import textwrap
from datetime import datetime, timezone
from pathlib import Path

import requests

PROJECT_ROOT = Path("/home/ubuntu/complilink_operativo_v1")
OUTPUT_DIR = PROJECT_ROOT / "research" / "logo_refinement"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
OUTPUT_PATH = OUTPUT_DIR / "multi_ai_logo_refinement_results.json"

PROMPT = textwrap.dedent(
    """
    Eres un director de marca y producto digital. Necesito una recomendación concreta, ejecutable y minimalista.

    Contexto del producto:
    - Marca: AuditaPatron.
    - Público: trabajadores, enfoque claro, protector, accesible y mobile-first.
    - Se incorporó un nuevo logotipo en JPG con la leyenda ya embebida: "AUDITAPATRON / CONOCE TUS DERECHOS".
    - En una primera integración, el resultado visual mostró estos problemas:
      1) En el header el logotipo quedó demasiado pequeño y se percibe como miniatura pegada.
      2) En el hero el logotipo quedó demasiado grande y se ve como una imagen insertada o copy-paste.
      3) La imagen tiene fondo blanco, así que debe integrarse con más intención en una interfaz también clara.
    - A futuro, la lupa del logotipo deberá contener un QR real que redirija a AuditaPatron, pero esa fase todavía no se activa.

    Lo que necesito decidir ahora:
    - Cómo integrar mejor la marca en el header.
    - Cómo integrar mejor la marca en el hero.
    - Qué ajustes conviene hacer al componente reusable de branding para soportar variantes limpias y consistentes.
    - Qué NO hacer para evitar que la marca se vea improvisada.

    Restricciones:
    - No rediseñar el logotipo desde cero.
    - No activar todavía el QR funcional.
    - Favorecer una solución elegante, sobria, moderna y muy integrada al layout.
    - La respuesta debe ser práctica para implementación inmediata en React + Tailwind.

    Devuelve SOLO JSON válido con esta estructura exacta:
    {
      "header_strategy": {
        "layout": "string",
        "scale": "string",
        "container_treatment": "string",
        "mobile_behavior": "string"
      },
      "hero_strategy": {
        "placement": "string",
        "scale": "string",
        "supporting_elements": "string",
        "rationale": "string"
      },
      "component_strategy": {
        "recommended_variants": ["string"],
        "props_or_api": ["string"],
        "implementation_notes": ["string"]
      },
      "avoid": ["string"],
      "priority_order": ["string"],
      "one_sentence_verdict": "string"
    }
    """
).strip()


def call_openai() -> dict:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        return {"provider": "openai", "ok": False, "error": "OPENAI_API_KEY no disponible"}

    response = requests.post(
        "https://api.openai.com/v1/chat/completions",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json={
            "model": "gpt-4.1-mini",
            "temperature": 0.3,
            "response_format": {"type": "json_object"},
            "messages": [
                {"role": "system", "content": "Responde únicamente con JSON válido."},
                {"role": "user", "content": PROMPT},
            ],
        },
        timeout=90,
    )
    response.raise_for_status()
    data = response.json()
    content = data["choices"][0]["message"]["content"]
    return {
        "provider": "openai",
        "ok": True,
        "model": data.get("model", "gpt-4.1-mini"),
        "content": json.loads(content),
    }


def call_gemini() -> dict:
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        return {"provider": "gemini", "ok": False, "error": "GEMINI_API_KEY no disponible"}

    response = requests.post(
        f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}",
        headers={"Content-Type": "application/json"},
        json={
            "generationConfig": {
                "temperature": 0.3,
                "responseMimeType": "application/json",
            },
            "contents": [
                {
                    "parts": [
                        {"text": PROMPT}
                    ]
                }
            ],
        },
        timeout=90,
    )
    response.raise_for_status()
    data = response.json()
    text = data["candidates"][0]["content"]["parts"][0]["text"]
    return {
        "provider": "gemini",
        "ok": True,
        "model": "gemini-2.5-flash",
        "content": json.loads(text),
    }


def call_grok() -> dict:
    api_key = os.getenv("XAI_API_KEY")
    if not api_key:
        return {"provider": "grok", "ok": False, "error": "XAI_API_KEY no disponible"}

    response = requests.post(
        "https://api.x.ai/v1/chat/completions",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json={
            "model": "grok-3-mini",
            "temperature": 0.3,
            "response_format": {"type": "json_object"},
            "messages": [
                {"role": "system", "content": "Responde únicamente con JSON válido."},
                {"role": "user", "content": PROMPT},
            ],
        },
        timeout=90,
    )
    response.raise_for_status()
    data = response.json()
    content = data["choices"][0]["message"]["content"]
    return {
        "provider": "grok",
        "ok": True,
        "model": data.get("model", "grok-3-mini"),
        "content": json.loads(content),
    }


def safe_call(fn):
    try:
        return fn()
    except Exception as exc:  # noqa: BLE001
        return {
            "provider": fn.__name__.replace("call_", ""),
            "ok": False,
            "error": str(exc),
        }


def main() -> None:
    results = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "task": "logo_refinement_header_hero",
        "prompt": PROMPT,
        "results": [
            safe_call(call_openai),
            safe_call(call_gemini),
            safe_call(call_grok),
        ],
    }
    OUTPUT_PATH.write_text(json.dumps(results, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(str(OUTPUT_PATH))


if __name__ == "__main__":
    main()
