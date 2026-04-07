#!/usr/bin/env python3
import json
import os
import time
from pathlib import Path

import requests

PROJECT_PROMPT = r'''Actúa como arquitecto/a senior de producto, UX y sistemas para AuditaPatron, una plataforma de auditoría documental laboral en México.

Contexto actual:
- Existe una página /auditar donde la persona usuaria sube documentos laborales para revisar si todo con su patrón está en orden.
- La interfaz actual necesita verse más centrada, más estética y más sólida visualmente.
- En móvil no debe existir riesgo de scroll lateral, desbordes horizontales ni bloques que se sientan anchos o incómodos.
- La experiencia debe sentirse extremadamente fácil, confiable, amigable y casi mágica: la persona sube documentos y recibe una respuesta útil sin entender motores internos, integraciones ni complejidad técnica.
- Todo lo que sube la persona usuaria sí alimenta un motor central e integra enriquecimiento desde otras plataformas, pero ESO NO DEBE MENCIONARSE en la experiencia visible. El usuario solo debe ver beneficios claros, calma y utilidad.
- Prioridad UX: español simple, cero jerga técnica, mucha claridad, mucha confianza, mobile-first, privacidad y consentimiento visibles sin fricción.
- Restricciones: no exponer credenciales, no pedir pasos técnicos a la persona usuaria, no mencionar Helios ni el motor interno, mantener lenguaje humano y no legalista.

Necesito recomendaciones para LA SIGUIENTE ITERACIÓN de /auditar, enfocadas solo en mejoras visibles y de alto impacto que puedan implementarse sin rehacer toda la arquitectura.

Quiero que propongas específicamente:
1. Cómo recentrar visualmente la interfaz y hacerla más estética y equilibrada.
2. Cómo eliminar cualquier riesgo de scroll lateral móvil o sensación de layout ancho/confuso.
3. Cómo reescribir la experiencia para que se sienta mágica y útil, ocultando por completo el motor interno.
4. Qué copy exacto sugerirías en español para títulos, subtítulos y microcopy de una experiencia simple y confiable.
5. Qué NO implementar todavía para evitar complejidad innecesaria.

Devuelve SOLO JSON válido con esta forma exacta:
{
  "model_positioning": "string",
  "top_recommendations": [
    {
      "title": "string",
      "why": "string",
      "ux_impact": "high|medium|low",
      "implementation_effort": "high|medium|low"
    }
  ],
  "layout_guidance": {
    "headline": "string",
    "principles": ["string"],
    "mobile_risks_to_remove": ["string"],
    "wow_moments": ["string"]
  },
  "trust_experience": {
    "title": "string",
    "subtitle": "string",
    "visible_promises": ["string"],
    "tone_guidance": "string"
  },
  "comparison_design": {
    "title": "string",
    "subtitle": "string",
    "left_column_label": "string",
    "right_column_label": "string",
    "difference_summary_label": "string",
    "cta_label": "string"
  },
  "exact_copy": {
    "hero_headline": "string",
    "hero_supporting": "string",
    "trust_block_title": "string",
    "trust_block_supporting": "string",
    "comparison_headline": "string",
    "comparison_supporting": "string"
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
