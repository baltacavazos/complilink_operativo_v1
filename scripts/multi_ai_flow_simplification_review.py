#!/usr/bin/env python3
import json
import os
from pathlib import Path
from typing import Any

import requests

PROJECT_ROOT = Path("/home/ubuntu/complilink_operativo_v1")
OUTPUT_PATH = PROJECT_ROOT / "tmp" / "multi_ai_flow_simplification_review.json"
OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)

SYSTEM_PROMPT = """Eres un principal product designer + frontend engineer especialista en flujos móviles de alta conversión y baja fricción. Analiza dos pantallas ya funcionales y recomienda micro-ajustes seguros, incrementales y de bajo riesgo. Devuelve JSON válido, sin markdown, con esta forma exacta:
{
  \"overall_assessment\": \"texto corto\",
  \"auditar_actions\": [
    {
      \"rank\": 1,
      \"title\": \"texto corto\",
      \"impact\": \"high|medium|low\",
      \"risk\": \"high|medium|low\",
      \"rationale\": \"texto corto\",
      \"implementation_hint\": \"texto corto\"
    }
  ],
  \"acceso_actions\": [
    {
      \"rank\": 1,
      \"title\": \"texto corto\",
      \"impact\": \"high|medium|low\",
      \"risk\": \"high|medium|low\",
      \"rationale\": \"texto corto\",
      \"implementation_hint\": \"texto corto\"
    }
  ],
  \"avoid\": ["texto corto"]
}
Usa máximo 3 acciones por pantalla. Prioriza claridad, reducción de scroll, jerarquía visual y continuidad del flujo sin rediseños grandes."""

USER_PROMPT = """Contexto actual del proyecto CompliLink Operativo V1:

Objetivo de esta fase:
- Simplificar /auditar y /acceso para pruebas masivas controladas.
- Mantener la experiencia bulletproof y sin fricción.
- Evitar cambios grandes o riesgosos porque Playwright ya quedó estabilizado.

Estado actual de /acceso:
- H1: 'Entrar con correo'.
- Texto principal: 'Escribe tu correo y te mandamos un código de 6 dígitos para entrar. Después vuelves directo a {returnToLabel}. Si ya habías usado este equipo, te mostramos el último correo para avanzar más rápido.'
- Encima del card hay dos ayudas de retorno: un texto 'Luego vuelves a ...' y un chip 'Después de entrar: ...'.
- Paso 1: label 'Correo', helper 'Usa el correo con el que quieres entrar hoy.', botón 'Recibir código'.
- Si hay correo previo, aparece un bloque 'Te reconocimos en este equipo'.
- Paso 2: bloque 'Código enviado', correo mostrado, botón 'Cambiar', label 'Código de 6 dígitos', botón final 'Entrar', y control secundario 'Reenviar código'.

Estado actual de /auditar en el primer flujo:
- Hero oscuro con enlace 'Volver al inicio', logo, eyebrow 'Tu revisión', H1 'Sube tu documento. Te diremos qué es, qué encontramos y qué sigue.'
- Texto secundario móvil: 'Lo analizamos al momento y te lo explicamos sin vueltas antes de guardarlo.'
- Chip de confianza: 'Archivo protegido y usado solo para tu auditoría'.
- En móvil muestra además el helper 'El formulario para subir tu archivo está justo abajo.'
- Más abajo existe un bloque grande de entrada para subir documento con copy tipo 'Empieza aquí' / 'Sube tu primer archivo y recibe una lectura útil al momento.' y CTA para elegir cómo subir el documento.
- El proyecto ya tuvo varias rondas de compactación post-upload; aquí sólo se quiere bajar fricción en el arranque.

Tu tarea:
- Propón micro-ajustes seguros para que el primer vistazo de /auditar y /acceso sea todavía más claro y corto.
- Evita introducir nuevas funciones, pasos, modales o dependencias.
- Prioriza consolidar ayudas redundantes, reforzar el CTA dominante y recortar copy accesorio.
"""


def extract_openai_text(payload: dict[str, Any]) -> str:
    if isinstance(payload.get("choices"), list) and payload["choices"]:
        content = payload["choices"][0].get("message", {}).get("content")
        if isinstance(content, str):
            return content
    if isinstance(payload.get("output"), list):
        texts: list[str] = []
        for item in payload["output"]:
            for content in item.get("content", []):
                text = content.get("text")
                if text:
                    texts.append(text)
        if texts:
            return "\n".join(texts)
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
