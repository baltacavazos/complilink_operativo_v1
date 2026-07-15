from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

import requests

PROJECT_ROOT = Path("/home/ubuntu/complilink_operativo_v1")
ARTIFACT_PATH = PROJECT_ROOT / "artifacts" / "tri_ai_conversion_premium.json"

HOME_PATH = PROJECT_ROOT / "client/src/pages/Home.tsx"
AUDITAR_PATH = PROJECT_ROOT / "client/src/pages/Auditar.tsx"
ACCESS_PATH = PROJECT_ROOT / "client/src/pages/Access.tsx"

SYSTEM_PROMPT = """
Eres un experto senior en UX móvil, CRO, producto legal-tech para trabajadores de México y crecimiento de apps.
Analiza una app/web real llamada AuditaPatron.
Debes priorizar simplicidad extrema, claridad, confianza, facilidad de uso y capacidad de conversión.
No propongas dark patterns, promesas falsas, links inexistentes ni lenguaje técnico innecesario.
La web puede explicar más. La app debe ser más directa.

Responde ÚNICAMENTE JSON válido con esta forma exacta:
{
  "model": "string",
  "overall_verdict": "string",
  "top_opportunities": [
    {
      "title": "string",
      "surface": "home|auditar|acceso|cross_surface",
      "impact": "high|medium|low",
      "effort": "high|medium|low",
      "why": "string",
      "recommended_change": "string"
    }
  ],
  "keep": ["string"],
  "remove_or_reduce": ["string"],
  "copy_principles": ["string"],
  "next_best_move": "string"
}
No uses markdown ni texto extra fuera del JSON.
""".strip()

PRODUCT_CONTEXT = """
Contexto de negocio:
- AuditaPatron ayuda a trabajadores de México a subir recibos y documentos laborales para detectar señales relevantes.
- Meta actual: dejar la experiencia lista para crecer, cobrar y convertir mejor.
- La app debe sentirse intuitiva, rápida y casi obvia desde el primer minuto.
- La web puede explicar valor, confianza y por qué descargar/usar la herramienta.
- La app debe mostrar menos discurso y más acción clara.
- No se deben usar promesas vacías ni enlaces falsos a App Store o Google Play.
""".strip()


def read_lines(path: Path, start: int, end: int) -> str:
    lines = path.read_text(encoding="utf-8").splitlines()
    start_index = max(start - 1, 0)
    end_index = min(end, len(lines))
    selected = lines[start_index:end_index]
    return "\n".join(f"{i + start}: {line}" for i, line in enumerate(selected))


def build_bundle() -> str:
    sections = [
        "### HOME_NAV\n" + read_lines(HOME_PATH, 264, 269),
        "### HOME_HERO_VARIANTS\n" + read_lines(HOME_PATH, 435, 470),
        "### HOME_HOW_IT_WORKS\n" + read_lines(HOME_PATH, 2285, 2315),
        "### HOME_APP_SECTION\n" + read_lines(HOME_PATH, 2964, 3045),
        "### AUDITAR_STATE\n" + read_lines(AUDITAR_PATH, 6152, 6166),
        "### AUDITAR_NATIVE_HERO\n" + read_lines(AUDITAR_PATH, 7755, 7815),
        "### AUDITAR_UPLOAD_INTRO\n" + read_lines(AUDITAR_PATH, 7871, 7908),
        "### AUDITAR_UPLOAD_CARD\n" + read_lines(AUDITAR_PATH, 9180, 9200),
        "### ACCESS_INTRO\n" + read_lines(ACCESS_PATH, 412, 500),
    ]
    return "\n\n".join(sections)


def build_user_prompt(bundle: str) -> str:
    return (
        f"{PRODUCT_CONTEXT}\n\n"
        "Quiero una recomendación honesta y accionable para la siguiente ronda de trabajo. "
        "Evalúa si la experiencia ya se siente intuitiva, fácil de usar y deseable para trabajadores de México, "
        "y dime cuáles son las mejores oportunidades de mejora de alto impacto.\n\n"
        "Prioriza:\n"
        "1. Reducir fricción inicial.\n"
        "2. Aumentar claridad y confianza.\n"
        "3. Mejorar conversión hacia la auditoría gratuita y futura descarga de app.\n"
        "4. Evitar saturación de copy dentro de la app.\n"
        "5. Mantener la web más explicativa que la app.\n\n"
        "Devuelve máximo 5 oportunidades priorizadas.\n\n"
        f"ESTADO ACTUAL A REVISAR:\n{bundle}"
    )


def parse_json_response(raw_text: str) -> dict[str, Any]:
    text = raw_text.strip()
    if text.startswith("```"):
        text = text.strip("`")
        if text.lower().startswith("json"):
            text = text[4:].strip()
    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end == -1 or end < start:
        raise ValueError(f"No se encontró JSON válido en la respuesta: {raw_text[:400]}")
    return json.loads(text[start : end + 1])


def call_openai(user_prompt: str, api_key: str) -> dict[str, Any]:
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
                {"role": "user", "content": user_prompt},
            ],
        },
        timeout=180,
    )
    response.raise_for_status()
    text = response.json()["choices"][0]["message"]["content"]
    parsed = parse_json_response(text)
    parsed.setdefault("model", "gpt-4.1-mini")
    return parsed


def call_grok(user_prompt: str, api_key: str) -> dict[str, Any]:
    response = requests.post(
        "https://api.x.ai/v1/chat/completions",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json={
            "model": "grok-4",
            "temperature": 0.2,
            "response_format": {"type": "json_object"},
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt},
            ],
        },
        timeout=180,
    )
    response.raise_for_status()
    text = response.json()["choices"][0]["message"]["content"]
    parsed = parse_json_response(text)
    parsed.setdefault("model", "grok-4")
    return parsed


def call_gemini_once(user_prompt: str, api_key: str, model: str) -> dict[str, Any]:
    response = requests.post(
        f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}",
        headers={"Content-Type": "application/json"},
        json={
            "generationConfig": {
                "temperature": 0.2,
                "responseMimeType": "application/json",
            },
            "contents": [
                {
                    "role": "user",
                    "parts": [
                        {"text": SYSTEM_PROMPT},
                        {"text": user_prompt},
                    ],
                }
            ],
        },
        timeout=180,
    )
    response.raise_for_status()
    payload = response.json()
    text = payload["candidates"][0]["content"]["parts"][0]["text"]
    parsed = parse_json_response(text)
    parsed.setdefault("model", model)
    return parsed


def call_gemini(user_prompt: str, api_key: str) -> dict[str, Any]:
    errors: list[str] = []
    for model in ["gemini-2.5-flash", "gemini-2.0-flash"]:
        try:
            return call_gemini_once(user_prompt, api_key, model)
        except Exception as exc:  # noqa: BLE001
            errors.append(f"{model}: {exc}")
    raise RuntimeError(" | ".join(errors))


def main() -> int:
    bundle = build_bundle()
    user_prompt = build_user_prompt(bundle)

    results: dict[str, Any] = {}
    errors: dict[str, str] = {}

    openai_key = os.environ.get("OPENAI_API_KEY", "").strip()
    grok_key = os.environ.get("XAI_API_KEY", "").strip()
    gemini_key = os.environ.get("GEMINI_API_KEY", "").strip()

    if openai_key:
        try:
            results["ChatGPT"] = call_openai(user_prompt, openai_key)
        except Exception as exc:  # noqa: BLE001
            errors["ChatGPT"] = str(exc)
    else:
        errors["ChatGPT"] = "No se encontró OPENAI_API_KEY en el entorno."

    if grok_key:
        try:
            results["Grok"] = call_grok(user_prompt, grok_key)
        except Exception as exc:  # noqa: BLE001
            errors["Grok"] = str(exc)
    else:
        errors["Grok"] = "No se encontró XAI_API_KEY en el entorno."

    if gemini_key:
        try:
            results["Gemini"] = call_gemini(user_prompt, gemini_key)
        except Exception as exc:  # noqa: BLE001
            errors["Gemini"] = str(exc)
    else:
        errors["Gemini"] = "No se encontró GEMINI_API_KEY en el entorno."

    payload = {
        "product_context": PRODUCT_CONTEXT,
        "bundle_preview": bundle,
        "results": results,
        "errors": errors,
    }
    ARTIFACT_PATH.parent.mkdir(parents=True, exist_ok=True)
    ARTIFACT_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(str(ARTIFACT_PATH))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
