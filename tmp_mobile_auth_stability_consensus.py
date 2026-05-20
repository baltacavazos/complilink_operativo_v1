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
    "current_mobile_state": {
        "shell_mode": "Capacitor currently configured with remote URL by default and local assets optional",
        "auth_ui": "native app already prioritizes email code login and hides unstable alternate login options",
        "deep_links": "basic AppUrlListener exists for appUrlOpen routing",
        "api_client": "frontend still relies on same-origin patterns in parts of the app and needs stronger native-safe origin/session handling",
    },
    "decision_needed_now": {
        "goal": "stabilize mobile login, session continuity and future-safe OAuth return handling without breaking the web app",
        "questions": [
            "What should be the safest session strategy for a Capacitor app loading a remote web app?",
            "Should API origin resolution be centralized in a runtime helper right now?",
            "How should external OAuth/browser return handling be prepared in phase 2 without overbuilding?",
            "What minimal code changes create the biggest reliability gain this round?"
        ]
    },
    "constraints": [
        "Do not rewrite auth stack from scratch",
        "Do not break existing web login behavior",
        "Prefer server-managed cookies and session continuity over token sprawl",
        "Need low-risk practical implementation for this round"
    ]
}

SYSTEM_PROMPT = (
    "You are a senior hybrid-mobile authentication architect. "
    "Answer in strict JSON only. Optimize for practical reliability, low risk, and preserving the existing web architecture."
)

USER_PROMPT = f"""
Given this project state:
{json.dumps(PROJECT_SUMMARY, ensure_ascii=False, indent=2)}

Return strict JSON with this schema:
{{
  "recommended_session_strategy": "one short sentence",
  "confidence": 0-100,
  "api_base_strategy": "same_origin_only|centralized_public_origin_helper|native_specific_absolute_api_base|mixed",
  "oauth_return_strategy": "browser_external_with_https_return|browser_external_with_custom_scheme|defer_full_oauth_until_next_round|mixed",
  "must_implement_now": ["max 6 short strings"],
  "should_avoid_now": ["max 5 short strings"],
  "continuity_risks": ["max 5 short strings"],
  "recommended_test_cases": ["max 6 short strings"],
  "implementation_order": ["max 6 short ordered steps"],
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

out_path = Path("/home/ubuntu/complilink_operativo_v1/tmp_mobile_auth_stability_consensus_results.json")
out_path.write_text(json.dumps(results, ensure_ascii=False, indent=2))
print(out_path)
