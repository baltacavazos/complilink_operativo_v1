import json
import os
import textwrap
from datetime import datetime, timezone
from pathlib import Path

import requests

PROJECT_ROOT = Path("/home/ubuntu/complilink_operativo_v1")
OUTPUT_DIR = PROJECT_ROOT / "research" / "ux_mobile"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
OUTPUT_PATH = OUTPUT_DIR / "logo_isotype_recognition_consensus.json"

SYSTEM_PROMPT = textwrap.dedent(
    """
    Eres una combinación de principal brand designer, principal mobile UX designer, art director y frontend architect.
    Tu misión es recomendar la mejor microiteración posible para que el isotipo de la lupa de AuditaPatron sea claramente reconocible en el header y refuerce el brand recognition de inmediato, especialmente en móvil.

    Debes pensar como una persona extremadamente sensible a la legibilidad de marcas en tamaños pequeños.
    No propongas un rediseño total ni una solución recargada. Debes elegir ajustes concretos, sobrios y de alto impacto.

    Responde SOLO JSON válido con esta forma exacta:
    {
      "veredicto_general": "texto corto",
      "consensus_score_0_to_10": 0,
      "main_decision": "texto corto",
      "loupe_isotype_strategy": {
        "decision": "texto corto",
        "recommended_pattern": "texto corto",
        "changes": ["cambio 1", "cambio 2", "cambio 3", "cambio 4"],
        "why_this_wins": "texto corto",
        "do_not_do": ["no 1", "no 2", "no 3"]
      },
      "header_balance": {
        "decision": "texto corto",
        "changes": ["cambio 1", "cambio 2", "cambio 3"],
        "target_effect": "texto corto"
      },
      "desktop_consistency": {
        "decision": "texto corto",
        "changes": ["cambio 1", "cambio 2", "cambio 3"],
        "target_effect": "texto corto"
      },
      "changes_now": ["cambio 1", "cambio 2", "cambio 3", "cambio 4", "cambio 5"],
      "confidence_0_to_100": 0
    }
    """
).strip()

USER_PROMPT = textwrap.dedent(
    """
    Contexto del producto:
    - Marca: AuditaPatron.
    - Público: trabajadores en México.
    - La experiencia debe sentirse clara, confiable, directa y mobile-first.
    - Ya existe una landing con barra superior oscura, hero claro y CTA principal verde.

    Referencia maestra obligatoria:
    - El logo original de AuditaPatron usa el wordmark "AUDITAPATRON", la frase secundaria "CONOCE TUS DERECHOS" y una lupa azul marino con mango turquesa como gesto distintivo principal.
    - La nueva iteración del header debe respetar esa lógica visual original; no debe inventar una marca nueva ni convertir la lupa en otra cosa.

    Problema confirmado:
    1. El logo mejora algo, pero la lupa sigue sin ser claramente visible ni memorable.
    2. El usuario quiere que la lupa del logo sea inequívoca para construir brand recognition.
    3. La solución debe reforzar el isotipo sin volver pesada la barra superior.
    4. El hero y la jerarquía general ya están bien encaminados y no deben romperse.

    Qué debes decidir:
    1. Cuál es la mejor solución para que la lupa original gane reconocimiento inmediato: más tamaño óptico, mejor contraste, contenedor más limpio, fondo de apoyo, recorte del wordmark, separación, simplificación gráfica o una combinación concreta.
    2. Cómo debe redistribuirse el header para que la lupa destaque mejor sin competir con CTA y menú.
    3. Cómo mantener coherencia entre móvil y desktop para que la marca se reconozca igual en ambos, respetando la lógica del logo original.
    4. Si conviene mostrar en móvil solo el isotipo reforzado más una versión resumida del wordmark, o una adaptación fiel del lockup completo.
    5. Qué cambios exactos deben implementarse primero para obtener la mayor mejora inmediata.

    Restricciones:
    - No rediseñar toda la landing.
    - No usar efectos chillones, neón ni recursos pesados.
    - No convertir el header en el protagonista visual.
    - No traicionar el gesto distintivo de la lupa azul marino con mango turquesa.
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
        "goal": "Definir la mejor solución multi-modelo para que la lupa del logo gane reconocimiento inmediato en el header.",
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
