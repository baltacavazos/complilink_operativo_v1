import base64
import json
import mimetypes
import os
import textwrap
from datetime import datetime, timezone
from pathlib import Path

import requests

PROJECT_ROOT = Path("/home/ubuntu/complilink_operativo_v1")
OUTPUT_DIR = PROJECT_ROOT / "research" / "ux_mobile"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
OUTPUT_PATH = OUTPUT_DIR / "auditar_mobile_alignment_review.json"
IMAGE_PATH = Path(
    os.environ.get(
        "AUDITAR_ALIGNMENT_IMAGE_PATH",
        "/home/ubuntu/upload/Clipboard_0_80C40A8A.jpeg",
    )
)
SCREEN_LABEL = os.environ.get(
    "AUDITAR_ALIGNMENT_SCREEN_LABEL",
    "auditar mobile screenshot shared by user",
)

SYSTEM_PROMPT = textwrap.dedent(
    """
    Eres una combinación de principal mobile product designer, UX auditor, frontend design engineer y experto en interfaces orientadas a confianza.

    Tu misión es detectar TODO lo que no encaja visualmente en una pantalla móvil real de AuditaPatron, con especial atención a:
    - botones descuadrados o con ancho/márgenes mal resueltos,
    - jerarquía visual inconsistente,
    - bloques redundantes o repetidos,
    - espaciado vertical extraño,
    - tarjetas que compiten entre sí,
    - problemas de alineación o ritmo visual,
    - elementos que rompen la sensación de interfaz limpia, centrada y confiable.

    Debes responder SOLO JSON válido con esta forma exacta:
    {
      "score_0_to_10": 0,
      "general_verdict": "texto corto",
      "primary_visual_problem": "texto corto",
      "detected_issues": [
        {
          "area": "texto corto",
          "severity": "high | medium | low",
          "problem": "texto corto",
          "why_it_feels_off": "texto corto",
          "recommended_fix": "texto corto"
        }
      ],
      "what_to_keep": ["texto 1", "texto 2"],
      "single_best_iteration": {
        "summary": "texto corto",
        "changes": ["cambio 1", "cambio 2", "cambio 3", "cambio 4", "cambio 5"]
      },
      "button_assessment": {
        "top_button": "texto corto",
        "lower_button": "texto corto",
        "relationship_between_them": "texto corto"
      },
      "mobile_balance_rule": "texto corto",
      "confidence_0_to_100": 0
    }
    """
).strip()

USER_PROMPT = textwrap.dedent(
    """
    Contexto:
    - Producto: AuditaPatron.
    - País: México.
    - Público: trabajadores que necesitan una interfaz extremadamente clara, confiable y fácil de entender en celular.
    - El usuario reporta específicamente que el botón oscuro/azul se ve descuadrado en móvil.
    - No queremos una lista superficial: queremos detectar todo lo que visualmente no encaja en la pantalla.
    - La meta no es rehacer toda la app, sino definir una sola ronda de correcciones bien elegidas.
    - Prioriza claridad, balance, alineación, jerarquía y sensación de producto pulido.
    - Responde en español.
    """
).strip()


def image_part_for_openai(data_url: str):
    return {"type": "image_url", "image_url": {"url": data_url, "detail": "high"}}


def encode_image(path: Path) -> tuple[str, str]:
    mime_type = mimetypes.guess_type(path.name)[0] or "image/jpeg"
    data = base64.b64encode(path.read_bytes()).decode("utf-8")
    return mime_type, f"data:{mime_type};base64,{data}"


MIME_TYPE, DATA_URL = encode_image(IMAGE_PATH)


def call_openai() -> dict:
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        return {"available": False, "error": "OPENAI_API_KEY no disponible"}

    response = requests.post(
        "https://api.openai.com/v1/chat/completions",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json={
            "model": "gpt-4.1-mini",
            "temperature": 0.1,
            "response_format": {"type": "json_object"},
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": USER_PROMPT},
                        image_part_for_openai(DATA_URL),
                    ],
                },
            ],
        },
        timeout=180,
    )
    response.raise_for_status()
    data = response.json()
    content = data["choices"][0]["message"]["content"]
    return {"available": True, "raw": content, "parsed": json.loads(content)}



def call_grok() -> dict:
    api_key = os.environ.get("XAI_API_KEY")
    if not api_key:
        return {"available": False, "error": "XAI_API_KEY no disponible"}

    response = requests.post(
        "https://api.x.ai/v1/chat/completions",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json={
            "model": "grok-4-fast-non-reasoning",
            "temperature": 0.1,
            "response_format": {"type": "json_object"},
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": USER_PROMPT},
                        {"type": "image_url", "image_url": {"url": DATA_URL}},
                    ],
                },
            ],
        },
        timeout=180,
    )
    response.raise_for_status()
    data = response.json()
    content = data["choices"][0]["message"]["content"]
    return {"available": True, "raw": content, "parsed": json.loads(content)}



def call_gemini() -> dict:
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        return {"available": False, "error": "GEMINI_API_KEY no disponible"}

    image_b64 = DATA_URL.split(",", 1)[1]
    last_error = None
    for model in ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-2.0-flash-001"]:
        try:
            response = requests.post(
                f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}",
                json={
                    "generationConfig": {
                        "temperature": 0.1,
                        "responseMimeType": "application/json",
                    },
                    "contents": [
                        {
                            "role": "user",
                            "parts": [
                                {"text": SYSTEM_PROMPT + "\n\n" + USER_PROMPT},
                                {
                                    "inline_data": {
                                        "mime_type": MIME_TYPE,
                                        "data": image_b64,
                                    }
                                },
                            ],
                        }
                    ],
                },
                timeout=180,
            )
            response.raise_for_status()
            data = response.json()
            content = data["candidates"][0]["content"]["parts"][0]["text"]
            return {
                "available": True,
                "model": model,
                "raw": content,
                "parsed": json.loads(content),
            }
        except Exception as exc:  # noqa: BLE001
            last_error = f"{type(exc).__name__}: {exc}"

    return {"available": False, "error": last_error or "Gemini sin respuesta"}



def safe_call(fn):
    try:
        return fn()
    except Exception as exc:  # noqa: BLE001
        return {"available": False, "error": f"{type(exc).__name__}: {exc}"}


results = {
    "generated_at": datetime.now(timezone.utc).isoformat(),
    "context": {
        "project_name": "complilink_operativo_v1",
        "brand": "AuditaPatron",
        "screen": SCREEN_LABEL,
        "goal": "Detectar visualmente todo lo que no encaja en la pantalla móvil antes de una ronda unificada de corrección.",
        "image_path": str(IMAGE_PATH),
    },
    "models": {
        "chatgpt": safe_call(call_openai),
        "grok": safe_call(call_grok),
        "gemini": safe_call(call_gemini),
    },
}

with OUTPUT_PATH.open("w", encoding="utf-8") as file:
    json.dump(results, file, ensure_ascii=False, indent=2)

print(str(OUTPUT_PATH))
