import json
import os
from pathlib import Path
import requests

PROJECT_SUMMARY = {
    "product": "Auditapatron",
    "current_stack": {
        "frontend": "React 19 + Vite + Wouter + Tailwind 4",
        "backend": "Express + tRPC + Node",
        "tests": ["Vitest", "Playwright"],
    },
    "current_status": {
        "mobile_web": "already optimized heavily for workers in Mexico",
        "key_flows": [
            "landing to audit CTA",
            "document upload from mobile",
            "first reading without account",
            "email access to continue later",
            "whatsapp continuation after first reading",
        ],
        "document_inputs": ["camera photo", "gallery file", "pdf upload"],
    },
    "goal": "Turn the current platform into an iOS and Android app with the least rework and best practical speed.",
    "constraints": [
        "Preserve current web investment as much as possible",
        "Prioritize mobile UX over visual novelty",
        "Need publishable path for App Store and Google Play",
        "Need camera, file upload, session continuity, and simple auth to work reliably",
    ],
}

SYSTEM_PROMPT = (
    "You are a senior mobile product architect. "
    "Answer in concise JSON only. Recommend the best path to turn an existing React/Vite web app into iOS and Android apps. "
    "You must weigh PWA vs Capacitor vs React Native rewrite."
)

USER_PROMPT = f"""
Evaluate the best path for this project:
{json.dumps(PROJECT_SUMMARY, ensure_ascii=False, indent=2)}

Return strict JSON with this schema:
{{
  "recommended_path": "one short sentence",
  "priority": "PWA|Capacitor|React Native rewrite|Hybrid staged approach",
  "confidence": 0-100,
  "why_now": ["3 short strings max"],
  "main_risks": ["3 short strings max"],
  "must_do_before_store_release": ["5 short strings max"],
  "phase_1": ["4 short strings max"],
  "phase_2": ["4 short strings max"],
  "phase_3": ["4 short strings max"],
  "avoid": ["3 short strings max"]
}}
""".strip()


def post_json(url, headers, payload):
    r = requests.post(url, headers=headers, json=payload, timeout=120)
    r.raise_for_status()
    return r.json()


def try_parse_json(text):
    text = text.strip()
    if text.startswith("```"):
        text = text.strip("`")
        if text.startswith("json"):
            text = text[4:].strip()
    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end != -1 and end > start:
        text = text[start:end+1]
    return json.loads(text)


def ask_openai():
    key = os.environ.get("OPENAI_API_KEY")
    if not key:
        return {"error": "missing OPENAI_API_KEY"}
    data = post_json(
        "https://api.openai.com/v1/chat/completions",
        {"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
        {
            "model": "gpt-4.1-mini",
            "temperature": 0.2,
            "response_format": {"type": "json_object"},
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": USER_PROMPT},
            ],
        },
    )
    return try_parse_json(data["choices"][0]["message"]["content"])


def ask_grok():
    key = os.environ.get("XAI_API_KEY")
    if not key:
        return {"error": "missing XAI_API_KEY"}
    data = post_json(
        "https://api.x.ai/v1/chat/completions",
        {"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
        {
            "model": "grok-4-fast-reasoning",
            "temperature": 0.2,
            "response_format": {"type": "json_object"},
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": USER_PROMPT},
            ],
        },
    )
    return try_parse_json(data["choices"][0]["message"]["content"])


def ask_gemini():
    key = os.environ.get("GEMINI_API_KEY")
    if not key:
        return {"error": "missing GEMINI_API_KEY"}
    url = (
        "https://generativelanguage.googleapis.com/v1beta/models/"
        "gemini-2.5-flash:generateContent?key=" + key
    )
    payload = {
        "generationConfig": {
            "temperature": 0.2,
            "responseMimeType": "application/json",
        },
        "contents": [
            {
                "role": "user",
                "parts": [{"text": SYSTEM_PROMPT + "\n\n" + USER_PROMPT}],
            }
        ],
    }
    data = post_json(url, {"Content-Type": "application/json"}, payload)
    text = data["candidates"][0]["content"]["parts"][0]["text"]
    return try_parse_json(text)


results = {}
for name, fn in [("chatgpt", ask_openai), ("grok", ask_grok), ("gemini", ask_gemini)]:
    try:
        results[name] = fn()
    except Exception as exc:
        results[name] = {"error": str(exc)}

out_path = Path("/home/ubuntu/complilink_operativo_v1/tmp_mobile_strategy_consensus_results.json")
out_path.write_text(json.dumps(results, ensure_ascii=False, indent=2))
print(out_path)
