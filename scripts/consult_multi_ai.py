#!/usr/bin/env python3
import json
import os
import sys
from pathlib import Path

import requests


def load_prompt() -> str:
    if len(sys.argv) > 1:
        candidate = Path(sys.argv[1])
        if candidate.exists():
            return candidate.read_text(encoding="utf-8")
        return sys.argv[1]
    raise SystemExit("Uso: consult_multi_ai.py <prompt_o_ruta_prompt>")


def call_openai(prompt: str):
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        return {"provider": "chatgpt", "ok": False, "error": "OPENAI_API_KEY no disponible"}
    response = requests.post(
        "https://api.openai.com/v1/chat/completions",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json={
            "model": "gpt-4.1-mini",
            "temperature": 0.2,
            "messages": [
                {
                    "role": "system",
                    "content": "Eres un arquitecto de producto y plataforma. Responde en español con: prioridad recomendada, rationale, riesgos, esfuerzo estimado y sugerencia concreta de implementación.",
                },
                {"role": "user", "content": prompt},
            ],
        },
        timeout=90,
    )
    data = response.json()
    if response.status_code >= 400:
        return {"provider": "chatgpt", "ok": False, "status": response.status_code, "error": data}
    content = data["choices"][0]["message"]["content"]
    return {"provider": "chatgpt", "ok": True, "model": data.get("model"), "content": content}


def call_grok(prompt: str):
    api_key = os.environ.get("XAI_API_KEY")
    if not api_key:
        return {"provider": "grok", "ok": False, "error": "XAI_API_KEY no disponible"}
    response = requests.post(
        "https://api.x.ai/v1/chat/completions",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json={
            "model": "grok-3-mini",
            "temperature": 0.2,
            "messages": [
                {
                    "role": "system",
                    "content": "Eres un arquitecto de producto y plataforma. Responde en español con: prioridad recomendada, rationale, riesgos, esfuerzo estimado y sugerencia concreta de implementación.",
                },
                {"role": "user", "content": prompt},
            ],
        },
        timeout=90,
    )
    data = response.json()
    if response.status_code >= 400:
        return {"provider": "grok", "ok": False, "status": response.status_code, "error": data}
    content = data["choices"][0]["message"]["content"]
    return {"provider": "grok", "ok": True, "model": data.get("model"), "content": content}


def call_gemini(prompt: str):
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        return {"provider": "gemini", "ok": False, "error": "GEMINI_API_KEY no disponible"}
    response = requests.post(
        f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}",
        headers={"Content-Type": "application/json"},
        json={
            "system_instruction": {
                "parts": [
                    {
                        "text": "Eres un arquitecto de producto y plataforma. Responde en español con: prioridad recomendada, rationale, riesgos, esfuerzo estimado y sugerencia concreta de implementación."
                    }
                ]
            },
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {"temperature": 0.2},
        },
        timeout=90,
    )
    data = response.json()
    if response.status_code >= 400:
        return {"provider": "gemini", "ok": False, "status": response.status_code, "error": data}
    candidates = data.get("candidates") or []
    parts = (((candidates[0] if candidates else {}).get("content") or {}).get("parts") or [])
    content = "\n".join(part.get("text", "") for part in parts if isinstance(part, dict)).strip()
    return {"provider": "gemini", "ok": True, "model": "gemini-2.5-flash", "content": content, "raw": data}


def main():
    prompt = load_prompt()
    results = {
        "prompt": prompt,
        "results": [
            call_openai(prompt),
            call_grok(prompt),
            call_gemini(prompt),
        ],
    }
    print(json.dumps(results, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
