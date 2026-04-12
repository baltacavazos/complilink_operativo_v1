import json
import os
import sys
from urllib import request, error

PROMPT = sys.argv[1] if len(sys.argv) > 1 else ""
if not PROMPT:
    raise SystemExit("Prompt argument required")

results = {}


def post_json(url: str, headers: dict[str, str], payload: dict) -> dict:
    data = json.dumps(payload).encode("utf-8")
    req = request.Request(url, data=data, headers=headers, method="POST")
    with request.urlopen(req, timeout=90) as resp:
        body = resp.read().decode("utf-8")
        return json.loads(body)


openai_key = os.environ.get("OPENAI_API_KEY")
if openai_key:
    try:
        response = post_json(
            "https://api.openai.com/v1/chat/completions",
            {
                "Authorization": f"Bearer {openai_key}",
                "Content-Type": "application/json",
            },
            {
                "model": "gpt-4.1-mini",
                "temperature": 0.2,
                "messages": [
                    {
                        "role": "system",
                        "content": "Eres un arquitecto técnico senior. Responde solo en JSON válido.",
                    },
                    {"role": "user", "content": PROMPT},
                ],
                "response_format": {
                    "type": "json_schema",
                    "json_schema": {
                        "name": "strategy_review",
                        "strict": True,
                        "schema": {
                            "type": "object",
                            "properties": {
                                "recommended_approach": {"type": "string"},
                                "thresholds": {
                                    "type": "array",
                                    "items": {"type": "string"},
                                },
                                "where_to_hook": {
                                    "type": "array",
                                    "items": {"type": "string"},
                                },
                                "risk_notes": {
                                    "type": "array",
                                    "items": {"type": "string"},
                                },
                                "tests": {
                                    "type": "array",
                                    "items": {"type": "string"},
                                },
                            },
                            "required": [
                                "recommended_approach",
                                "thresholds",
                                "where_to_hook",
                                "risk_notes",
                                "tests",
                            ],
                            "additionalProperties": False,
                        },
                    },
                },
            },
        )
        content = response["choices"][0]["message"]["content"]
        results["openai"] = json.loads(content)
    except Exception as exc:  # noqa: BLE001
        results["openai"] = {"error": str(exc)}
else:
    results["openai"] = {"error": "OPENAI_API_KEY missing"}


gemini_key = os.environ.get("GEMINI_API_KEY")
if gemini_key:
    try:
        response = post_json(
            f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={gemini_key}",
            {"Content-Type": "application/json"},
            {
                "systemInstruction": {
                    "parts": [
                        {"text": "Eres un arquitecto técnico senior. Responde solo JSON válido siguiendo el esquema pedido."}
                    ]
                },
                "contents": [{"parts": [{"text": PROMPT}]}],
                "generationConfig": {
                    "temperature": 0.2,
                    "responseMimeType": "application/json",
                    "responseSchema": {
                        "type": "OBJECT",
                        "properties": {
                            "recommended_approach": {"type": "STRING"},
                            "thresholds": {"type": "ARRAY", "items": {"type": "STRING"}},
                            "where_to_hook": {"type": "ARRAY", "items": {"type": "STRING"}},
                            "risk_notes": {"type": "ARRAY", "items": {"type": "STRING"}},
                            "tests": {"type": "ARRAY", "items": {"type": "STRING"}},
                        },
                        "required": [
                            "recommended_approach",
                            "thresholds",
                            "where_to_hook",
                            "risk_notes",
                            "tests",
                        ],
                    },
                },
            },
        )
        text = response["candidates"][0]["content"]["parts"][0]["text"]
        results["gemini"] = json.loads(text)
    except Exception as exc:  # noqa: BLE001
        results["gemini"] = {"error": str(exc)}
else:
    results["gemini"] = {"error": "GEMINI_API_KEY missing"}


grok_key = os.environ.get("XAI_API_KEY")
if grok_key:
    try:
        response = post_json(
            "https://api.x.ai/v1/chat/completions",
            {
                "Authorization": f"Bearer {grok_key}",
                "Content-Type": "application/json",
            },
            {
                "model": "grok-4-fast-non-reasoning",
                "temperature": 0.2,
                "messages": [
                    {
                        "role": "system",
                        "content": "Eres un arquitecto técnico senior. Responde solo en JSON válido con las claves pedidas.",
                    },
                    {"role": "user", "content": PROMPT},
                ],
                "response_format": {
                    "type": "json_schema",
                    "json_schema": {
                        "name": "strategy_review",
                        "schema": {
                            "type": "object",
                            "properties": {
                                "recommended_approach": {"type": "string"},
                                "thresholds": {"type": "array", "items": {"type": "string"}},
                                "where_to_hook": {"type": "array", "items": {"type": "string"}},
                                "risk_notes": {"type": "array", "items": {"type": "string"}},
                                "tests": {"type": "array", "items": {"type": "string"}},
                            },
                            "required": [
                                "recommended_approach",
                                "thresholds",
                                "where_to_hook",
                                "risk_notes",
                                "tests",
                            ],
                            "additionalProperties": False,
                        },
                    },
                },
            },
        )
        content = response["choices"][0]["message"]["content"]
        results["grok"] = json.loads(content)
    except Exception as exc:  # noqa: BLE001
        results["grok"] = {"error": str(exc)}
else:
    results["grok"] = {"error": "XAI_API_KEY missing"}

print(json.dumps(results, ensure_ascii=False, indent=2))
