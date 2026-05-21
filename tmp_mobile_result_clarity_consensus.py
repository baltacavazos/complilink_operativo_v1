import json
import os
from pathlib import Path
import requests

PROJECT_SUMMARY = {
    "product": "Auditapatron",
    "current_context": {
        "platform": "iPhone inside hybrid mobile shell",
        "user_type": "anonymous user without email login",
        "recent_action": "user uploaded a test document",
        "reported_problem": "after upload, the result was not clear; user could not quickly understand what was found, what it means, or what to do next",
        "screen_observation": "the post-upload experience appears as a long vertical sequence of cards/sections, with no obvious single summary block, no dominant finding, and no prominent next-step call to action near the top"
    },
    "decision_needed_now": {
        "goal": "make the first mobile result understandable in seconds for an anonymous user",
        "questions": [
            "What should the first visible summary block contain?",
            "How should the main finding be explained in simple Spanish for Mexico?",
            "What is the best single next-step CTA after a first result?",
            "How can a long audit result be reorganized without rewriting the whole product?"
        ]
    },
    "constraints": [
        "Do not redesign the whole flow from scratch",
        "Prioritize iPhone/mobile readability",
        "Keep the result trustworthy and easy to understand",
        "Avoid technical jargon and internal engine language",
        "Need low-risk practical implementation this round"
    ]
}

SYSTEM_PROMPT = (
    "You are a senior mobile UX strategist for legal-document analysis products in Mexico. "
    "Answer in strict JSON only. Optimize for clarity in under 5 seconds, trust, and a single obvious next step."
)

USER_PROMPT = f"""
Given this project state:
{json.dumps(PROJECT_SUMMARY, ensure_ascii=False, indent=2)}

Return strict JSON with this schema:
{{
  "primary_problem": "one short sentence",
  "confidence": 0-100,
  "recommended_information_hierarchy": ["max 6 short strings in order"],
  "hero_summary_fields": ["max 6 short strings"],
  "main_finding_style": "status_chip_plus_plain_language|headline_plus_explanation|score_plus_explanation|mixed",
  "best_next_cta": "one short CTA in Spanish",
  "must_implement_now": ["max 6 short strings"],
  "should_defer": ["max 5 short strings"],
  "microcopy_examples": {{
    "headline": "one short Spanish headline",
    "finding": "one short Spanish sentence",
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

out_path = Path("/home/ubuntu/complilink_operativo_v1/tmp_mobile_result_clarity_consensus_results.json")
out_path.write_text(json.dumps(results, ensure_ascii=False, indent=2))
print(out_path)
