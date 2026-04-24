#!/usr/bin/env python3
import json
import os
from pathlib import Path
from typing import Any

import requests

PROJECT_ROOT = Path("/home/ubuntu/complilink_operativo_v1")
OUTPUT_PATH = PROJECT_ROOT / "tmp" / "multi_ai_bundle_review.json"
OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)

SYSTEM_PROMPT = """Eres un staff engineer especialista en React, Vite y performance de bundles. Analiza un frontend ya funcional y recomienda optimizaciones seguras, incrementales y de bajo riesgo para reducir el bundle inicial. Devuelve JSON válido, sin markdown, con esta forma exacta:
{
  \"overall_assessment\": \"texto corto\",
  \"top_actions\": [
    {
      \"rank\": 1,
      \"title\": \"texto corto\",
      \"expected_impact\": \"high|medium|low\",
      \"risk\": \"high|medium|low\",
      \"rationale\": \"texto corto\",
      \"implementation_hint\": \"texto corto\"
    }
  ],
  \"avoid\": ["texto corto"]
}
Usa máximo 5 acciones. Prioriza code splitting y lazy loading antes que cambios invasivos."""

USER_PROMPT = """Contexto actual de CompliLink Operativo V1:

Resultado del build de producción:
- Chunk principal: dist/public/assets/index-OqoVz7Dk.js = 3,717.64 kB minificado, 946.20 kB gzip.
- Otros chunks pesados ya separados: mermaid.core 431.85 kB, cytoscape 442.41 kB, html2canvas.esm 202.36 kB, wasm 622.34 kB, cpp 626.08 kB, emacs-lisp 779.85 kB.
- Vite advierte que hay chunks mayores a 500 kB y sugiere dynamic import() o manualChunks.

App.tsx actual importa eager estas rutas/páginas:
- Access
- Auditar
- CeoDashboard
- Home
- LegalPrivacyPage / LegalTermsPage
- NotFound

Rutas actuales:
- /
- /acceso
- /auditar
- /ceo
- /ceo/bridge
- /ceo/alertas
- /ceo/accesos
- /ceo/documentos
- /legal/privacidad
- /legal/terminos

Hallazgos de código:
- AIChatBox.tsx importa Streamdown para markdown rendering.
- LegalDocuments.tsx usa parser propio sencillo, no una librería markdown pesada.
- La prioridad del proyecto es reducir el bundle inicial sin romper flujos listos para pruebas masivas.
- Ya se estabilizó Playwright; conviene evitar cambios de producto invasivos.

Tu tarea:
- Prioriza las mejores optimizaciones seguras e incrementales para reducir el bundle inicial.
- Favorece lazy loading por ruta, separación de superficies CEO/Auditar y carga diferida de componentes pesados sólo cuando se usan.
- Señala qué cambios evitar por ser de alto riesgo o baja ganancia inmediata.
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
    response = requests.post(
        "https://api.openai.com/v1/chat/completions",
        headers={
            "Authorization": f"Bearer {os.environ['OPENAI_API_KEY']}",
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
    return json.loads(extract_openai_text(response.json()))


def call_xai() -> dict[str, Any]:
    response = requests.post(
        "https://api.x.ai/v1/chat/completions",
        headers={
            "Authorization": f"Bearer {os.environ['XAI_API_KEY']}",
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
    return json.loads(extract_openai_text(response.json()))


def call_gemini() -> dict[str, Any]:
    response = requests.post(
        f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={os.environ['GEMINI_API_KEY']}",
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
    OUTPUT_PATH.write_text(json.dumps({"results": results, "errors": errors}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(str(OUTPUT_PATH))


if __name__ == "__main__":
    main()
