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
- Ya existe un módulo de documentos recomendados, un historial simple del expediente con filtros básicos y un onboarding móvil reutilizable.
- Ahora queremos una siguiente iteración más útil y accionable.
- Queremos que el historial del expediente y sus filtros se sientan personales y persistentes para cada usuario, sin obligarlo a configurar nada manualmente.
- Queremos mostrar porcentaje de completitud por tipo documental faltante para que la persona entienda qué tan completo está su expediente sin sentirse juzgada.
- Queremos que cada documento recomendado tenga un CTA directo y obvio para subir exactamente ese documento desde Home y /auditar.
- La idea es que la persona sienta que el sistema le ahorra desorden, le muestra qué le falta, le deja todo a la mano 24/7 y le facilita actuar en un toque.
- Los documentos sugeridos siguen priorizando los que aportan más claridad y mejor respaldo para la revisión, pero ESO NO DEBE EXPLICARSE como lógica interna al usuario final.
- Restricciones: no mencionar Helios, no mencionar motor interno, no mencionar enriquecimiento backend, no pedir pasos técnicos, no exponer complejidad arquitectónica, mantener español simple y humano.
- Hay que priorizar implementaciones de alto impacto y baja fricción, evitando sobreingeniería.

Necesito recomendaciones para LA SIGUIENTE ITERACIÓN de Home y /auditar.

Quiero que propongas específicamente:
1. Cómo persistir el historial del expediente y sus filtros por usuario de forma silenciosa y útil.
2. Cómo mostrar porcentaje de completitud por tipo documental faltante sin generar ansiedad ni ruido visual.
3. Cómo diseñar CTAs directos para subir cada documento recomendado desde Home y /auditar.
4. Qué copy exacto sugieres para persistencia del historial, completitud documental y acciones directas.
5. Cómo implementarlo visualmente con la menor fricción posible.
6. Qué NO construir todavía para no meter complejidad innecesaria.

Devuelve SOLO JSON válido con esta forma exacta:
{
  "model_positioning": "string",
  "history_persistence": {
    "is_good_idea": true,
    "why": "string",
    "what_to_persist": ["string"],
    "how_it_should_feel": "string",
    "avoid_patterns": ["string"]
  },
  "completeness_model": {
    "is_good_idea": true,
    "visible_logic_summary": "string",
    "scoring_style": "string",
    "recommended_document_types": [
      {
        "document_type": "string",
        "importance_label": "string",
        "completion_hint": "string",
        "user_value": "string"
      }
    ],
    "progress_explainer": ["string"],
    "avoid_logic": ["string"]
  },
  "cta_strategy": {
    "home_cta_pattern": "string",
    "auditar_cta_pattern": "string",
    "cta_labels": ["string"],
    "reassurance_microcopy": ["string"]
  },
  "top_recommendations": [
    {
      "title": "string",
      "why": "string",
      "ux_impact": "high|medium|low",
      "implementation_effort": "high|medium|low"
    }
  ],
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
    "history_module_title": "string",
    "history_module_supporting": "string",
    "history_filters": ["string"],
    "completion_module_title": "string",
    "completion_module_supporting": "string",
    "empty_state_message": "string"
  },
  "exact_copy": {
    "history_saved_label": "string",
    "history_filter_label": "string",
    "completion_title": "string",
    "completion_supporting": "string",
    "recommended_documents_title": "string",
    "recommended_documents_supporting": "string",
    "direct_upload_cta": "string",
    "secondary_cta": "string",
    "upload_reassurance": "string"
  },
  "microinteractions_and_mobile": {
    "microinteractions": ["string"],
    "mobile_layout_adjustments": ["string"],
    "wow_moments": ["string"]
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
