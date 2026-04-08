import json
import os
import textwrap
from datetime import datetime, timezone
from pathlib import Path

import requests

PROJECT_ROOT = Path("/home/ubuntu/complilink_operativo_v1")
OUTPUT_DIR = PROJECT_ROOT / "research" / "ux_mobile"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
OUTPUT_PATH = OUTPUT_DIR / "mobile_scroll_menu_consensus.json"

SYSTEM_PROMPT = textwrap.dedent(
    """
    Eres una combinación de principal product designer, principal mobile UX designer, growth product strategist y frontend architect.
    Tu misión es recomendar la siguiente iteración de AuditaPatron para que la interfaz se sienta 10/10 en claridad, confianza, facilidad de explicación y atractivo para adopción masiva.

    Debes pensar como un cliente exigente y como un diseñador obsesionado con convertir complejidad en simplicidad.
    No busques una respuesta promedio: busca una respuesta memorable, elegante, fácil de explicar en 10 segundos y realista de implementar sin rehacer toda la app.

    Responde SOLO JSON válido con esta forma exacta:
    {
      "veredicto_general": "texto corto",
      "consensus_score_0_to_10": 0,
      "mass_adoption_principle": "texto corto",
      "root_causes": ["causa 1", "causa 2", "causa 3"],
      "mobile_scroll_strategy": {
        "keep": ["elemento 1", "elemento 2"],
        "compress": ["accion 1", "accion 2", "accion 3"],
        "reorder": ["cambio 1", "cambio 2", "cambio 3"],
        "target_reduction": "texto corto"
      },
      "menu_separation_strategy": {
        "best_pattern": "texto corto",
        "background_change": "si o no y por que en una sola frase",
        "section_distinction": ["recurso 1", "recurso 2", "recurso 3"],
        "menu_mobile_rule": "texto corto",
        "active_state": "texto corto"
      },
      "top_bar_theme_strategy": {
        "recommended": "texto corto",
        "why": "texto corto",
        "implementation_rule": "texto corto"
      },
      "most_compelling_direction": {
        "headline_quality": "texto corto",
        "ux_feeling": "texto corto",
        "why_users_will_get_it_fast": "texto corto"
      },
      "recommended_solution": {
        "summary": "texto corto",
        "changes_now": ["cambio 1", "cambio 2", "cambio 3", "cambio 4", "cambio 5"],
        "changes_later": ["cambio futuro 1", "cambio futuro 2"]
      },
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
    - El usuario siente que en móvil la landing todavía es larga, con demasiado scroll.
    - También siente que no se percibe suficiente separación entre las áreas del menú.
    - El usuario sugirió quizá cambiar todo el fondo cuando cambie el menú o la sección, pero quiere la solución más compelling, no la más llamativa sin criterio.
    - El modo oscuro actual no gustó; ahora solo debe aplicarse a la barra superior horizontal, mientras el resto de la interfaz vuelve a un tema claro coherente.
    - Ya existe aprobación para ejecutar, pero antes debes ayudar a cerrar una dirección de diseño 10/10 entre varios modelos.

    Qué debes decidir:
    1. Qué está causando la sensación de demasiado scroll en móvil.
    2. Qué cambios concretos reducirían esa percepción sin rehacer toda la página.
    3. Si conviene o no cambiar el fondo completo al cambiar de menú o sección.
    4. Cómo separar mejor visualmente las áreas del menú y la navegación móvil.
    5. Cómo tratar la barra superior para que sea el único lugar con tratamiento oscuro sin verse extraño.
    6. Qué dirección se siente más convincente para adopción masiva y comprensión inmediata.

    Restricciones:
    - No propongas rehacer toda la app.
    - No elimines la identidad visual aprobada del logo.
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
    for model in ["gemini-2.5-pro", "gemini-2.0-flash", "gemini-2.0-flash-001"]:
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
        "goal": "Definir una propuesta multi-modelo 10/10 para reducir scroll móvil, separar mejor el menú y limitar el modo oscuro a la barra superior.",
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
