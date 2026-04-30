import json
import os
import time
from pathlib import Path

import requests

PROJECT_DIR = Path("/home/ubuntu/complilink_operativo_v1")
INPUT_PATH = PROJECT_DIR / ".manus-notes" / "ceo_hybrid_view_consensus.json"
OUTPUT_PATH = PROJECT_DIR / ".manus-notes" / "ceo_hybrid_view_consensus_retry.json"

source = json.loads(INPUT_PATH.read_text(encoding="utf-8"))
PROMPT = source["prompt"]
existing = {item.get("provider"): item for item in source.get("responses", [])}


def call_grok():
    api_key = os.environ.get("XAI_API_KEY")
    if not api_key:
        return {"provider": "grok", "error": "XAI_API_KEY missing"}
    last_error = None
    for model in ["grok-3-mini", "grok-2-1212"]:
        for wait_seconds in [1, 3, 6]:
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
                            {"role": "system", "content": "Eres un arquitecto de producto y UX. Responde solo JSON válido."},
                            {"role": "user", "content": PROMPT},
                        ],
                    },
                    timeout=90,
                )
                response.raise_for_status()
                data = response.json()
                content = data["choices"][0]["message"]["content"]
                return {"provider": "grok", "model": model, "raw": content, "parsed": json.loads(content)}
            except Exception as exc:
                last_error = f"{type(exc).__name__}: {exc}"
                time.sleep(wait_seconds)
    return {"provider": "grok", "error": last_error or "unknown error"}


def call_gemini():
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        return {"provider": "gemini", "error": "GEMINI_API_KEY missing"}
    last_error = None
    for model in ["gemini-2.5-flash", "gemini-2.0-flash"]:
        for wait_seconds in [1, 3, 6]:
            try:
                response = requests.post(
                    f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}",
                    headers={"Content-Type": "application/json"},
                    json={
                        "generationConfig": {
                            "temperature": 0.2,
                            "responseMimeType": "application/json",
                        },
                        "systemInstruction": {
                            "parts": [{"text": "Eres un arquitecto de producto y UX. Responde solo JSON válido."}]
                        },
                        "contents": [
                            {
                                "role": "user",
                                "parts": [{"text": PROMPT}],
                            }
                        ],
                    },
                    timeout=90,
                )
                response.raise_for_status()
                data = response.json()
                content = data["candidates"][0]["content"]["parts"][0]["text"]
                return {"provider": "gemini", "model": model, "raw": content, "parsed": json.loads(content)}
            except Exception as exc:
                last_error = f"{type(exc).__name__}: {exc}"
                time.sleep(wait_seconds)
    return {"provider": "gemini", "error": last_error or "unknown error"}


responses = []
responses.append(existing.get("openai", {"provider": "openai", "error": "missing prior openai response"}))
responses.append(call_grok())
responses.append(call_gemini())

result = {
    "prompt": PROMPT,
    "responses": responses,
}

OUTPUT_PATH.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(str(OUTPUT_PATH))
