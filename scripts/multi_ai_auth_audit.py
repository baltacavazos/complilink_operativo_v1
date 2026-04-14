from __future__ import annotations

import json
import os
import re
from typing import Any

import requests

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
XAI_API_KEY = os.getenv("XAI_API_KEY")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

CONTEXT = {
    "user_report": "Desde el teléfono no se puede iniciar sesión. Debe quedar habilitada la creación de usuario de la forma más sencilla e intuitiva posible. El usuario propietario debe quedar como CEO y todos los demás como usuarios normales.",
    "observations": [
        "Access.tsx presenta Manus como ruta principal, Google como alternativa y correo con código temporal como respaldo.",
        "El flujo por correo ya crea usuario implícitamente al validar el código mediante resolveOrCreateUser(provider=email).",
        "El callback de Manus en server/_core/oauth.ts siempre redirige a '/' y no conserva returnTo, a diferencia de Google.",
        "El callback de Manus responde JSON 500 en error en vez de regresar a /acceso con mensaje controlado.",
        "upsertUser solo promueve automáticamente a admin cuando openId === OWNER_OPEN_ID.",
        "Si el propietario entra primero por email, queda con openId email:correo y rol user; más tarde Manus reutiliza ese registro por email y nunca lo promociona a admin.",
        "useAuth redirige a /acceso cuando falta sesión, así que cualquier pérdida de cookie o retorno incorrecto se percibe como 'no me deja entrar'.",
        "Los logs recientes muestran varios '[Auth] Missing session cookie', sin un rastro claro de callback exitoso persistente.",
    ],
    "constraints": [
        "Cambios de bajo riesgo, orientados a móvil.",
        "No abrir un sistema complejo de contraseñas; preferir acceso sin fricción.",
        "Mantener seguridad razonable y roles claros: propietario/CEO vs usuario normal.",
        "Priorizar una solución implementable hoy dentro del stack actual React + Express + tRPC.",
    ],
    "requested_output": {
        "format": "json",
        "keys": [
            "diagnosis",
            "recommended_changes",
            "owner_role_strategy",
            "mobile_login_risks",
            "ui_copy_suggestions",
            "tests_to_add",
            "confidence",
        ],
    },
}

SYSTEM_PROMPT = (
    "Eres un auditor senior de autenticación para aplicaciones web. "
    "Responde SOLO JSON válido. Prioriza cambios simples, móviles, seguros y de bajo riesgo."
)

USER_PROMPT = json.dumps(CONTEXT, ensure_ascii=False, indent=2)


def extract_json(text: str) -> Any:
    text = text.strip()
    if not text:
        raise ValueError("Empty model response")

    fenced = re.search(r"```(?:json)?\s*(\{.*\}|\[.*\])\s*```", text, re.S)
    if fenced:
        text = fenced.group(1)

    start_candidates = [idx for idx in [text.find("{"), text.find("[")] if idx >= 0]
    if not start_candidates:
        raise ValueError(f"No JSON object found: {text[:200]}")
    start = min(start_candidates)
    end = max(text.rfind("}"), text.rfind("]"))
    if end < start:
        raise ValueError(f"Malformed JSON payload: {text[:200]}")
    return json.loads(text[start : end + 1])


def call_openai() -> dict[str, Any]:
    if not OPENAI_API_KEY:
        return {"error": "OPENAI_API_KEY missing"}
    response = requests.post(
        "https://api.openai.com/v1/chat/completions",
        headers={
            "Authorization": f"Bearer {OPENAI_API_KEY}",
            "Content-Type": "application/json",
        },
        json={
            "model": "gpt-4o-mini",
            "temperature": 0.2,
            "response_format": {"type": "json_object"},
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": USER_PROMPT},
            ],
        },
        timeout=90,
    )
    response.raise_for_status()
    payload = response.json()
    content = payload["choices"][0]["message"]["content"]
    return extract_json(content)


def call_xai() -> dict[str, Any]:
    if not XAI_API_KEY:
        return {"error": "XAI_API_KEY missing"}
    response = requests.post(
        "https://api.x.ai/v1/chat/completions",
        headers={
            "Authorization": f"Bearer {XAI_API_KEY}",
            "Content-Type": "application/json",
        },
        json={
            "model": "grok-4",
            "temperature": 0.2,
            "response_format": {"type": "json_object"},
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": USER_PROMPT},
            ],
        },
        timeout=90,
    )
    response.raise_for_status()
    payload = response.json()
    content = payload["choices"][0]["message"]["content"]
    return extract_json(content)


def call_gemini() -> dict[str, Any]:
    if not GEMINI_API_KEY:
        return {"error": "GEMINI_API_KEY missing"}
    response = requests.post(
        f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={GEMINI_API_KEY}",
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
                        {"text": USER_PROMPT},
                    ],
                }
            ],
        },
        timeout=90,
    )
    response.raise_for_status()
    payload = response.json()
    content = payload["candidates"][0]["content"]["parts"][0]["text"]
    return extract_json(content)


def normalize_list(value: Any) -> list[str]:
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]
    if isinstance(value, str) and value.strip():
        return [value.strip()]
    return []


def main() -> None:
    providers: dict[str, dict[str, Any]] = {}
    errors: dict[str, str] = {}

    for name, fn in (("openai", call_openai), ("grok", call_xai), ("gemini", call_gemini)):
        try:
            providers[name] = fn()
        except Exception as error:  # noqa: BLE001
            errors[name] = f"{type(error).__name__}: {error}"

    cross_changes: dict[str, int] = {}
    cross_tests: dict[str, int] = {}

    for payload in providers.values():
        for item in normalize_list(payload.get("recommended_changes")):
            cross_changes[item] = cross_changes.get(item, 0) + 1
        for item in normalize_list(payload.get("tests_to_add")):
            cross_tests[item] = cross_tests.get(item, 0) + 1

    consensus = {
        "top_recommended_changes": [
            {"item": item, "mentions": mentions}
            for item, mentions in sorted(cross_changes.items(), key=lambda pair: (-pair[1], pair[0]))
        ],
        "top_tests": [
            {"item": item, "mentions": mentions}
            for item, mentions in sorted(cross_tests.items(), key=lambda pair: (-pair[1], pair[0]))
        ],
    }

    result = {
        "context": CONTEXT,
        "providers": providers,
        "errors": errors,
        "consensus": consensus,
    }

    output_dir = "/home/ubuntu/complilink_operativo_v1/tmp"
    os.makedirs(output_dir, exist_ok=True)
    output_path = os.path.join(output_dir, "multi_ai_auth_audit.json")
    with open(output_path, "w", encoding="utf-8") as file:
        json.dump(result, file, ensure_ascii=False, indent=2)

    print(output_path)


if __name__ == "__main__":
    main()
