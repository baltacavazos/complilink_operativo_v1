import json
import os
import time
from typing import Any, Dict

import requests

PROMPT = """
Actúa como estratega senior de CRO y UX writing para una landing de una app laboral mexicana llamada AuditaPatron.

Contexto actual del hero:
- Variante A tab: "Alerta y control"
- Eyebrow: "Alerta laboral temprana"
- Titular: "Podrías estar perdiendo dinero o derechos y ni siquiera lo sabes."
- Refuerzo: "Revísalo hoy y toma control de tu historial laboral."
- CTA principal: "Auditar mi situación ahora"
- CTA secundario: "Ver qué documento subir primero"

Variante B tab: "Control inmediato"
- Titular: "Revisa hoy tu historial laboral y actúa con más control."
- Refuerzo: "Empieza con el documento que ya tienes a la mano."
- CTA principal: "Empezar mi revisión"
- CTA secundario: "Quiero una guía rápida"

Mejoras a definir en una sola iteración:
1. Un mini prediagnóstico inline dentro del hero para orientar al usuario desde el primer vistazo.
2. Medición de clics por variante del hero para comparar desempeño entre mensajes.
3. Refuerzo de la tarjeta lateral del hero con un hallazgo laboral concreto que haga tangible el valor de la auditoría.

Objetivo de negocio:
- Maximizar claridad, confianza y conversión.
- Mantener sensación de empoderamiento, no solo miedo.
- Hacer que el usuario sienta que puede empezar fácil desde el primer documento.
- No usar jerga legal compleja.

Responde SOLO en JSON válido con esta estructura exacta:
{
  "prediagnostic": {
    "recommended_format": "string",
    "question": "string",
    "options": [
      {"id": "string", "label": "string", "microcopy": "string", "recommended_document": "string"}
    ],
    "cta_after_selection": "string"
  },
  "analytics": {
    "events": [
      {"name": "string", "trigger": "string", "properties": ["string"]}
    ],
    "primary_success_metric": "string",
    "guardrails": ["string"]
  },
  "side_card": {
    "headline": "string",
    "example_finding": "string",
    "supporting_copy": "string",
    "tone_warning": "string"
  },
  "implementation_order": ["string", "string", "string"],
  "rationale": "string"
}
""".strip()


def post_json(url: str, headers: Dict[str, str], payload: Dict[str, Any]) -> Dict[str, Any]:
    response = requests.post(url, headers=headers, json=payload, timeout=120)
    response.raise_for_status()
    return response.json()


def call_openai() -> Dict[str, Any]:
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        return {"error": "OPENAI_API_KEY no disponible"}
    payload = {
        "model": "gpt-4.1-mini",
        "temperature": 0.4,
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": "Eres un experto en CRO, UX writing y experimentación para landings. Devuelves JSON estricto."},
            {"role": "user", "content": PROMPT},
        ],
    }
    data = post_json(
        "https://api.openai.com/v1/chat/completions",
        {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        payload,
    )
    content = data["choices"][0]["message"]["content"]
    return json.loads(content)


def call_grok() -> Dict[str, Any]:
    api_key = os.environ.get("XAI_API_KEY")
    if not api_key:
        return {"error": "XAI_API_KEY no disponible"}
    payload = {
        "model": "grok-4-latest",
        "temperature": 0.4,
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": "Eres un experto en CRO, UX writing y experimentación para landings. Devuelves JSON estricto."},
            {"role": "user", "content": PROMPT},
        ],
    }
    data = post_json(
        "https://api.x.ai/v1/chat/completions",
        {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        payload,
    )
    content = data["choices"][0]["message"]["content"]
    return json.loads(content)


def call_gemini() -> Dict[str, Any]:
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        return {"error": "GEMINI_API_KEY no disponible"}
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}"
    payload = {
        "systemInstruction": {
            "parts": [{"text": "Eres un experto en CRO, UX writing y experimentación para landings. Devuelves JSON estricto."}]
        },
        "contents": [{"parts": [{"text": PROMPT}]}],
        "generationConfig": {
            "temperature": 0.4,
            "responseMimeType": "application/json",
        },
    }
    data = post_json(url, {"Content-Type": "application/json"}, payload)
    content = data["candidates"][0]["content"]["parts"][0]["text"]
    return json.loads(content)


def main() -> None:
    started_at = int(time.time())
    results = {
        "started_at": started_at,
        "prompt": PROMPT,
        "openai": call_openai(),
        "grok": call_grok(),
        "gemini": call_gemini(),
    }
    output_path = "/home/ubuntu/complilink_operativo_v1/hero_consensus_results.json"
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
    print(output_path)


if __name__ == "__main__":
    main()
