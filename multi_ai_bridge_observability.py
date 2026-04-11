import json
import os
import time
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parent
BRIEF_PATH = ROOT / "bridge_observability_multi_ai_brief.md"
OUTPUT_PATH = ROOT / "bridge_observability_multi_ai_results.json"

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
XAI_API_KEY = os.getenv("XAI_API_KEY")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

SYSTEM_PROMPT = (
    "Eres un arquitecto senior de integración backend y observabilidad pragmática. "
    "Debes responder en JSON válido, breve pero específico, sin markdown adicional."
)

SCHEMA_HINT = {
    "top_risks": ["string"],
    "minimum_service_changes": ["string"],
    "result_shape_changes": ["string"],
    "smoke_test_guardrails": ["string"],
    "tests_to_add": ["string"],
    "do_not_change": ["string"],
    "confidence": "high|medium|low",
}


def load_brief() -> str:
    return BRIEF_PATH.read_text(encoding="utf-8")



def normalize_json_text(text: str):
    text = text.strip()
    if text.startswith("```"):
        parts = text.split("```")
        for part in parts:
            part = part.strip()
            if part and not part.lower().startswith("json"):
                text = part
                break
        if text.lower().startswith("json"):
            text = text[4:].strip()
    return json.loads(text)



def call_openai(brief: str):
    if not OPENAI_API_KEY:
        return {"error": "OPENAI_API_KEY missing"}

    response = requests.post(
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
                {"role": "system", "content": SYSTEM_PROMPT},
                {
                    "role": "user",
                    "content": (
                        f"Sigue este esquema JSON: {json.dumps(SCHEMA_HINT, ensure_ascii=False)}\n\n"
                        f"Brief:\n{brief}"
                    ),
                },
            ],
        },
        timeout=120,
    )
    response.raise_for_status()
    data = response.json()
    content = data["choices"][0]["message"]["content"]
    return normalize_json_text(content)



def call_grok(brief: str):
    if not XAI_API_KEY:
        return {"error": "XAI_API_KEY missing"}

    response = requests.post(
        "https://api.x.ai/v1/chat/completions",
        headers={
            "Authorization": f"Bearer {XAI_API_KEY}",
            "Content-Type": "application/json",
        },
        json={
            "model": "grok-4-fast-reasoning",
            "temperature": 0.2,
            "response_format": {"type": "json_object"},
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {
                    "role": "user",
                    "content": (
                        f"Sigue este esquema JSON: {json.dumps(SCHEMA_HINT, ensure_ascii=False)}\n\n"
                        f"Brief:\n{brief}"
                    ),
                },
            ],
        },
        timeout=120,
    )
    response.raise_for_status()
    data = response.json()
    content = data["choices"][0]["message"]["content"]
    return normalize_json_text(content)



def call_gemini(brief: str):
    if not GEMINI_API_KEY:
        return {"error": "GEMINI_API_KEY missing"}

    prompt = (
        f"{SYSTEM_PROMPT}\n\n"
        f"Devuelve solo JSON válido siguiendo este esquema: {json.dumps(SCHEMA_HINT, ensure_ascii=False)}\n\n"
        f"Brief:\n{brief}"
    )
    response = requests.post(
        f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={GEMINI_API_KEY}",
        headers={"Content-Type": "application/json"},
        json={
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {
                "temperature": 0.2,
                "responseMimeType": "application/json",
            },
        },
        timeout=120,
    )
    response.raise_for_status()
    data = response.json()
    content = data["candidates"][0]["content"]["parts"][0]["text"]
    return normalize_json_text(content)



def main():
    brief = load_brief()
    started_at = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    output = {
        "started_at": started_at,
        "brief_path": str(BRIEF_PATH),
        "models": {},
    }

    for name, fn in (("openai", call_openai), ("grok", call_grok), ("gemini", call_gemini)):
        try:
            output["models"][name] = {"ok": True, "result": fn(brief)}
        except Exception as exc:  # noqa: BLE001
            output["models"][name] = {"ok": False, "error": str(exc)}

    OUTPUT_PATH.write_text(json.dumps(output, ensure_ascii=False, indent=2), encoding="utf-8")
    print(str(OUTPUT_PATH))


if __name__ == "__main__":
    main()
