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
- Ya existe un módulo inicial de “documentos más útiles por subir”, un historial simple del expediente y un onboarding móvil breve.
- Ahora queremos una segunda iteración más inteligente: que las recomendaciones visibles se conecten con los documentos realmente faltantes del expediente del usuario, que el historial tenga filtros simples y que el onboarding móvil se vuelva un carrusel reutilizable que pueda reabrirse.
- La idea es que la persona sienta que el sistema entiende qué le falta, le sugiere exactamente lo que más le conviene subir después y le ahorra desorden.
- Además, los documentos sugeridos deben seguir priorizando los que mayor valor informativo aportan internamente al sistema, pero ESO NO DEBE EXPLICARSE al usuario final. En la interfaz visible solo deben mostrarse beneficios claros: más claridad, mejor respaldo, más contexto y mejor revisión.
- La persona usuaria debe sentir que mientras más documentos importantes sube, más completo, útil y ordenado queda su expediente digital, con todo disponible 24/7.
- Restricciones: no mencionar Helios, no mencionar motor interno, no mencionar enriquecimiento de backend, no pedir pasos técnicos, no exponer complejidad arquitectónica, mantener español simple y humano.
- Hay que priorizar implementaciones de alto impacto y baja fricción, sin rehacer toda la arquitectura.

Necesito recomendaciones para LA SIGUIENTE ITERACIÓN de Home y /auditar.

Quiero que propongas específicamente:
1. Cómo conectar recomendaciones documentales con faltantes reales del expediente sin hacer sentir vigilada a la persona usuaria.
2. Qué lógica simple y visible conviene usar para priorizar documentos faltantes de forma útil y accionable.
3. Qué filtros simples debería tener el historial del expediente para que sea útil en móvil y genere confianza.
4. Cómo convertir el onboarding móvil breve en un carrusel reutilizable, claro y fácil de volver a abrir.
5. Qué copy exacto sugerirías en español para recomendaciones faltantes, filtros del historial y el nuevo carrusel onboarding.
6. Cómo implementarlo visualmente en Home y /auditar con la menor fricción posible.
7. Qué NO implementar todavía para evitar complejidad innecesaria.

Devuelve SOLO JSON válido con esta forma exacta:
{
  "model_positioning": "string",
  "missing_documents_strategy": {
    "is_good_idea": true,
    "visible_logic_summary": "string",
    "recommended_document_order": [
      {
        "document_name": "string",
        "when_to_show": "string",
        "user_value": "string",
        "priority_reason": "string"
      }
    ],
    "selection_principles": ["string"],
    "avoid_logic": ["string"]
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
    "recommended_documents_title": "string",
    "recommended_documents_supporting": "string",
    "recommended_documents_microcopy": ["string"],
    "history_filters_title": "string",
    "history_filters": ["string"],
    "history_module_microcopy": ["string"],
    "empty_state_message": "string"
  },
  "mobile_onboarding_carousel": {
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
    "entry_points": ["string"],
    "replay_option": "string",
    "close_behavior": "string"
  },
  "history_experience": {
    "module_title": "string",
    "module_supporting": "string",
    "recommended_filters": ["string"],
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
    "history_filter_label": "string",
    "upload_reassurance": "string",
    "documents_growth_message": "string",
    "onboarding_intro": "string",
    "reopen_onboarding_label": "string"
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
