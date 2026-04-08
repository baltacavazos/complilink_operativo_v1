import json
import os
import textwrap
from datetime import datetime, timezone
from pathlib import Path

import requests

PROJECT_ROOT = Path("/home/ubuntu/complilink_operativo_v1")
OUTPUT_DIR = PROJECT_ROOT / "research" / "ux_mobile"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
OUTPUT_PATH = OUTPUT_DIR / "header_logo_clarity_consensus.json"

SYSTEM_PROMPT = textwrap.dedent(
    """
    Eres una combinación de principal brand designer, principal mobile UX designer, growth product strategist y frontend architect.
    Tu misión es recomendar la mejor microiteración de AuditaPatron para que la landing se sienta 10/10 en claridad, confianza, facilidad de explicación y adopción masiva.

    Debes pensar como un cliente exigente que quiere una interfaz instantáneamente entendible y como un diseñador obsesionado con resolver problemas reales de percepción visual.
    No propongas un rediseño total; propone ajustes concretos, elegantes y de alto impacto con mínima intervención.

    Responde SOLO JSON válido con esta forma exacta:
    {
      "veredicto_general": "texto corto",
      "consensus_score_0_to_10": 0,
      "main_decision": "texto corto",
      "logo_header_solution": {
        "decision": "texto corto",
        "recommended_pattern": "texto corto",
        "changes": ["cambio 1", "cambio 2", "cambio 3"],
        "why_this_wins": "texto corto",
        "desktop_rule": "texto corto",
        "mobile_rule": "texto corto"
      },
      "mobile_cta_compaction": {
        "decision": "texto corto",
        "changes": ["cambio 1", "cambio 2", "cambio 3"],
        "target_effect": "texto corto"
      },
      "social_proof_snippet": {
        "decision": "texto corto",
        "copy_example": "texto corto",
        "placement": "texto corto"
      },
      "mini_dossier_status": {
        "decision": "texto corto",
        "example_state": "texto corto",
        "changes": ["cambio 1", "cambio 2", "cambio 3"]
      },
      "priority_order": ["prioridad 1", "prioridad 2", "prioridad 3", "prioridad 4"],
      "changes_now": ["cambio 1", "cambio 2", "cambio 3", "cambio 4", "cambio 5", "cambio 6"],
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
    - Ya existe una landing clara con barra superior oscura, hero dominante y tarjeta derecha simplificada.

    Problema detectado ahora:
    1. El logo del header pierde contraste y presencia sobre el fondo oscuro.
    2. No se busca hacer el header más pesado; se busca que el logo se vea mejor sin romper la limpieza lograda.
    3. También conviene compactar mejor los CTAs en móvil.
    4. Se quiere una prueba social breve debajo del hero para reforzar confianza inmediata.
    5. Se quiere añadir un mini estado visible de documentos subidos y faltantes para hacer tangible el avance del expediente.

    Qué debes decidir:
    1. Cuál es la mejor solución para que el logo se vea claramente en la barra oscura sin verse pegado, débil o lavado.
    2. Si conviene usar una versión distinta del lockup, una cápsula sutil, un tratamiento de brillo/contraste o una separación mínima del fondo.
    3. Cómo compactar los CTAs en móvil sin perder claridad ni jerarquía.
    4. Qué tipo de prueba social breve reforzaría confianza sin sonar exagerada ni marketinera.
    5. Cómo mostrar un mini estado de avance documental de manera muy simple y útil.
    6. Qué debe ejecutarse primero para maximizar impacto visual inmediato.

    Restricciones:
    - No rediseñar toda la landing.
    - No usar soluciones cargadas, brillosas o poco sobrias.
    - No debilitar el protagonismo del titular principal.
    - No introducir copy grandilocuente ni promesas exageradas.
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
        "goal": "Definir la mejor solución multi-modelo para recuperar contraste del logo en el header y afinar claridad inmediata del hero sin rediseñar la landing.",
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
