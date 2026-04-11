from __future__ import annotations

import json
import os
from typing import Any

import requests

OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "").strip()
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "").strip()
XAI_API_KEY = os.environ.get("XAI_API_KEY", "").strip()

PROMPT = """
Contexto del proyecto:
- Ya existe un script operativo de backup a Dropbox para /Backups/AuditaPatron/.
- Ya se corrigió un error real donde la prueba ligera pasaba pero el script fallaba; ahora el respaldo sube correctamente.
- Pendientes abiertos para 'cerrar Dropbox' y no bloquear el avance del proyecto:
  1) README de respaldo por checkpoint.
  2) CONFIGURACION.md con variables, puertos, URLs externas y parámetros operativos.
  3) ARQUITECTURA.md con frontend, backend, carpetas y flujo entre componentes.
  4) Documentar servicios de terceros activos.
  5) Confirmación breve del contenido de cada respaldo.
- Restricción: se busca el cierre mínimo útil, sin sobreingeniería, para poder seguir avanzando en el proyecto principal.

Devuelve JSON estricto con esta forma:
{
  "alcance_minimo_recomendado": ["string"],
  "artefactos_imprescindibles": ["string"],
  "que_posponer": ["string"],
  "cambios_recomendados_al_script": ["string"],
  "criterio_de_cierre": "string",
  "confianza": "alta|media|baja"
}
""".strip()


def call_openai() -> dict[str, Any]:
    if not OPENAI_API_KEY:
        return {"available": False, "error": "OPENAI_API_KEY missing"}
    resp = requests.post(
        "https://api.openai.com/v1/chat/completions",
        headers={
            "Authorization": f"Bearer {OPENAI_API_KEY}",
            "Content-Type": "application/json",
        },
        json={
            "model": "gpt-4.1-mini",
            "temperature": 0.2,
            "response_format": {"type": "json_object"},
            "messages": [
                {"role": "system", "content": "Eres un arquitecto técnico pragmático. Responde solo JSON válido."},
                {"role": "user", "content": PROMPT},
            ],
        },
        timeout=120,
    )
    resp.raise_for_status()
    data = resp.json()
    raw = data["choices"][0]["message"]["content"]
    return {"available": True, "raw": raw, "parsed": json.loads(raw)}


def call_gemini() -> dict[str, Any]:
    if not GEMINI_API_KEY:
        return {"available": False, "error": "GEMINI_API_KEY missing"}
    resp = requests.post(
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
                    "parts": [{"text": PROMPT}],
                }
            ],
        },
        timeout=120,
    )
    resp.raise_for_status()
    data = resp.json()
    raw = data["candidates"][0]["content"]["parts"][0]["text"]
    return {"available": True, "raw": raw, "parsed": json.loads(raw)}


def call_grok() -> dict[str, Any]:
    if not XAI_API_KEY:
        return {"available": False, "error": "XAI_API_KEY missing"}
    resp = requests.post(
        "https://api.x.ai/v1/chat/completions",
        headers={
            "Authorization": f"Bearer {XAI_API_KEY}",
            "Content-Type": "application/json",
        },
        json={
            "model": "grok-3-mini",
            "temperature": 0.2,
            "response_format": {"type": "json_object"},
            "messages": [
                {"role": "system", "content": "Eres un arquitecto técnico pragmático. Responde solo JSON válido."},
                {"role": "user", "content": PROMPT},
            ],
        },
        timeout=120,
    )
    resp.raise_for_status()
    data = resp.json()
    raw = data["choices"][0]["message"]["content"]
    return {"available": True, "raw": raw, "parsed": json.loads(raw)}


def main() -> int:
    results = {
        "openai": call_openai(),
        "gemini": call_gemini(),
        "grok": call_grok(),
    }
    print(json.dumps(results, indent=2, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
