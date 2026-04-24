#!/usr/bin/env python3
import json
import os
from pathlib import Path
from typing import Any

import requests

PROJECT_ROOT = Path("/home/ubuntu/complilink_operativo_v1")
OUTPUT_PATH = PROJECT_ROOT / "tmp" / "multi_ai_e2e_review.json"
OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)

SYSTEM_PROMPT = """Eres un staff engineer especialista en React, Playwright y estabilización de suites E2E. Analiza discrepancias entre pruebas y producto. Devuelve JSON válido, sin markdown, con esta forma exacta:
{
  \"overall_assessment\": \"texto corto\",
  \"items\": [
    {
      \"id\": \"auditar-post-upload-mobile|legal-gate-retry|ceo-email-code-flow|ceo-exports-stale|ceo-user-expediente\",
      \"classification\": \"test_stale|product_issue|mixed|uncertain\",
      \"recommended_action\": \"texto corto\",
      \"rationale\": \"texto corto\",
      \"confidence\": \"high|medium|low\"
    }
  ]
}
No agregues claves extra. Sé concreto y conservador."""

USER_PROMPT = """Contexto actual del proyecto CompliLink Operativo V1:

1) auditar-post-upload-mobile
- La prueba visita /auditar?postUploadHarness=1 y espera que data-testid='post-upload-harness' sea visible.
- En Auditar.tsx:
  - postUploadHarnessMode se activa con query param postUploadHarness=1.
  - shouldCompactPostUploadExperience = Boolean(lastUpload) && !pendingDraft && !selectedFile.
  - El harness renderiza <section data-testid=\"post-upload-harness\"> pero su className es \"hidden\" cuando shouldCompactPostUploadExperience es true.
  - El mismo harness preconfigura lastUpload, por lo que el modo compacto queda activo.
- La UI compacta real muestra el resultado principal y CTA dominante, aunque el harness queda oculto.

2) legal-gate-retry
- La prueba espera el texto \"Reintento habilitado en\".
- El código actual en Auditar.tsx muestra:
  - \"Disponible nuevamente en ${legalGateRetryCountdown}s\"
  - \"Reintento inmediato disponible\"

3) ceo-email-code-flow
- La prueba antigua usa labels ya removidos: \"Correo corporativo\", \"Nombre visible (opcional)\", \"Correo verificado\", y botón \"Validar e iniciar sesión\".
- Access.tsx actual usa:
  - label \"Correo\"
  - botón \"Recibir código\"
  - mensaje de éxito: \"Código enviado al buzón de respaldo {maskedEmail}.\" cuando aplica
  - paso de verificación con bloque informativo \"Código enviado\" + correo mostrado
  - label \"Código de 6 dígitos\"
  - botón final \"Entrar\"

4) ceo-exports-stale
- La prueba espera en /ceo con Date.now adelantado 30 min:
  - exportar csv disabled
  - reporte pdf disabled
  - botón con nombre /actualizar/i enabled
- En CeoDashboard.tsx:
  - isSnapshotStale = snapshotAgeMs !== null && snapshotAgeMs > 2 * 60 * 1000
  - executiveActionsBlocked = isRefreshing || isSnapshotStale || Boolean(snapshotError)
  - existe un botón superior visible con texto exacto \"Actualizar\"
  - también existe otro botón \"Actualizar vista\"
- Hay duda de si el selector del test está tomando el botón correcto o si la UI lo deja deshabilitado por otra condición.

5) ceo-user-expediente
- La prueba espera data-testid='ceo-pending-visible-pill'.
- En CeoDashboard.tsx sí existen:
  - data-testid='ceo-retry-visible-pill'
  - data-testid='ceo-context-summary-pill'
  - data-testid='ceo-contextual-return-button'
- No apareció match para ceo-pending-visible-pill; el pill actual de retry ya incluye texto de reintentos y pendientes: \"Fricción: X reintentos · Y pendientes\".

Tu tarea:
- Clasifica cada caso como test_stale, product_issue, mixed o uncertain.
- Recomienda el cambio mínimo y más seguro para estabilizar Playwright sin introducir regresiones de producto.
- Si una prueba está desactualizada, prioriza corregir la prueba sobre tocar el producto.
"""


def extract_openai_text(payload: dict[str, Any]) -> str:
    if isinstance(payload.get("choices"), list) and payload["choices"]:
        message = payload["choices"][0].get("message", {})
        content = message.get("content")
        if isinstance(content, str):
            return content
    if isinstance(payload.get("output"), list):
        parts: list[str] = []
        for item in payload["output"]:
            for content in item.get("content", []):
                text = content.get("text")
                if text:
                    parts.append(text)
        if parts:
            return "\n".join(parts)
    raise ValueError(f"No se pudo extraer texto: {payload}")


def call_openai() -> dict[str, Any]:
    api_key = os.environ["OPENAI_API_KEY"]
    response = requests.post(
        "https://api.openai.com/v1/chat/completions",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json={
            "model": "gpt-4o-mini",
            "response_format": {"type": "json_object"},
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": USER_PROMPT},
            ],
            "temperature": 0.1,
        },
        timeout=120,
    )
    response.raise_for_status()
    text = extract_openai_text(response.json())
    return json.loads(text)


def call_xai() -> dict[str, Any]:
    api_key = os.environ["XAI_API_KEY"]
    response = requests.post(
        "https://api.x.ai/v1/chat/completions",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json={
            "model": "grok-3-mini",
            "response_format": {"type": "json_object"},
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": USER_PROMPT},
            ],
            "temperature": 0.1,
        },
        timeout=120,
    )
    response.raise_for_status()
    text = extract_openai_text(response.json())
    return json.loads(text)


def call_gemini() -> dict[str, Any]:
    api_key = os.environ["GEMINI_API_KEY"]
    response = requests.post(
        f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}",
        headers={"Content-Type": "application/json"},
        json={
            "systemInstruction": {"parts": [{"text": SYSTEM_PROMPT}]},
            "contents": [{"parts": [{"text": USER_PROMPT}]}],
            "generationConfig": {
                "temperature": 0.1,
                "responseMimeType": "application/json",
            },
        },
        timeout=120,
    )
    response.raise_for_status()
    payload = response.json()
    text = payload["candidates"][0]["content"]["parts"][0]["text"]
    return json.loads(text)


def main() -> None:
    results: dict[str, Any] = {}
    errors: dict[str, str] = {}

    for name, fn in (("chatgpt", call_openai), ("grok", call_xai), ("gemini", call_gemini)):
        try:
            results[name] = fn()
        except Exception as exc:  # noqa: BLE001
            errors[name] = f"{type(exc).__name__}: {exc}"

    OUTPUT_PATH.write_text(
        json.dumps({"results": results, "errors": errors}, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(str(OUTPUT_PATH))


if __name__ == "__main__":
    main()
