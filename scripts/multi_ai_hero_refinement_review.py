import json
import os
import textwrap
from datetime import datetime, timezone
from pathlib import Path

import requests

PROJECT_ROOT = Path("/home/ubuntu/complilink_operativo_v1")
OUTPUT_DIR = PROJECT_ROOT / "research" / "ux_mobile"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
OUTPUT_PATH = OUTPUT_DIR / "hero_refinement_consensus.json"

SYSTEM_PROMPT = textwrap.dedent(
    """
    Eres una combinación de principal product designer, principal mobile UX designer, growth product strategist y frontend architect.
    Tu misión es recomendar la siguiente iteración fina del hero de AuditaPatron para que la interfaz se sienta 10/10 en claridad, confianza, facilidad de explicación y atractivo para adopción masiva.

    Debes pensar como un cliente exigente y como un diseñador obsesionado con convertir complejidad en simplicidad.
    No busques una respuesta promedio: busca una respuesta memorable, elegante, fácil de explicar en 5 a 10 segundos y realista de implementar sin rehacer la app.

    Responde SOLO JSON válido con esta forma exacta:
    {
      "veredicto_general": "texto corto",
      "consensus_score_0_to_10": 0,
      "root_problem": "texto corto",
      "hero_priority_order": ["prioridad 1", "prioridad 2", "prioridad 3"],
      "header_strategy": {
        "decision": "texto corto",
        "keep": ["elemento 1", "elemento 2"],
        "reduce": ["ajuste 1", "ajuste 2", "ajuste 3"],
        "mobile_rule": "texto corto"
      },
      "headline_strategy": {
        "decision": "texto corto",
        "keep": ["elemento 1", "elemento 2"],
        "change": ["ajuste 1", "ajuste 2", "ajuste 3"],
        "why_it_will_land_faster": "texto corto"
      },
      "right_card_strategy": {
        "decision": "texto corto",
        "keep": ["elemento 1", "elemento 2"],
        "simplify": ["ajuste 1", "ajuste 2", "ajuste 3"],
        "target_message_time_seconds": "texto corto"
      },
      "visual_balance_rules": ["regla 1", "regla 2", "regla 3", "regla 4"],
      "changes_now": ["cambio 1", "cambio 2", "cambio 3", "cambio 4", "cambio 5"],
      "changes_later": ["cambio futuro 1", "cambio futuro 2"],
      "do_not_do": ["no 1", "no 2", "no 3"],
      "confidence_0_to_100": 0
    }
    """
).strip()

USER_PROMPT = textwrap.dedent(
    """
    Contexto del producto:
    - Marca: AuditaPatron.
    - Público: trabajadores en México, incluyendo personas con baja tolerancia a interfaces complejas.
    - La interfaz debe sentirse muy clara, confiable, directa, casi autoexplicativa y preparada para futura app de iOS y Android.
    - La UI es fundamental: debe ser fácil de explicar, convincente para las masas y dar sensación de orden, ayuda y confianza inmediata.
    - Ya existe una landing clara con barra superior oscura y resto en claro.
    - Estado observado del hero actual:
      1. La barra superior todavía pesa demasiado visualmente y compite con el contenido principal.
      2. El lockup grande del logo dentro del hero compite con el titular principal en vez de reforzarlo.
      3. La tarjeta derecha todavía tiene demasiada información simultánea y puede entenderse más rápido.
      4. La dirección general gusta, así que se busca una iteración fina, no un rediseño total.
    - El usuario ya aprobó ejecutar esta nueva iteración, pero primero debes ayudar a cerrar un consenso multi-modelo.

    Qué debes decidir:
    1. Cómo hacer que el header pese menos sin perder confianza ni navegación.
    2. Cómo convertir el titular principal en el foco absoluto del hero.
    3. Cómo simplificar la tarjeta derecha para que comunique valor en menos segundos.
    4. Qué reglas visuales deben gobernar el balance entre header, hero y panel derecho.
    5. Qué cambios harías ahora mismo y cuáles dejarías para después.

    Restricciones:
    - No propongas rehacer toda la página.
    - No elimines la identidad visual aprobada.
    - No uses jerga técnica innecesaria.
    - Prioriza cambios incrementales, elegantes y rápidos de implementar.
    - Si dudas entre una solución llamativa y una solución clara, gana la clara.
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
            "temperature": 0.1,
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
    for model in ["gemini-flash-latest", "gemini-pro-latest", "gemini-2.5-flash"]:
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
            "temperature": 0.1,
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
        "goal": "Definir una iteración fina multi-modelo del hero para reducir el peso del header, maximizar el foco del titular y simplificar la tarjeta derecha.",
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
