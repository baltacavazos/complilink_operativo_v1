import json
import os
import textwrap
from datetime import datetime, timezone
from pathlib import Path

import requests

PROJECT_ROOT = Path("/home/ubuntu/complilink_operativo_v1")
OUTPUT_DIR = PROJECT_ROOT / "research" / "logo_branding"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
OUTPUT_PATH = OUTPUT_DIR / "mobile_first_branding_guidance.json"

SYSTEM_PROMPT = textwrap.dedent(
    """
    Eres un staff product designer, brand strategist y principal frontend engineer.
    Debes recomendar la mejor siguiente iteración visual para AuditaPatron.

    Responde SOLO JSON válido con esta forma exacta:
    {
      "veredicto_general": "texto corto",
      "mobile_first_priorities": ["prioridad 1", "prioridad 2", "prioridad 3"],
      "header_mobile": {
        "logo_rule": "texto corto",
        "navigation_rule": "texto corto",
        "theme_toggle_rule": "texto corto"
      },
      "hero_mobile": {
        "logo_presence": "texto corto",
        "copy_hierarchy": "texto corto",
        "cta_rule": "texto corto"
      },
      "internal_surfaces": {
        "must_align": ["superficie 1", "superficie 2", "superficie 3"],
        "empty_states_rule": "texto corto",
        "app_readiness_rule": "texto corto"
      },
      "social_metadata": {
        "og_image_strategy": "texto corto",
        "title_rule": "texto corto",
        "description_rule": "texto corto"
      },
      "do_not_do": ["no 1", "no 2", "no 3"],
      "implementation_order": ["paso 1", "paso 2", "paso 3", "paso 4"],
      "confidence_0_to_100": 0
    }
    """
).strip()

USER_PROMPT = textwrap.dedent(
    """
    Contexto del producto:
    - Marca: AuditaPatron.
    - Público: trabajadores en México.
    - Prioridad UX: mobile-first, claridad, confianza, cero fricción y sensación de producto moderno.
    - La web actual servirá más adelante como base conceptual para una app nativa de iOS y Android.
    - Ya existe modo oscuro persistente.
    - Ya existe el logotipo definitivo aprobado: wordmark azul marino AUDITAPATRON, la O final como lupa vacía azul marino y mango turquesa, con la leyenda CONOCE TUS DERECHOS para superficies amplias.

    Estado actual que debes considerar:
    - En cabecera se usa una variante compacta del wordmark.
    - En el hero se usa el logotipo completo con leyenda.
    - Se quiere mejorar presencia móvil sin romper jerarquía ni sobrecargar la interfaz.
    - También se quiere extender el branding a pantallas internas secundarias, estados vacíos y metadatos sociales.

    Qué necesito que decidas:
    1. Qué debe cambiar primero para que la interfaz esté mejor preparada para app móvil iOS/Android.
    2. Cómo debe comportarse la cabecera móvil: logo, navegación e interruptor de tema.
    3. Cómo debe sentirse el hero móvil para que la marca tenga presencia sin desplazar demasiado el contenido útil.
    4. Qué superficies internas deben alinearse sí o sí para que el sistema visual se sienta consistente.
    5. Qué conviene hacer en Open Graph/Twitter para que la identidad visual también sea consistente al compartir enlaces.

    Restricciones:
    - No propongas rehacer toda la app.
    - No elimines el modo oscuro.
    - No reintroduzcas QR en la lupa.
    - Da recomendaciones accionables, pensadas para implementación incremental esta misma ronda.
    - Responde solo en español.
    """
).strip()


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
            "temperature": 0.2,
            "response_format": {"type": "json_object"},
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": USER_PROMPT},
            ],
        },
        timeout=120,
    )
    response.raise_for_status()
    data = response.json()
    content = data["choices"][0]["message"]["content"]
    return {"available": True, "raw": content, "parsed": json.loads(content)}


def call_gemini() -> dict:
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        return {"available": False, "error": "GEMINI_API_KEY no disponible"}

    last_error = None
    for model in ["gemini-2.5-pro", "gemini-2.0-flash", "gemini-2.0-flash-001"]:
        try:
            response = requests.post(
                f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}",
                json={
                    "generationConfig": {
                        "temperature": 0.2,
                        "responseMimeType": "application/json",
                    },
                    "contents": [
                        {
                            "role": "user",
                            "parts": [{"text": SYSTEM_PROMPT + "\n\n" + USER_PROMPT}],
                        }
                    ],
                },
                timeout=120,
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
            "temperature": 0.2,
            "response_format": {"type": "json_object"},
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": USER_PROMPT},
            ],
        },
        timeout=120,
    )
    response.raise_for_status()
    data = response.json()
    content = data["choices"][0]["message"]["content"]
    return {"available": True, "raw": content, "parsed": json.loads(content)}


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
        "goal": "Definir la siguiente ronda de pulido mobile-first del branding y navegación para futura app de iOS y Android.",
    },
    "models": {
        "chatgpt": safe_call(call_openai),
        "gemini": safe_call(call_gemini),
        "grok": safe_call(call_grok),
    },
}

with OUTPUT_PATH.open("w", encoding="utf-8") as file:
    json.dump(results, file, ensure_ascii=False, indent=2)

print(str(OUTPUT_PATH))
