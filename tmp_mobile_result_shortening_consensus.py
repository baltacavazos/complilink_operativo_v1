import json
import os
from pathlib import Path
import requests

PROJECT_SUMMARY = {
    "product": "Auditapatron",
    "context": {
        "platform": "iPhone inside hybrid mobile shell",
        "user_type": "anonymous user without email login",
        "problem": "post-upload result feels too long, too card-heavy, tedious, and unclear about finding and next action",
        "observed_issue": "the screen looks like a long stack of many cards, making the result hard to scan quickly"
    },
    "decision_needed_now": {
        "goal": "compress the first result so users understand it in seconds",
        "questions": [
            "What content should stay above the fold?",
            "Which blocks should be merged or collapsed first?",
            "What is the minimum useful number of visible sections on iPhone?",
            "How should the first CTA be framed in simple Mexican Spanish?"
        ]
    },
    "constraints": [
        "Do not redesign the whole app from scratch",
        "Need a low-risk iteration on the existing result page",
        "Prioritize mobile readability and trust",
        "Avoid technical jargon",
        "Keep one dominant next step"
    ]
}

SYSTEM_PROMPT = (
    "You are a senior mobile UX strategist for legal-document analysis products in Mexico. "
    "Answer in strict JSON only. Optimize for fast scanning, short screens, trust, and one dominant next step."
)

USER_PROMPT = f"""
Given this project state:
{json.dumps(PROJECT_SUMMARY, ensure_ascii=False, indent=2)}

Return strict JSON with this schema:
{{
  "primary_problem": "one short sentence",
  "confidence": 0-100,
  "recommended_visible_sections_count": 1,
  "above_the_fold": ["max 5 short strings"],
  "merge_first": ["max 6 short strings"],
  "collapse_first": ["max 6 short strings"],
  "remove_or_deemphasize": ["max 6 short strings"],
  "best_single_cta": "one short CTA in Spanish",
  "microcopy_examples": {{
    "headline": "one short Spanish headline",
    "meaning": "one short Spanish sentence",
    "next_step": "one short Spanish CTA/support sentence"
  }},
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

out_path = Path("/home/ubuntu/complilink_operativo_v1/tmp_mobile_result_shortening_consensus_results.json")
out_path.write_text(json.dumps(results, ensure_ascii=False, indent=2))
print(out_path)
