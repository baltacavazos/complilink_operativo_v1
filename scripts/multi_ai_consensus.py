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
- Ya se avanzó en centrar la interfaz y ocultar la complejidad interna; ahora se quiere reforzar mejor el valor del expediente digital.
- Hipótesis a evaluar: conviene comunicar que entre más documentos suba la persona, más se ordena y fortalece su expediente digital, evitando tener archivos perdidos en carpetas distintas y dejando todo disponible 24/7 cuando lo necesite.
- Ese beneficio debe comunicarse con empatía y utilidad práctica, no como táctica manipuladora ni con tono legalista o alarmista.
- Se puede mencionar que tener documentos ordenados y disponibles ayuda si algún día necesita aclaraciones, trámites, reclamaciones o incluso una demanda, pero sin centrar toda la experiencia en el miedo.
- Todo lo que sube la persona sí alimenta procesos internos y enriquecimiento de fondo, pero ESO NO DEBE MENCIONARSE en la experiencia visible. El usuario solo debe ver beneficios claros, orden, disponibilidad, confianza y facilidad.
- También se quiere pulir navegación móvil y microinteracciones suaves en botones, tarjetas, cargas o confirmaciones, sin distraer ni degradar rendimiento.
- Restricciones: no mencionar Helios, no mencionar motor interno, no pedir pasos técnicos, no exponer complejidad arquitectónica, mantener español simple y humano.

Necesito recomendaciones para LA SIGUIENTE ITERACIÓN de Home y /auditar, enfocadas solo en mejoras visibles y de alto impacto que puedan implementarse sin rehacer toda la arquitectura.

Quiero que propongas específicamente:
1. Si es buena idea comunicar el valor del expediente digital acumulativo, ordenado y disponible 24/7.
2. Cuál es la mejor forma de comunicarlo sin sonar manipulador, alarmista ni técnico.
3. Qué copy exacto sugerirías en español para explicar: orden documental, disponibilidad permanente, respaldo útil y crecimiento del expediente con cada documento.
4. Cómo implementarlo visualmente en la home y en /auditar con la menor fricción posible.
5. Qué microinteracciones suaves y qué ajustes de navegación móvil agregarías en esta ronda.
6. Qué NO implementar todavía para evitar complejidad innecesaria.

Devuelve SOLO JSON válido con esta forma exacta:
{
  "model_positioning": "string",
  "is_24_7_dossier_message_a_good_idea": true,
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
    "microcopy": ["string"],
    "empty_state_message": "string"
  },
  "microinteractions_and_mobile": {
    "microinteractions": ["string"],
    "mobile_navigation_adjustments": ["string"],
    "wow_moments": ["string"]
  },
  "exact_copy": {
    "hero_supporting": "string",
    "digital_dossier_title": "string",
    "digital_dossier_supporting": "string",
    "availability_message": "string",
    "upload_reassurance": "string",
    "documents_growth_message": "string"
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
