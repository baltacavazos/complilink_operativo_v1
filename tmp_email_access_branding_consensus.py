import json
import os
from pathlib import Path
import requests

PROJECT_SUMMARY = {
    "product": "Auditapatron",
    "reported_bug": {
        "otp_issue": "User receives a 6-digit email code, enters it promptly, and the UI says the code already expired.",
        "branding_issue": "The email/access experience still shows or sends CompliLink branding even though the active product/domain is Auditapatron.",
        "context": "Observed on real iPhone usage at auditapatron.com with a returning real user account."
    },
    "current_constraints": [
        "Do not rewrite authentication from scratch",
        "Do not break existing email login flow for returning users",
        "Need a low-risk fix in a React + Express + tRPC app",
        "Need to align public brand, email subject/sender/template copy, and in-app login copy"
    ],
    "diagnostic_questions": [
        "What are the most likely root causes when OTP emails arrive but verification says the code already expired?",
        "What code paths should be audited first in a Node/React email OTP flow?",
        "What brand sources usually drift and leave old product names in transactional emails?",
        "What minimal, high-confidence fixes should be implemented first?"
    ]
}

SYSTEM_PROMPT = (
    "You are a senior authentication and transactional-email engineer. "
    "Answer in strict JSON only. Optimize for practical debugging, low risk, and preserving the existing architecture."
)

USER_PROMPT = f"""
Given this project state:
{json.dumps(PROJECT_SUMMARY, ensure_ascii=False, indent=2)}

Return strict JSON with this schema:
{{
  "otp_root_causes": ["max 6 short strings"],
  "branding_root_causes": ["max 6 short strings"],
  "first_files_or_layers_to_audit": ["max 8 short strings"],
  "must_fix_now": ["max 6 short strings"],
  "tests_to_add": ["max 6 short strings"],
  "risk_if_unfixed": ["max 4 short strings"],
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

out_path = Path("/home/ubuntu/complilink_operativo_v1/tmp_email_access_branding_consensus_results.json")
out_path.write_text(json.dumps(results, ensure_ascii=False, indent=2))
print(out_path)
