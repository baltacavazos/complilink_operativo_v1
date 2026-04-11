#!/usr/bin/env python3
import json
import os
from pathlib import Path

import requests

PROJECT_CONTEXT = {
    "app": "CompliLink / AuditaPatron",
    "constraint": "No agregar nuevas funcionalidades; solo estabilidad y correcciones estrictamente necesarias.",
    "recent_changes": [
        "Usuario propietario como CEO maestro",
        "Modo seguro 'ver como usuario' para demos",
        "Pruebas unitarias y E2E ya añadidas",
        "Ajustes previos en autenticación E2E y cookies en desarrollo"
    ],
    "target_review": [
        "permisos y guardas",
        "sesiones y cookies",
        "exportes",
        "flujo de acceso",
        "conmutación CEO ↔ vista usuario",
        "expediente / flujo operativo crítico"
    ]
}

PROMPT = f"""
Eres un revisor técnico senior. Analiza el siguiente estado de producto y responde SOLO con JSON válido.

Contexto:
{json.dumps(PROJECT_CONTEXT, ensure_ascii=False, indent=2)}

Objetivo:
Definir exclusivamente qué validaciones y correcciones son estrictamente necesarias en una ronda final de endurecimiento, evitando sugerir features nuevas.

Devuelve este esquema exacto:
{{
  "critical_checks": ["string", "string"],
  "likely_regressions": ["string", "string"],
  "do_not_touch": ["string", "string"],
  "minimum_exit_criteria": ["string", "string"],
  "overall_priority": "string"
}}
""".strip()


def safe_json_loads(text: str):
    text = text.strip()
    if text.startswith("```"):
        parts = text.split("```")
        for part in parts:
            part = part.strip()
            if part.startswith("json"):
                part = part[4:].strip()
            if part.startswith("{") and part.endswith("}"):
                text = part
                break
    return json.loads(text)


def call_openai():
    key = os.environ.get("OPENAI_API_KEY")
    if not key:
        return {"error": "OPENAI_API_KEY no configurada"}
    url = "https://api.openai.com/v1/chat/completions"
    payload = {
        "model": "gpt-4.1-mini",
        "temperature": 0.1,
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": "Responde únicamente JSON válido."},
            {"role": "user", "content": PROMPT},
        ],
    }
    r = requests.post(url, headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"}, json=payload, timeout=90)
    r.raise_for_status()
    text = r.json()["choices"][0]["message"]["content"]
    return safe_json_loads(text)


def call_grok():
    key = os.environ.get("XAI_API_KEY")
    if not key:
        return {"error": "XAI_API_KEY no configurada"}
    url = "https://api.x.ai/v1/chat/completions"
    payload = {
        "model": "grok-4",
        "temperature": 0.1,
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": "Responde únicamente JSON válido."},
            {"role": "user", "content": PROMPT},
        ],
    }
    r = requests.post(url, headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"}, json=payload, timeout=90)
    r.raise_for_status()
    text = r.json()["choices"][0]["message"]["content"]
    return safe_json_loads(text)


def call_gemini():
    key = os.environ.get("GEMINI_API_KEY")
    if not key:
        return {"error": "GEMINI_API_KEY no configurada"}
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={key}"
    payload = {
        "generationConfig": {
            "temperature": 0.1,
            "responseMimeType": "application/json"
        },
        "contents": [
            {
                "parts": [
                    {"text": PROMPT}
                ]
            }
        ]
    }
    r = requests.post(url, headers={"Content-Type": "application/json"}, json=payload, timeout=90)
    r.raise_for_status()
    text = r.json()["candidates"][0]["content"]["parts"][0]["text"]
    return safe_json_loads(text)


def main():
    out_path = Path("/home/ubuntu/complilink_operativo_v1/tmp/final_hardening_consensus.json")
    out_path.parent.mkdir(parents=True, exist_ok=True)

    result = {
        "project_context": PROJECT_CONTEXT,
        "models": {
            "openai": None,
            "grok": None,
            "gemini": None,
        }
    }

    for name, fn in (("openai", call_openai), ("grok", call_grok), ("gemini", call_gemini)):
        try:
            result["models"][name] = fn()
        except Exception as exc:
            result["models"][name] = {"error": str(exc)}

    out_path.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(str(out_path))


if __name__ == "__main__":
    main()
