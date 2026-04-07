from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

import requests

PROJECT_ROOT = Path("/home/ubuntu/complilink_operativo_v1")
HOME_FILE = PROJECT_ROOT / "client/src/pages/Home.tsx"
OUTPUT_FILE = PROJECT_ROOT / "tri_ai_hero_pills_audit.json"
TIMEOUT = 90


def read_range(path: Path, start: int, end: int) -> str:
    lines = path.read_text(encoding="utf-8").splitlines()
    selected = lines[start - 1 : end]
    numbered = [f"{i}: {line}" for i, line in enumerate(selected, start=start)]
    return "\n".join(numbered)


home_excerpt = "\n\n".join(
    [
        "[HEADER]\n" + read_range(HOME_FILE, 168, 255),
        "[HERO]\n" + read_range(HOME_FILE, 274, 310),
        "[BENEFIT_PILLS]\n" + read_range(HOME_FILE, 381, 394),
    ]
)

PROMPT = f"""
Eres un director de producto, UX writer y diseñador senior muy exigente.

Analiza este hero de una web llamada AuditaPatron. La interfaz está orientada a trabajadores en México. Quiero saber si las píldoras del hero realmente aportan valor visible o si solo ocupan espacio. Una de ellas dice 'Hecho para celular'.

Tu objetivo:
1. Evaluar si cada píldora comunica un beneficio claro y verificable.
2. Decidir si 'Hecho para celular' debe eliminarse, reescribirse o sustituirse.
3. Proponer la versión más útil y más limpia del grupo completo de píldoras.
4. Pensar mobile-first y también en primera impresión desktop.

Restricciones:
- No uses lenguaje interno, técnico ni abstracto.
- Prioriza claridad, utilidad real y reducción de ruido visual.
- Si un elemento no aporta valor concreto, recomiéndalo eliminar.
- Responde SOLO JSON válido.

Devuelve este esquema exacto:
{{
  "overall_verdict": "texto breve",
  "pills_assessment": [
    {{
      "pill": "texto exacto",
      "value_score": 1,
      "verdict": "keep|rewrite|remove|replace",
      "why": "texto breve",
      "better_option": "texto breve o vacío"
    }}
  ],
  "group_decision": {{
    "recommended_count": 0,
    "why": "texto breve",
    "best_strategy": "texto breve"
  }},
  "recommended_pills": ["texto 1", "texto 2", "texto 3"],
  "hero_cleanup": ["ajuste 1", "ajuste 2", "ajuste 3"],
  "confidence": "high|medium|low"
}}

Extracto actual:
{home_excerpt}
""".strip()


def extract_json(text: str) -> dict[str, Any]:
    text = text.strip()
    if text.startswith("```"):
        text = text.strip("`")
        if text.startswith("json"):
            text = text[4:].strip()
    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end == -1 or end <= start:
        raise ValueError(f"No se encontró un objeto JSON válido: {text[:500]}")
    return json.loads(text[start:end + 1])


def call_openai(prompt: str) -> dict[str, Any]:
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        return {"error": "OPENAI_API_KEY no disponible"}
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
                {"role": "system", "content": "Responde únicamente JSON válido."},
                {"role": "user", "content": prompt},
            ],
        },
        timeout=TIMEOUT,
    )
    response.raise_for_status()
    payload = response.json()
    content = payload["choices"][0]["message"]["content"]
    return extract_json(content)


def call_gemini(prompt: str) -> dict[str, Any]:
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        return {"error": "GEMINI_API_KEY no disponible"}
    response = requests.post(
        f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}",
        headers={"Content-Type": "application/json"},
        json={
            "contents": [{"role": "user", "parts": [{"text": prompt}]}],
            "generationConfig": {"temperature": 0.2, "responseMimeType": "application/json"},
        },
        timeout=TIMEOUT,
    )
    response.raise_for_status()
    payload = response.json()
    content = payload["candidates"][0]["content"]["parts"][0]["text"]
    return extract_json(content)


def call_grok(prompt: str) -> dict[str, Any]:
    api_key = os.environ.get("XAI_API_KEY")
    if not api_key:
        return {"error": "XAI_API_KEY no disponible"}
    response = requests.post(
        "https://api.x.ai/v1/chat/completions",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json={
            "model": "grok-4",
            "temperature": 0.2,
            "messages": [
                {"role": "system", "content": "Responde únicamente JSON válido."},
                {"role": "user", "content": prompt},
            ],
        },
        timeout=TIMEOUT,
    )
    response.raise_for_status()
    payload = response.json()
    content = payload["choices"][0]["message"]["content"]
    return extract_json(content)


def main() -> None:
    results: dict[str, Any] = {
        "prompt_version": "hero_pills_audit_v1",
        "source": str(HOME_FILE),
        "models": {},
    }
    for name, fn in (("chatgpt", call_openai), ("gemini", call_gemini), ("grok", call_grok)):
        try:
            results["models"][name] = fn(PROMPT)
        except Exception as exc:  # noqa: BLE001
            results["models"][name] = {"error": f"{type(exc).__name__}: {exc}"}

    OUTPUT_FILE.write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")
    print(str(OUTPUT_FILE))


if __name__ == "__main__":
    main()
