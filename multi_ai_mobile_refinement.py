from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

import requests

PROJECT_ROOT = Path("/home/ubuntu/complilink_operativo_v1")
HOME_FILE = PROJECT_ROOT / "client/src/pages/Home.tsx"
AUDITAR_FILE = PROJECT_ROOT / "client/src/pages/Auditar.tsx"
OUTPUT_FILE = PROJECT_ROOT / "tri_ai_mobile_round2_output.json"
TIMEOUT = 90


def read_range(path: Path, start: int, end: int) -> str:
    lines = path.read_text(encoding="utf-8").splitlines()
    start_idx = max(start - 1, 0)
    end_idx = min(end, len(lines))
    selected = lines[start_idx:end_idx]
    numbered = [f"{i}: {line}" for i, line in enumerate(selected, start=start)]
    return "\n".join(numbered)


home_excerpt = "\n\n".join(
    [
        "[HOME_HEADER_HERO]\n" + read_range(HOME_FILE, 165, 365),
        "[HOME_QUICK_TRUST]\n" + read_range(HOME_FILE, 369, 383),
    ]
)

auditar_excerpt = "\n\n".join(
    [
        "[AUDITAR_INTRO]\n" + read_range(AUDITAR_FILE, 618, 653),
        "[AUDITAR_DOSSIER_SUMMARY]\n" + read_range(AUDITAR_FILE, 694, 706),
        "[AUDITAR_UPLOAD_CONTEXT]\n" + read_range(AUDITAR_FILE, 748, 891),
        "[AUDITAR_LAST_RESULT]\n" + read_range(AUDITAR_FILE, 933, 1090),
        "[AUDITAR_NEXT_DOC]\n" + read_range(AUDITAR_FILE, 1288, 1324),
    ]
)

PROMPT = f"""
Eres un director de producto y UX writer senior. Analiza estos extractos de una web llamada Auditapatron orientada a trabajadores en México.

Objetivo de esta ronda:
1. Hacer el header móvil todavía más corto y útil.
2. Simplificar el bloque de beneficios/hero para que el primer scroll en celular sea más rápido.
3. Simplificar el módulo 'Resultado del último documento' en /auditar para que el siguiente paso destaque antes y con menos carga visual.

Restricciones:
- Mantén el tono humano, protector, claro y no técnico.
- No uses lenguaje legalista, interno ni de diseño.
- No cambies la esencia del producto.
- Piensa mobile-first.
- Responde SOLO JSON válido.

Devuelve este esquema exacto:
{{
  "overall_verdict": "texto breve",
  "header_mobile": {{
    "decision": "texto breve",
    "why": "texto breve",
    "changes": ["cambio 1", "cambio 2", "cambio 3"],
    "suggested_copy": {{
      "brand_subtitle": "texto corto",
      "primary_cta": "texto corto",
      "secondary_cta": "texto corto o vacío"
    }}
  }},
  "home_benefits": {{
    "decision": "texto breve",
    "why": "texto breve",
    "changes": ["cambio 1", "cambio 2", "cambio 3"],
    "suggested_copy": {{
      "eyebrow": "texto corto",
      "headline": "texto corto",
      "supporting_text": "texto corto",
      "benefit_items": ["item 1", "item 2", "item 3"]
    }}
  }},
  "auditar_results": {{
    "decision": "texto breve",
    "why": "texto breve",
    "changes": ["cambio 1", "cambio 2", "cambio 3", "cambio 4"],
    "suggested_copy": {{
      "section_title": "texto corto",
      "empty_state": "texto corto",
      "confirmed_title": "texto corto",
      "estimated_title": "texto corto",
      "next_step_title": "texto corto",
      "next_step_text": "texto corto"
    }}
  }},
  "priority_order": ["1", "2", "3"],
  "confidence": "high|medium|low"
}}

Extractos de Home:
{home_excerpt}

Extractos de /auditar:
{auditar_excerpt}
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
        raise ValueError(f"No se encontró un objeto JSON válido en la respuesta: {text[:500]}")
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
            "temperature": 0.3,
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
            "contents": [
                {
                    "role": "user",
                    "parts": [{"text": prompt}],
                }
            ],
            "generationConfig": {
                "temperature": 0.3,
                "responseMimeType": "application/json",
            },
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
            "temperature": 0.3,
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
        "prompt_version": "round2_mobile_refinement_v1",
        "sources": {
            "home": str(HOME_FILE),
            "auditar": str(AUDITAR_FILE),
        },
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
