#!/usr/bin/env python3
import json
import os
import time
from pathlib import Path

import requests

PROJECT_ROOT = Path("/home/ubuntu/complilink_operativo_v1")
BRIEF_PATH = PROJECT_ROOT / "ceo_perimeter_multi_ai_brief.md"
OUTPUT_PATH = PROJECT_ROOT / "ceo_perimeter_multi_ai_results.json"
TIMEOUT = 90

SYSTEM_PROMPT = (
    "Eres un auditor técnico senior. Debes responder únicamente con JSON válido y sin texto adicional. "
    "Respeta exactamente el esquema solicitado por el usuario. Prioriza cambios mínimos y seguros para cerrar V1."
)


def load_brief() -> str:
    return BRIEF_PATH.read_text(encoding="utf-8")


brief = load_brief()
user_prompt = brief + "\n\nDevuelve solo JSON válido."


def parse_json_payload(raw_text: str):
    text = raw_text.strip()
    if text.startswith("```"):
        parts = text.split("```")
        for part in parts:
            cleaned = part.strip()
            if cleaned.startswith("json"):
                cleaned = cleaned[4:].strip()
            if cleaned.startswith("{") and cleaned.endswith("}"):
                text = cleaned
                break
    return json.loads(text)


def call_openai():
    api_key = os.environ["OPENAI_API_KEY"]
    models = ["gpt-4.1-mini", "gpt-4o-mini", "gpt-4.1"]
    errors = []
    for model in models:
        try:
            response = requests.post(
                "https://api.openai.com/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": model,
                    "temperature": 0.2,
                    "response_format": {"type": "json_object"},
                    "messages": [
                        {"role": "system", "content": SYSTEM_PROMPT},
                        {"role": "user", "content": user_prompt},
                    ],
                },
                timeout=TIMEOUT,
            )
            response.raise_for_status()
            payload = response.json()
            content = payload["choices"][0]["message"]["content"]
            return {
                "provider": "openai",
                "model": model,
                "raw": content,
                "parsed": parse_json_payload(content),
            }
        except Exception as exc:
            errors.append(f"{model}: {exc}")
    return {"provider": "openai", "error": errors}


def call_xai():
    api_key = os.environ["XAI_API_KEY"]
    models = ["grok-4", "grok-3-mini", "grok-3"]
    errors = []
    for model in models:
        try:
            response = requests.post(
                "https://api.x.ai/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": model,
                    "temperature": 0.2,
                    "response_format": {"type": "json_object"},
                    "messages": [
                        {"role": "system", "content": SYSTEM_PROMPT},
                        {"role": "user", "content": user_prompt},
                    ],
                },
                timeout=TIMEOUT,
            )
            response.raise_for_status()
            payload = response.json()
            content = payload["choices"][0]["message"]["content"]
            return {
                "provider": "xai",
                "model": model,
                "raw": content,
                "parsed": parse_json_payload(content),
            }
        except Exception as exc:
            errors.append(f"{model}: {exc}")
    return {"provider": "xai", "error": errors}


def call_gemini():
    api_key = os.environ["GEMINI_API_KEY"]
    models = ["gemini-2.5-flash", "gemini-2.0-flash"]
    errors = []
    for model in models:
        try:
            response = requests.post(
                f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}",
                headers={"Content-Type": "application/json"},
                json={
                    "system_instruction": {
                        "parts": [{"text": SYSTEM_PROMPT}]
                    },
                    "contents": [
                        {
                            "role": "user",
                            "parts": [{"text": user_prompt}],
                        }
                    ],
                    "generationConfig": {
                        "temperature": 0.2,
                        "responseMimeType": "application/json"
                    },
                },
                timeout=TIMEOUT,
            )
            if not response.ok:
                errors.append(f"{model}: {response.status_code} {response.text[:400]}")
                continue
            payload = response.json()
            content = payload["candidates"][0]["content"]["parts"][0]["text"]
            return {
                "provider": "gemini",
                "model": model,
                "raw": content,
                "parsed": parse_json_payload(content),
            }
        except Exception as exc:
            errors.append(f"{model}: {exc}")
    return {"provider": "gemini", "error": errors}


def main():
    started_at = time.time()
    results = {
        "brief_path": str(BRIEF_PATH),
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "results": [call_openai(), call_xai(), call_gemini()],
        "duration_seconds": round(time.time() - started_at, 2),
    }
    OUTPUT_PATH.write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")
    print(str(OUTPUT_PATH))


if __name__ == "__main__":
    main()
