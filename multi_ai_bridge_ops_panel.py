import json
import os
import re
import time
from urllib import request, error

BASE_DIR = "/home/ubuntu/complilink_operativo_v1"
BRIEF_PATH = os.path.join(BASE_DIR, "bridge_ops_panel_multi_ai_brief.md")
OUTPUT_PATH = os.path.join(BASE_DIR, "bridge_ops_panel_multi_ai_results.json")


def read_brief():
    with open(BRIEF_PATH, "r", encoding="utf-8") as f:
        return f.read()


def extract_json(text: str):
    text = text.strip()
    if not text:
        return {"raw": text, "parse_error": "empty_response"}

    fenced = re.findall(r"```(?:json)?\s*(\{.*?\})\s*```", text, flags=re.S)
    candidates = fenced + re.findall(r"(\{.*\})", text, flags=re.S)

    for candidate in candidates:
        try:
            return json.loads(candidate)
        except Exception:
            continue

    try:
        return json.loads(text)
    except Exception:
        return {"raw": text, "parse_error": "json_not_found"}


def http_json(url, payload, headers, timeout=90):
    data = json.dumps(payload).encode("utf-8")
    req = request.Request(url, data=data, headers=headers, method="POST")
    with request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))


def call_openai(prompt):
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        return {"error": "OPENAI_API_KEY missing"}

    payload = {
        "model": "gpt-4.1-mini",
        "temperature": 0.2,
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": "Eres un arquitecto de producto y operaciones. Responde únicamente con JSON válido."},
            {"role": "user", "content": prompt},
        ],
    }
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    try:
        data = http_json("https://api.openai.com/v1/chat/completions", payload, headers)
        content = data["choices"][0]["message"]["content"]
        return {"parsed": extract_json(content), "raw": content}
    except error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="ignore")
        return {"error": f"HTTP {exc.code}", "body": body}
    except Exception as exc:
        return {"error": str(exc)}


def call_grok(prompt):
    api_key = os.environ.get("XAI_API_KEY")
    if not api_key:
        return {"error": "XAI_API_KEY missing"}

    payload = {
        "model": "grok-4-fast",
        "temperature": 0.2,
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": "Eres un arquitecto de producto y operaciones. Responde únicamente con JSON válido."},
            {"role": "user", "content": prompt},
        ],
    }
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    try:
        data = http_json("https://api.x.ai/v1/chat/completions", payload, headers)
        content = data["choices"][0]["message"]["content"]
        return {"parsed": extract_json(content), "raw": content}
    except error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="ignore")
        return {"error": f"HTTP {exc.code}", "body": body}
    except Exception as exc:
        return {"error": str(exc)}


def call_gemini(prompt):
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        return {"error": "GEMINI_API_KEY missing"}

    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}"
    payload = {
        "contents": [
            {
                "parts": [
                    {
                        "text": (
                            "Eres un arquitecto de producto y operaciones. "
                            "Responde únicamente con JSON válido siguiendo el esquema pedido.\n\n"
                            + prompt
                        )
                    }
                ]
            }
        ],
        "generationConfig": {
            "temperature": 0.2,
            "responseMimeType": "application/json",
        },
    }
    headers = {"Content-Type": "application/json"}
    try:
        data = http_json(url, payload, headers)
        content = data["candidates"][0]["content"]["parts"][0]["text"]
        return {"parsed": extract_json(content), "raw": content}
    except error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="ignore")
        return {"error": f"HTTP {exc.code}", "body": body}
    except Exception as exc:
        return {"error": str(exc)}


def main():
    brief = read_brief()
    started_at = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())

    results = {
        "started_at": started_at,
        "prompt_file": BRIEF_PATH,
        "models": {
            "openai": call_openai(brief),
            "grok": call_grok(brief),
            "gemini": call_gemini(brief),
        },
    }

    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)

    print(json.dumps({"output": OUTPUT_PATH}, ensure_ascii=False))


if __name__ == "__main__":
    main()
