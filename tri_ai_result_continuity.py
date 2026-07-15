import json
import os
from pathlib import Path
from typing import Any

import requests

PROJECT_ROOT = Path("/home/ubuntu/complilink_operativo_v1")
ARTIFACT_PATH = PROJECT_ROOT / "artifacts" / "tri_ai_result_continuity.json"
AUDITAR_PATH = PROJECT_ROOT / "client/src/pages/Auditar.tsx"
ACCESS_PATH = PROJECT_ROOT / "client/src/pages/Access.tsx"

SYSTEM_PROMPT = """
Eres un experto senior en UX móvil, CRO, producto legal-tech para trabajadores de México y continuidad de expedientes.
Analiza una app real llamada AuditaPatron.
Prioriza simplicidad extrema, claridad, confianza, facilidad de uso y continuidad sin fricción.
No propongas dark patterns, promesas falsas, tecnicismos innecesarios ni pasos que compliquen el guardado.
La respuesta debe enfocarse en lo que pasa DESPUÉS de la primera lectura: cómo mostrar valor, qué hacer después y cómo invitar a guardar o retomar.

Responde ÚNICAMENTE JSON válido con esta forma exacta:
{
  "model": "string",
  "overall_verdict": "string",
  "top_opportunities": [
    {
      "title": "string",
      "surface": "auditar|acceso|cross_surface",
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
- La meta es que la experiencia se sienta intuitiva, rápida y confiable.
- El usuario debe percibir valor inmediato después de la primera lectura.
- Guardar o retomar el expediente debe sentirse opcional, claro y fácil, nunca pesado.
- La app debe mostrar menos discurso y más siguiente paso útil.
""".strip()


def read_lines(path: Path, start: int, end: int) -> str:
    lines = path.read_text(encoding="utf-8").splitlines()
    start_index = max(start - 1, 0)
    end_index = min(end, len(lines))
    selected = lines[start_index:end_index]
    return "\n".join(f"{i + start}: {line}" for i, line in enumerate(selected))


def build_bundle() -> str:
    sections = [
        "### AUDITAR_RESULT_STATE\n" + read_lines(AUDITAR_PATH, 2361, 2412),
        "### AUDITAR_UPLOAD_GUIDANCE\n" + read_lines(AUDITAR_PATH, 7762, 7810),
        "### AUDITAR_RESULT_CONTINUITY\n" + read_lines(AUDITAR_PATH, 11212, 11328),
        "### AUDITAR_VAULT_CONTINUITY\n" + read_lines(AUDITAR_PATH, 11381, 11405),
        "### ACCESS_TRANSITION\n" + read_lines(ACCESS_PATH, 412, 500),
    ]
    return "\n\n".join(sections)


def build_user_prompt(bundle: str) -> str:
    return (
        f"{PRODUCT_CONTEXT}\n\n"
        "Quiero elegir la siguiente mejora de mayor impacto para la experiencia posterior a la primera lectura. "
        "Evalúa si el resultado visible, la continuidad del expediente y la transición al guardado o acceso ya se entienden con suficiente claridad. "
        "Si aún hay fricción, dime exactamente qué simplificarías primero.\n\n"
        "Prioriza:\n"
        "1. Que el usuario entienda el valor del hallazgo en segundos.\n"
        "2. Que el siguiente paso útil se vea obvio.\n"
        "3. Que guardar o retomar el expediente se perciba tranquilo y opcional.\n"
        "4. Que el copy no sature ni compita con la acción principal.\n\n"
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
