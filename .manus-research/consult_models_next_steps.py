import json
import os
from pathlib import Path
from typing import Any

import requests

PROJECT_DIR = Path("/home/ubuntu/complilink_operativo_v1")
OUTPUT_DIR = PROJECT_DIR / ".manus-research"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

PROMPT = """Eres un consultor principal de producto y arquitectura para AuditaPatron, una plataforma laboral para trabajadores en México.

Contexto obligatorio:
- La marca visible al usuario final debe ser AuditaPatron.
- Helios debe permanecer como arquitectura y motor interno, no como marca pública.
- El usuario quiere tres mejoras inmediatas:
  1. Convertir el bloque de claridad del expediente en un indicador dinámico ligado al estado real de los documentos y hallazgos del usuario.
  2. Añadir una sola acción para revalidar IMSS e Infonavit con mínima fricción.
  3. Formalizar el contrato técnico interno de Helios para que toda carga documental, análisis, almacenamiento y devolución de resultados pasen por Helios como núcleo.
- El producto debe sentirse simple, confiable, claro, mobile-first y con efecto wow, sin lenguaje técnico para el usuario final.
- No debe prometer validación oficial absoluta ni resultados legales definitivos.

Tu tarea:
1. Propón la mejor solución de producto visible para los 3 frentes.
2. Explica la lógica de arquitectura mínima viable para implementarlo sin romper el sistema actual.
3. Señala riesgos o errores que debo evitar.
4. Prioriza el orden de implementación recomendado.
5. Escribe 3 bloques claros con estos encabezados exactos:
   - CONSENSO_DE_PRODUCTO
   - CONSENSO_DE_ARQUITECTURA
   - RIESGOS_Y_PRIORIDAD

Escribe en español, de forma concreta pero profunda."""


def save_json(name: str, payload: Any) -> None:
    path = OUTPUT_DIR / name
    with path.open("w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)


def call_openai() -> dict[str, Any]:
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        return {"ok": False, "provider": "openai", "error": "OPENAI_API_KEY missing"}

    response = requests.post(
        "https://api.openai.com/v1/chat/completions",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json={
            "model": "gpt-4.1-mini",
            "temperature": 0.4,
            "messages": [
                {"role": "system", "content": "Eres un consultor senior de producto, UX y arquitectura de software."},
                {"role": "user", "content": PROMPT},
            ],
        },
        timeout=90,
    )
    response.raise_for_status()
    data = response.json()
    return {
        "ok": True,
        "provider": "openai",
        "model": data.get("model"),
        "content": data["choices"][0]["message"]["content"],
        "raw": data,
    }



def call_gemini() -> dict[str, Any]:
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        return {"ok": False, "provider": "gemini", "error": "GEMINI_API_KEY missing"}

    response = requests.post(
        f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}",
        headers={"Content-Type": "application/json"},
        json={
            "contents": [{"parts": [{"text": PROMPT}]}],
            "generationConfig": {"temperature": 0.4},
        },
        timeout=90,
    )
    response.raise_for_status()
    data = response.json()
    parts = data.get("candidates", [{}])[0].get("content", {}).get("parts", [])
    text = "\n".join(part.get("text", "") for part in parts).strip()
    return {
        "ok": True,
        "provider": "gemini",
        "model": "gemini-2.5-flash",
        "content": text,
        "raw": data,
    }



def call_grok() -> dict[str, Any]:
    api_key = os.environ.get("XAI_API_KEY")
    if not api_key:
        return {"ok": False, "provider": "grok", "error": "XAI_API_KEY missing"}

    response = requests.post(
        "https://api.x.ai/v1/chat/completions",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json={
            "model": "grok-4-0709",
            "temperature": 0.4,
            "messages": [
                {"role": "system", "content": "Eres un consultor senior de producto, UX y arquitectura de software."},
                {"role": "user", "content": PROMPT},
            ],
        },
        timeout=90,
    )
    response.raise_for_status()
    data = response.json()
    return {
        "ok": True,
        "provider": "grok",
        "model": data.get("model", "grok-4-0709"),
        "content": data["choices"][0]["message"]["content"],
        "raw": data,
    }



def run() -> None:
    providers = {
        "openai_next_steps.json": call_openai,
        "gemini_next_steps.json": call_gemini,
        "grok_next_steps.json": call_grok,
    }

    summary: dict[str, Any] = {}
    for filename, fn in providers.items():
        try:
            result = fn()
        except Exception as exc:  # noqa: BLE001
            result = {"ok": False, "provider": filename, "error": str(exc)}
        save_json(filename, result)
        summary[filename] = {
            "ok": result.get("ok", False),
            "provider": result.get("provider"),
            "model": result.get("model"),
            "error": result.get("error"),
        }

    save_json("multi_model_next_steps_summary.json", summary)


if __name__ == "__main__":
    run()
