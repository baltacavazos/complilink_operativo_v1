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
    "current_mobile_state": {
        "camera_and_file_flow": "already implemented in web using input type=file and capture=environment",
        "auth": "email code login, Google OAuth, Manus OAuth; many flows still rely on window.location and same-origin web redirects",
        "api_client": "frontend currently calls /api/trpc with relative URL and credentials include",
        "store_goal": "native iOS and Android wrapper with least rework possible",
    },
    "decision_needed_now": {
        "scope": "phase 1 implementation only",
        "questions": [
            "Should Capacitor v1 load remote hosted web app or packaged local build assets first?",
            "What is the safest auth path for v1?",
            "Which plugins are truly required now versus later?",
            "What minimum code adaptations should be done this round to avoid architectural dead ends?",
        ],
    },
    "constraints": [
        "Do not rewrite to React Native",
        "Minimize risk of breaking current web app",
        "Prioritize robust infrastructure over visual work",
        "Need a practical base that can later evolve into full store submission",
        "Need a recommendation for handling OAuth and deep links sanely",
    ],
}

SYSTEM_PROMPT = (
    "You are a senior mobile architect for hybrid apps. "
    "Answer in strict JSON only. Optimize for practical delivery and low-risk architecture."
)

USER_PROMPT = f"""
Given this project state:
{json.dumps(PROJECT_SUMMARY, ensure_ascii=False, indent=2)}

Return strict JSON with this schema:
{{
  "recommended_shell_mode": "remote_url_first|local_assets_first|dual_mode",
  "confidence": 0-100,
  "reasoning_summary": "max 2 short sentences",
  "auth_v1_recommendation": "one short sentence",
  "oauth_strategy": "browser_external_with_deeplink|webview_same_origin|email_only_first|mixed",
  "required_now_plugins": ["max 6 short package names"],
  "can_keep_html_file_input_for_v1": true,
  "must_change_now": ["max 6 short strings"],
  "can_defer_until_next_round": ["max 6 short strings"],
  "main_risks": ["max 5 short strings"],
  "implementation_order": ["max 6 short ordered steps"]
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

out_path = Path("/home/ubuntu/complilink_operativo_v1/tmp_mobile_impl_consensus_results.json")
out_path.write_text(json.dumps(results, ensure_ascii=False, indent=2))
print(out_path)
