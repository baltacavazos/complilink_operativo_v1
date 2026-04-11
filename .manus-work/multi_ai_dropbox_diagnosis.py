from __future__ import annotations

import json
import os
from typing import Any

import requests

PROMPT = """
Eres un ingeniero senior de fiabilidad. Analiza esta discrepancia técnica y devuelve JSON válido.

Contexto:
1. Un script Python de backup a Dropbox usa requests con Authorization: Bearer <DROPBOX_API_KEY> y POST a https://api.dropboxapi.com/2/files/create_folder_v2.
2. La última evidencia persistida del script fue: {"error": "401 Client Error: Unauthorized for url: https://api.dropboxapi.com/2/files/create_folder_v2"}.
3. Una prueba reforzada del proyecto para el mismo secreto y el mismo endpoint había validado correctamente users/get_current_account, files/list_folder, files/create_folder_v2 y files/delete_v2.
4. Nueva verificación manual desde shell en el mismo proyecto mostró HTTP 200 para esos cuatro endpoints usando el mismo nombre de variable DROPBOX_API_KEY.
5. El script Python además crea ZIPs locales dentro de .manus-work/backups, y se encontró que había acumulado ZIPs gigantes (23G y 8.3G) dentro de esa misma carpeta dentro del proyecto.
6. El código del script actualmente solo excluye .git, .turbo y .next al construir el ZIP del proyecto.

Quiero:
- hipótesis_principal: la explicación más probable
- hipótesis_alternativas: arreglo de hasta 3 hipótesis cortas
- veredicto_sobre_script: "cambiar_script" o "no_cambiar_script_aun"
- verificaciones_minimas: arreglo de hasta 4 comprobaciones concretas y baratas
- confianza: "alta", "media" o "baja"

Responde SOLO JSON con este esquema exacto:
{
  "hipótesis_principal": "...",
  "hipótesis_alternativas": ["..."],
  "veredicto_sobre_script": "...",
  "verificaciones_minimas": ["..."],
  "confianza": "..."
}
""".strip()


def post_openai() -> dict[str, Any]:
    api_key = os.environ.get("OPENAI_API_KEY", "").strip()
    if not api_key:
        return {"provider": "openai", "error": "OPENAI_API_KEY missing"}
    payload = {
        "model": "gpt-4.1-mini",
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": "Responde solo JSON válido."},
            {"role": "user", "content": PROMPT},
        ],
        "temperature": 0.2,
    }
    resp = requests.post(
        "https://api.openai.com/v1/chat/completions",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json=payload,
        timeout=90,
    )
    resp.raise_for_status()
    data = resp.json()
    content = data["choices"][0]["message"]["content"]
    return {"provider": "openai", "result": json.loads(content)}


def post_gemini() -> dict[str, Any]:
    api_key = os.environ.get("GEMINI_API_KEY", "").strip()
    if not api_key:
        return {"provider": "gemini", "error": "GEMINI_API_KEY missing"}
    payload = {
        "contents": [{"parts": [{"text": PROMPT}]}],
        "generationConfig": {
            "temperature": 0.2,
            "responseMimeType": "application/json",
        },
    }
    resp = requests.post(
        f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}",
        headers={"Content-Type": "application/json"},
        json=payload,
        timeout=90,
    )
    resp.raise_for_status()
    data = resp.json()
    text = data["candidates"][0]["content"]["parts"][0]["text"]
    return {"provider": "gemini", "result": json.loads(text)}


def post_grok() -> dict[str, Any]:
    api_key = os.environ.get("XAI_API_KEY", "").strip()
    if not api_key:
        return {"provider": "grok", "error": "XAI_API_KEY missing"}
    payload = {
        "model": "grok-4-fast",
        "temperature": 0.2,
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": "Responde solo JSON válido."},
            {"role": "user", "content": PROMPT},
        ],
    }
    resp = requests.post(
        "https://api.x.ai/v1/chat/completions",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json=payload,
        timeout=90,
    )
    resp.raise_for_status()
    data = resp.json()
    content = data["choices"][0]["message"]["content"]
    return {"provider": "grok", "result": json.loads(content)}


def main() -> int:
    outputs = []
    for fn in (post_openai, post_gemini, post_grok):
        try:
            outputs.append(fn())
        except Exception as exc:  # noqa: BLE001
            outputs.append({"provider": fn.__name__, "error": str(exc)})
    print(json.dumps(outputs, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
