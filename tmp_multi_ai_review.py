import json
import os
import time
from typing import Any

import requests

PROMPT = """Eres un arquitecto senior de un SaaS legal-laboral en México. Necesito una recomendación breve y accionable para corregir 4 fallos críticos ya diagnosticados en un flujo documental.

Contexto real del sistema:
- Stack: React 19 + Express 4 + tRPC + Drizzle + MySQL/TiDB.
- Flujo: upload -> classifyMexicanLaborDocument() -> buildPreliminaryLaborAnalysis() -> analyzeStructuredDocumentPreview() -> createAuditLogs() -> sendDocumentToAuditaPatronEngine() -> socialSecurityValidation.
- Los documentos reales probados fueron CFDI XML de nómina y PDFs de recibo de nómina.

Fallos confirmados:
1) El bridge remoto puede responder HTTP 200 con HTML de la landing. El código actual hace safeJsonParse() pero si response.ok es true lo marca como status='sent' aunque el ack no sea JSON válido ni tenga responseContract correcto. Eso contamina audit_logs.
2) PDFs de recibo de nómina con nombre tipo UUID y sin palabras como 'nomina' o 'recibo' se clasifican como 'other'.
3) La señal hasInfonavitSignal queda en false aunque un XML CFDI contiene una deducción explícita TipoDeduccion='010' concepto 'PAGO INFONAVIT'. Hoy documentMentionsInfonavit() revisa casi solo heliosOpinion/originalName.
4) Faltan migraciones de ceo_bridge_schedules y ceo_bridge_presets; hoy hay degradación controlada pero ruido operativo.

Quiero respuesta SOLO en JSON con este esquema exacto:
{
  "bridge_fix": "...",
  "pdf_fix": "...",
  "infonavit_fix": "...",
  "migration_fix": "...",
  "tests": ["...", "...", "..."],
  "priority_order": ["...", "...", "...", "..."],
  "main_risk": "..."
}

Reglas:
- Máximo 120 palabras total dentro de los valores string combinados.
- No expliques contexto, no repitas el problema.
- Prioriza soluciones de bajo riesgo y alto impacto para producción.
- No propongas re-arquitectura grande.
"""


def post_openai(model: str) -> Any:
    api_key = os.environ["OPENAI_API_KEY"]
    url = "https://api.openai.com/v1/chat/completions"
    payload = {
        "model": model,
        "temperature": 0.1,
        "max_tokens": 500,
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": "Responde exclusivamente JSON válido."},
            {"role": "user", "content": PROMPT},
        ],
    }
    r = requests.post(url, headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}, json=payload, timeout=60)
    return {"status": r.status_code, "body": r.text}


def post_xai(model: str) -> Any:
    api_key = os.environ["XAI_API_KEY"]
    url = "https://api.x.ai/v1/chat/completions"
    payload = {
        "model": model,
        "temperature": 0.1,
        "max_tokens": 500,
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": "Responde exclusivamente JSON válido."},
            {"role": "user", "content": PROMPT},
        ],
    }
    r = requests.post(url, headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}, json=payload, timeout=60)
    return {"status": r.status_code, "body": r.text}


def post_gemini(model: str) -> Any:
    api_key = os.environ["GEMINI_API_KEY"]
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
    payload = {
        "generationConfig": {
            "temperature": 0.1,
            "responseMimeType": "application/json",
        },
        "contents": [{
            "role": "user",
            "parts": [{"text": PROMPT}]
        }],
    }
    r = requests.post(url, headers={"Content-Type": "application/json"}, json=payload, timeout=60)
    return {"status": r.status_code, "body": r.text}


def extract_openai_json(body: str) -> Any:
    data = json.loads(body)
    return json.loads(data["choices"][0]["message"]["content"])


def extract_xai_json(body: str) -> Any:
    data = json.loads(body)
    return json.loads(data["choices"][0]["message"]["content"])


def extract_gemini_json(body: str) -> Any:
    data = json.loads(body)
    text = data["candidates"][0]["content"]["parts"][0]["text"]
    return json.loads(text)


def try_models(post_fn, extract_fn, models):
    errors = []
    for model in models:
        try:
            result = post_fn(model)
            if result["status"] >= 400:
                errors.append({"model": model, "status": result["status"], "body": result["body"][:600]})
                continue
            parsed = extract_fn(result["body"])
            return {"model": model, "response": parsed}
        except Exception as exc:
            errors.append({"model": model, "error": str(exc)})
        time.sleep(1)
    return {"error": errors}


summary = {
    "openai": try_models(post_openai, extract_openai_json, ["gpt-4.1-mini", "gpt-4o-mini"]),
    "grok": try_models(post_xai, extract_xai_json, ["grok-3-mini", "grok-4"]),
    "gemini": try_models(post_gemini, extract_gemini_json, ["gemini-2.5-flash", "gemini-2.0-flash"]),
}

print(json.dumps(summary, ensure_ascii=False, indent=2))
