from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

import requests

BASE_DIR = Path("/home/ubuntu/complilink_operativo_v1")
OUTPUT_DIR = BASE_DIR / "audit_notes"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

SOURCES = {
    "home": Path("/home/ubuntu/page_texts/3000-igw07p7g2fg0o552njwun-6f266027.us2.manus.computer.md"),
    "auditar": Path("/home/ubuntu/page_texts/3000-igw07p7g2fg0o552njwun-6f266027.us2.manus.computer_auditar.md"),
    "ceo": Path("/home/ubuntu/page_texts/3000-igw07p7g2fg0o552njwun-6f266027.us2.manus.computer_ceo.md"),
    "audit_notes": BASE_DIR / "audit_notes" / "platform_audit_round_1.md",
}

SYSTEM_PROMPT = """Eres un auditor senior de producto y UX para una plataforma legal-operativa V1. Debes evaluar como cliente real y como revisor experto al mismo tiempo.

Restricciones obligatorias:
1. No propongas features nuevas ni aumentes complejidad.
2. Solo recomienda simplificaciones, compactación de scroll, reducción de copy redundante, mejoras de jerarquía visual y robustecimientos menores de UX.
3. Prioriza comprensión inmediata, foco en la acción principal y reducción de carga cognitiva.
4. Debes detectar repetición, exceso de bloques, demasiados CTAs o ayudas simultáneas, ambigüedad de entrada y secciones que podrían fusionarse.
5. Debes separar claramente: a) hallazgos críticos, b) hallazgos importantes, c) cambios concretos mínimos recomendados.
6. Evalúa específicamente home pública, /auditar, /acceso y Consola CEO.
7. Debes cerrar con un consenso orientado a una micro-ronda V1 de máximo impacto y mínima intervención.

Devuelve JSON estricto con esta forma:
{
  "model_name": "string",
  "overall_score": number,
  "global_summary": "string",
  "critical_findings": ["string"],
  "important_findings": ["string"],
  "page_reviews": [
    {
      "page": "home|auditar|acceso|ceo",
      "score": number,
      "strengths": ["string"],
      "frictions": ["string"],
      "minimal_changes": ["string"]
    }
  ],
  "consensus_micro_round": ["string"],
  "do_not_build": ["string"]
}
"""


def read_sources() -> dict[str, str]:
    data: dict[str, str] = {}
    for key, path in SOURCES.items():
        data[key] = path.read_text(encoding="utf-8")
    return data


def build_user_prompt() -> str:
    sources = read_sources()
    return (
        "Contexto actual del producto y auditoría interna:\n\n"
        f"[NOTAS INTERNAS]\n{sources['audit_notes']}\n\n"
        f"[HOME]\n{sources['home']}\n\n"
        f"[/AUDITAR]\n{sources['auditar']}\n\n"
        f"[/CEO]\n{sources['ceo']}\n\n"
        "Importante: la ruta /acceso actualmente parece replicar o redirigir a la home según la observación manual. Evalúa si eso genera ambigüedad.\n"
    )


def call_openai(user_prompt: str) -> dict[str, Any]:
    api_key = os.environ["OPENAI_API_KEY"]
    response = requests.post(
        "https://api.openai.com/v1/chat/completions",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json={
            "model": "gpt-4.1-mini",
            "temperature": 0.2,
            "response_format": {"type": "json_object"},
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt},
            ],
        },
        timeout=120,
    )
    response.raise_for_status()
    content = response.json()["choices"][0]["message"]["content"]
    return json.loads(content)


def call_grok(user_prompt: str) -> dict[str, Any]:
    api_key = os.environ["XAI_API_KEY"]
    response = requests.post(
        "https://api.x.ai/v1/chat/completions",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json={
            "model": "grok-3-mini",
            "temperature": 0.2,
            "response_format": {"type": "json_object"},
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt},
            ],
        },
        timeout=120,
    )
    response.raise_for_status()
    content = response.json()["choices"][0]["message"]["content"]
    return json.loads(content)


def call_gemini(user_prompt: str) -> dict[str, Any]:
    api_key = os.environ["GEMINI_API_KEY"]
    schema = {
        "type": "OBJECT",
        "properties": {
            "model_name": {"type": "STRING"},
            "overall_score": {"type": "NUMBER"},
            "global_summary": {"type": "STRING"},
            "critical_findings": {"type": "ARRAY", "items": {"type": "STRING"}},
            "important_findings": {"type": "ARRAY", "items": {"type": "STRING"}},
            "page_reviews": {
                "type": "ARRAY",
                "items": {
                    "type": "OBJECT",
                    "properties": {
                        "page": {"type": "STRING"},
                        "score": {"type": "NUMBER"},
                        "strengths": {"type": "ARRAY", "items": {"type": "STRING"}},
                        "frictions": {"type": "ARRAY", "items": {"type": "STRING"}},
                        "minimal_changes": {"type": "ARRAY", "items": {"type": "STRING"}},
                    },
                    "required": ["page", "score", "strengths", "frictions", "minimal_changes"],
                },
            },
            "consensus_micro_round": {"type": "ARRAY", "items": {"type": "STRING"}},
            "do_not_build": {"type": "ARRAY", "items": {"type": "STRING"}},
        },
        "required": [
            "model_name",
            "overall_score",
            "global_summary",
            "critical_findings",
            "important_findings",
            "page_reviews",
            "consensus_micro_round",
            "do_not_build",
        ],
    }
    candidate_models = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"]
    last_error: Exception | None = None
    for model_name in candidate_models:
        try:
            response = requests.post(
                f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={api_key}",
                headers={"Content-Type": "application/json"},
                json={
                    "system_instruction": {"parts": [{"text": SYSTEM_PROMPT}]},
                    "contents": [{"parts": [{"text": user_prompt}]}],
                    "generationConfig": {
                        "temperature": 0.2,
                        "responseMimeType": "application/json",
                        "responseSchema": schema,
                    },
                },
                timeout=120,
            )
            response.raise_for_status()
            content = response.json()["candidates"][0]["content"]["parts"][0]["text"]
            parsed = json.loads(content)
            parsed.setdefault("model_name", model_name)
            return parsed
        except Exception as exc:
            last_error = exc
            continue
    if last_error is None:
        raise RuntimeError("Gemini no devolvió respuesta y no se capturó error")
    raise last_error


def main() -> None:
    user_prompt = build_user_prompt()
    results = {
        "openai": call_openai(user_prompt),
        "grok": call_grok(user_prompt),
        "gemini": call_gemini(user_prompt),
    }
    out_path = OUTPUT_DIR / "multiai_platform_audit_raw.json"
    out_path.write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")
    print(str(out_path))


if __name__ == "__main__":
    main()
