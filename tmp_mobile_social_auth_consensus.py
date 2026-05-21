import json
import os
from pathlib import Path
import requests

PROJECT_SUMMARY = {
    "product": "Auditapatron",
    "current_stack": {
        "frontend": "React 19 + Vite + Wouter + Tailwind 4",
        "backend": "Express + tRPC + Node",
        "mobile_shell": "Capacitor already added with Android and iOS projects scaffolded",
    },
    "current_auth_state": {
        "email_login": "email code login already exists and was recently hardened for iPhone reliability",
        "google_oauth": "basic server-side Google OAuth flow already exists for web but not yet hardened as a full mobile social login flow",
        "apple_sign_in": "not implemented yet",
        "deep_links": "basic appUrlOpen listener exists for mobile return handling",
        "api_origin": "native-safe centralized origin handling already improved",
    },
    "decision_needed_now": {
        "goal": "implement Google login and Apple login for iPhone and Android without breaking existing email login or web login",
        "questions": [
            "What is the lowest-risk architecture for Google and Apple login in a Capacitor app that loads a remote web app?",
            "Should the mobile app use external browser auth and return by https universal link or custom scheme in this project state?",
            "How should account linking between email, Google and Apple be handled to avoid duplicate users?",
            "What minimal implementation should happen now versus what should remain as configuration work?"
        ]
    },
    "constraints": [
        "Do not rewrite the auth system from scratch",
        "Preserve current email code login as fallback",
        "Do not break existing web login flows",
        "Prefer compliance with App Store review expectations",
        "Need practical implementation order with low regression risk"
    ]
}

SYSTEM_PROMPT = (
    "You are a senior mobile authentication architect for hybrid apps. "
    "Answer in strict JSON only. Optimize for practical reliability, app-store compliance, and preserving the current web architecture."
)

USER_PROMPT = f"""
Given this project state:
{json.dumps(PROJECT_SUMMARY, ensure_ascii=False, indent=2)}

Return strict JSON with this schema:
{{
  "recommended_mobile_auth_architecture": "one short sentence",
  "confidence": 0-100,
  "google_strategy": "reuse_existing_server_oauth_with_mobile_return|native_google_sdk_bridge|mixed",
  "apple_strategy": "server_side_sign_in_with_apple|native_apple_sdk_bridge|mixed",
  "return_strategy": "https_universal_link|custom_scheme|mixed",
  "account_linking_rule": "one short sentence",
  "must_implement_now": ["max 7 short strings"],
  "must_configure_externally": ["max 7 short strings"],
  "should_avoid_now": ["max 5 short strings"],
  "main_risks": ["max 6 short strings"],
  "test_cases": ["max 7 short strings"],
  "implementation_order": ["max 8 short ordered steps"],
  "one_sentence_summary": "one short sentence"
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
            "temperature": 0.1,
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
            "temperature": 0.1,
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
            "temperature": 0.1,
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

out_path = Path("/home/ubuntu/complilink_operativo_v1/tmp_mobile_social_auth_consensus_results.json")
out_path.write_text(json.dumps(results, ensure_ascii=False, indent=2))
print(out_path)
