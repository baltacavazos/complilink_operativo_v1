#!/usr/bin/env python3
import json
import os
import time
from pathlib import Path

import requests

PROJECT_PROMPT = r'''Actúa como arquitecto/a senior de producto, UX y sistemas para AuditaPatron, una plataforma de auditoría documental laboral en México.

Contexto actual:
- Existe una home y una página /auditar donde la persona usuaria sube documentos laborales para revisar si todo con su patrón está en orden.
- La dirección UX actual busca una experiencia muy simple, confiable, mobile-first y casi mágica.
- Ya se comunicó mejor el valor del expediente digital 24/7, pero ahora queremos ir un paso más allá.
- Nueva prioridad: mostrar de forma muy útil qué documentos conviene subir primero para obtener más claridad, más contexto y mejores respuestas para la persona usuaria.
- Además, esos documentos priorizados también deben ser los que más valor informativo aportan internamente al sistema, pero ESO NO DEBE EXPLICARSE al usuario final. En la interfaz visible solo deben mostrarse beneficios claros para la persona: más claridad, mejor respaldo, más contexto y mejor revisión.
- La persona usuaria debe sentir que mientras más documentos importantes sube, más completo, útil y ordenado queda su expediente digital.
- También queremos añadir dos mejoras visibles y simples: un historial ligero de consultas/accesos del expediente para reforzar la idea de disponibilidad y trazabilidad, y un onboarding móvil breve de 2 a 3 pantallas puramente informativas que explique el valor del producto en segundos.
- Restricciones: no mencionar Helios, no mencionar motor interno, no mencionar enriquecimiento de backend, no pedir pasos técnicos, no exponer complejidad arquitectónica, mantener español simple y humano.
- Hay que priorizar implementaciones de alto impacto y baja fricción, sin rehacer toda la arquitectura.

Necesito recomendaciones para LA SIGUIENTE ITERACIÓN de Home y /auditar.

Quiero que propongas específicamente:
1. Qué documentos laborales conviene priorizar como “los más útiles por subir” para dar mejores resultados a la persona usuaria.
2. Cómo explicar esa priorización sin sonar técnica, manipuladora o invasiva.
3. Qué copy exacto sugerirías en español para el módulo de documentos recomendados, para el historial simple del expediente y para el onboarding móvil breve.
4. Cómo implementarlo visualmente en Home y /auditar con la menor fricción posible.
5. Cómo diseñar el historial simple de consultas/accesos del expediente para reforzar disponibilidad 24/7 y confianza.
6. Cómo diseñar un onboarding móvil breve de 2 o 3 pantallas, puramente informativo y muy claro.
7. Qué NO implementar todavía para evitar complejidad innecesaria.

Devuelve SOLO JSON válido con esta forma exacta:
{
  "model_positioning": "string",
  "priority_documents_strategy": {
    "is_good_idea": true,
    "recommended_document_order": [
      {
        "document_name": "string",
        "user_value": "string",
        "why_it_is_high_signal": "string"
      }
    ],
    "selection_principles": ["string"]
  },
  "top_recommendations": [
    {
      "title": "string",
      "why": "string",
      "ux_impact": "high|medium|low",
      "implementation_effort": "high|medium|low"
    }
  ],
  "message_strategy": {
    "headline": "string",
    "principles": ["string"],
    "avoid_phrases": ["string"],
    "best_user_promises": ["string"]
  },
  "home_implementation": {
    "section_title": "string",
    "section_supporting": "string",
    "cards_or_points": ["string"],
    "cta_label": "string"
  },
  "auditar_implementation": {
    "section_title": "string",
    "section_supporting": "string",
    "recommended_documents_microcopy": ["string"],
    "history_module_microcopy": ["string"],
    "empty_state_message": "string"
  },
  "mobile_onboarding": {
    "screen_1": {
      "title": "string",
      "supporting": "string"
    },
    "screen_2": {
      "title": "string",
      "supporting": "string"
    },
    "screen_3": {
      "title": "string",
      "supporting": "string"
    },
    "entry_point": "string",
    "replay_option": "string"
  },
  "history_experience": {
    "module_title": "string",
    "module_supporting": "string",
    "events_to_show": ["string"],
    "trust_signals": ["string"]
  },
  "microinteractions_and_mobile": {
    "microinteractions": ["string"],
    "mobile_navigation_adjustments": ["string"],
    "wow_moments": ["string"]
  },
  "exact_copy": {
    "recommended_documents_title": "string",
    "recommended_documents_supporting": "string",
    "history_title": "string",
    "history_supporting": "string",
    "upload_reassurance": "string",
    "documents_growth_message": "string",
    "onboarding_intro": "string"
  },
  "do_not_build_yet": ["string"],
  "final_verdict": "string"
}
'''


def call_openai(prompt: str):
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        return {"error": "OPENAI_API_KEY missing"}
    url = "https://api.openai.com/v1/chat/completions"
    payload = {
        "model": "gpt-4.1-mini",
        "temperature": 0.3,
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": "Eres un arquitecto senior de producto y UX. Debes responder únicamente JSON válido."},
            {"role": "user", "content": prompt},
        ],
    }
    res = requests.post(
        url,
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        json=payload,
        timeout=90,
    )
    return normalize_response("chatgpt", res)


def call_gemini(prompt: str):
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        return {"error": "GEMINI_API_KEY missing"}
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}"
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": 0.3,
            "responseMimeType": "application/json",
        },
    }
    res = requests.post(url, headers={"Content-Type": "application/json"}, json=payload, timeout=90)
    return normalize_response("gemini", res)


def call_grok(prompt: str):
    api_key = os.environ.get("XAI_API_KEY")
    if not api_key:
        return {"error": "XAI_API_KEY missing"}
    url = "https://api.x.ai/v1/chat/completions"
    payload = {
        "model": "grok-4-fast-non-reasoning",
        "temperature": 0.3,
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": "Eres un arquitecto senior de producto y UX. Debes responder únicamente JSON válido."},
            {"role": "user", "content": prompt},
        ],
    }
    res = requests.post(
        url,
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        json=payload,
        timeout=90,
    )
    return normalize_response("grok", res)


def extract_json_text(provider: str, body: dict):
    if provider == "chatgpt":
        return body["choices"][0]["message"]["content"]
    if provider == "grok":
        return body["choices"][0]["message"]["content"]
    if provider == "gemini":
        return body["candidates"][0]["content"]["parts"][0]["text"]
    raise ValueError(provider)


def normalize_response(provider: str, res: requests.Response):
    result = {
        "provider": provider,
        "http_status": res.status_code,
        "ok": res.ok,
        "received_at": int(time.time()),
    }
    try:
        body = res.json()
    except Exception:
        result["error"] = res.text[:4000]
        return result

    result["raw"] = body
    if not res.ok:
        result["error"] = body
        return result

    try:
        text = extract_json_text(provider, body)
        result["text"] = text
        result["parsed"] = json.loads(text)
    except Exception as exc:
        result["parse_error"] = str(exc)
    return result


def main():
    output_dir = Path("/home/ubuntu/complilink_operativo_v1/tmp")
    output_dir.mkdir(parents=True, exist_ok=True)
    results = {
        "chatgpt": call_openai(PROJECT_PROMPT),
        "gemini": call_gemini(PROJECT_PROMPT),
        "grok": call_grok(PROJECT_PROMPT),
    }
    output_path = output_dir / "multi_ai_consensus_raw.json"
    output_path.write_text(json.dumps(results, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(str(output_path))


if __name__ == "__main__":
    main()
