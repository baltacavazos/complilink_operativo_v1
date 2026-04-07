#!/usr/bin/env python3
import json
import os
import time
from pathlib import Path

import requests

PROJECT_PROMPT = r'''Actúa como arquitecto/a senior de producto, UX y sistemas para AuditaPatron, una plataforma de auditoría documental laboral en México.

Contexto actual:
- Existe una página /auditar donde la persona usuaria sube documentos laborales.
- Helios ya muestra lectura preliminar, siguiente documento recomendado, timeline del expediente, comparación manual de documentos y alertas priorizadas.
- Ya existe integración bidireccional básica con CompliLink MX: AuditaPatron envía documentos y CompliLink puede devolver eventos, clasificación, extracción y advertencias.
- El objetivo estratégico aprobado es un ciclo virtuoso: AuditaPatron capta documentos, Helios los interpreta, CompliLink los enriquece, y la persona usuaria recibe una explicación simple y cada vez más útil.
- Prioridad UX: español simple, cero jerga técnica, mucha claridad, mucha confianza, mobile-first, privacidad y consentimiento visibles sin fricción.
- Restricciones: no exponer credenciales, no pedir pasos técnicos a la persona usuaria, mantener lenguaje humano y no legalista.

Necesito recomendaciones para LA SIGUIENTE ITERACIÓN de /auditar, enfocadas solo en mejoras visibles y de alto impacto que puedan implementarse sin rehacer toda la arquitectura.

Quiero que propongas específicamente:
1. El mejor bloque o sección nueva para hacer visible el ciclo AuditaPatron → Helios → CompliLink.
2. Cómo mostrar alertas priorizadas con fecha/hora y motivo sin asustar ni saturar.
3. Cómo mejorar la comparación de documentos con una vista lado a lado clara y humana.
4. Qué copy exacto sugerirías en español para títulos, subtítulos y microcopy.
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
  "proposed_cycle_block": {
    "title": "string",
    "subtitle": "string",
    "items": [
      {
        "step": "string",
        "label": "string",
        "description": "string"
      }
    ]
  },
  "alert_design": {
    "title": "string",
    "subtitle": "string",
    "fields_to_show": ["string"],
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
    "cycle_headline": "string",
    "cycle_supporting": "string",
    "alert_timestamp_label": "string",
    "alert_reason_label": "string",
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
