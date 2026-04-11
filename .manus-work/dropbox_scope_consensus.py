import json
import os
from pathlib import Path

import requests

BASE_DIR = Path("/home/ubuntu/complilink_operativo_v1/.manus-work")
BASE_DIR.mkdir(parents=True, exist_ok=True)
OUT_PATH = BASE_DIR / "dropbox_scope_consensus.json"

PROMPT = """
Analiza este caso técnico y responde SOLO JSON válido.

Caso:
- Un token de Dropbox sí pasa la prueba POST /2/users/get_current_account.
- El backup real falla al primer paso con 401 Unauthorized en POST /2/files/create_folder_v2.
- El sistema necesita crear carpeta, listar archivos, subir ZIP y borrar backups viejos.

Devuelve JSON exacto con esta forma:
{
  "likely_causes": [""],
  "most_probable_cause": "",
  "required_dropbox_permissions": [""],
  "recommended_validation_endpoints": [""],
  "improved_secret_test": "",
  "user_instruction": ""
}
""".strip()


def post_json(url: str, headers: dict[str, str], body: dict) -> dict:
    response = requests.post(url, headers=headers, json=body, timeout=90)
    try:
        data = response.json()
    except Exception:
        data = {"text": response.text}
    return {"status_code": response.status_code, "body": data}


def call_openai() -> dict:
    key = os.environ.get("OPENAI_API_KEY")
    if not key:
        return {"error": "OPENAI_API_KEY no disponible"}
    return post_json(
        "https://api.openai.com/v1/chat/completions",
        {
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
        },
        {
            "model": "gpt-4o-mini",
            "temperature": 0.1,
            "response_format": {"type": "json_object"},
            "messages": [
                {"role": "system", "content": "Responde solo JSON válido."},
                {"role": "user", "content": PROMPT},
            ],
        },
    )


def call_grok() -> dict:
    key = os.environ.get("XAI_API_KEY")
    if not key:
        return {"error": "XAI_API_KEY no disponible"}
    return post_json(
        "https://api.x.ai/v1/chat/completions",
        {
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
        },
        {
            "model": "grok-4",
            "temperature": 0.1,
            "response_format": {"type": "json_object"},
            "messages": [
                {"role": "system", "content": "Responde solo JSON válido."},
                {"role": "user", "content": PROMPT},
            ],
        },
    )


def call_gemini() -> dict:
    key = os.environ.get("GEMINI_API_KEY")
    if not key:
        return {"error": "GEMINI_API_KEY no disponible"}
    return post_json(
        f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={key}",
        {"Content-Type": "application/json"},
        {
            "contents": [{"parts": [{"text": PROMPT}]}],
            "generationConfig": {
                "temperature": 0.1,
                "responseMimeType": "application/json",
            },
        },
    )


result = {
    "openai": call_openai(),
    "grok": call_grok(),
    "gemini": call_gemini(),
}
OUT_PATH.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(str(OUT_PATH))
