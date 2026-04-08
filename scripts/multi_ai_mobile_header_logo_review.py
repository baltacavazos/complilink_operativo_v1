import json
import os
import textwrap
from datetime import datetime, timezone
from pathlib import Path

import requests

PROJECT_ROOT = Path("/home/ubuntu/complilink_operativo_v1")
OUTPUT_DIR = PROJECT_ROOT / "research" / "ux_mobile"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
OUTPUT_PATH = OUTPUT_DIR / "mobile_header_logo_consensus.json"

SYSTEM_PROMPT = textwrap.dedent(
    """
    Eres una combinación de principal brand designer, principal mobile UX designer, product strategist y frontend architect.
    Tu misión es recomendar la mejor microiteración posible para que la landing móvil de AuditaPatron se sienta 10/10 en claridad, confianza, contraste visual y facilidad de explicación.

    Debes pensar como una persona extremadamente sensible a problemas reales de percepción visual en móvil.
    No propongas un rediseño total. Debes elegir ajustes concretos, sobrios y de alto impacto.

    Responde SOLO JSON válido con esta forma exacta:
    {
      "veredicto_general": "texto corto",
      "consensus_score_0_to_10": 0,
      "main_decision": "texto corto",
      "mobile_header_logo": {
        "decision": "texto corto",
        "recommended_pattern": "texto corto",
        "changes": ["cambio 1", "cambio 2", "cambio 3", "cambio 4"],
        "why_this_wins": "texto corto",
        "do_not_do": ["no 1", "no 2", "no 3"]
      },
      "mobile_header_balance": {
        "decision": "texto corto",
        "changes": ["cambio 1", "cambio 2", "cambio 3"],
        "target_effect": "texto corto"
      },
      "social_proof_upgrade": {
        "decision": "texto corto",
        "format": "texto corto",
        "copy_examples": ["ejemplo 1", "ejemplo 2", "ejemplo 3"],
        "placement": "texto corto"
      },
      "dossier_status_interaction": {
        "decision": "texto corto",
        "example_state": "texto corto",
        "interaction_rule": "texto corto",
        "changes": ["cambio 1", "cambio 2", "cambio 3"]
      },
      "priority_order": ["prioridad 1", "prioridad 2", "prioridad 3", "prioridad 4"],
      "changes_now": ["cambio 1", "cambio 2", "cambio 3", "cambio 4", "cambio 5", "cambio 6"],
      "confidence_0_to_100": 0
    }
    """
).strip()

USER_PROMPT = textwrap.dedent(
    """
    Contexto del producto:
    - Marca: AuditaPatron.
    - Público: trabajadores en México, incluyendo personas con baja tolerancia a interfaces complejas.
    - La experiencia debe sentirse muy clara, confiable, directa, fácil de explicar y mobile-first.
    - Ya existe una landing con barra superior oscura, hero claro, CTA principal verde y menú hamburguesa en móvil.

    Problema confirmado en móvil:
    1. El logo actual del header se ve mal: está demasiado pequeño, pierde contraste y no comunica bien la marca sobre la barra oscura.
    2. El CTA principal "Auditar" y el botón de menú compiten visualmente con el logo, mientras el logo queda débil.
    3. El resto del hero ya va mejor, así que no se quiere romper esa claridad lograda.
    4. También se aprobó avanzar con dos mejoras siguientes: una prueba social más convincente y un mini estado documental interactivo.

    Observaciones concretas del estado actual en móvil:
    - El lockup del logo se percibe casi ilegible a primera vista.
    - El área izquierda del header parece demasiado sacrificada frente al CTA y al menú.
    - La solución no debe ser simplemente agrandar todo indiscriminadamente si eso vuelve pesada la barra superior.
    - Debe verse mejor la marca sin comprometer limpieza, jerarquía ni velocidad de lectura.

    Qué debes decidir:
    1. Cuál es la mejor solución para el logo en móvil: wordmark simplificado, icono dentro de cápsula, lockup horizontal mejorado, fondo de apoyo, borde sutil, glow sobrio, o una combinación concreta.
    2. Cómo redistribuir el header móvil para que logo, CTA y menú convivan mejor.
    3. Cómo convertir la prueba social breve actual en algo más convincente y escaneable en móvil sin caer en marketing exagerado.
    4. Cómo volver interactivo el mini estado documental para empujar naturalmente al siguiente archivo recomendado.
    5. Qué debe implementarse primero para maximizar mejora visual inmediata.

    Restricciones:
    - No rediseñar toda la landing.
    - No usar efectos chillones, neón, vidrio exagerado ni recursos visuales pesados.
    - No quitar protagonismo al titular principal del hero.
    - Si hay que elegir entre una solución más vistosa y una más clara, gana la más clara.
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
    for model in ["gemini-2.5-flash", "gemini-flash-latest", "gemini-1.5-flash"]:
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
        "goal": "Definir la mejor solución multi-modelo para corregir el logo del header móvil y cerrar las siguientes mejoras del hero con máxima claridad visual.",
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
