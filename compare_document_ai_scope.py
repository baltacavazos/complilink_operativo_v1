import json
import os
import time
from pathlib import Path

import requests

PROJECT_ROOT = Path("/home/ubuntu/complilink_operativo_v1")
OUTPUT_PATH = PROJECT_ROOT / "document_analysis_scope_comparison.json"

SYSTEM_PROMPT = (
    "Eres un arquitecto senior de producto, IA documental y automatización legal-operativa. "
    "Debes responder SOLO con JSON válido, compacto, accionable y pensado para un MVP robusto."
)

USER_PROMPT = """
Contexto del producto:
- AuditaPatron es la experiencia frontal para el trabajador.
- CompliLink MX es la capa operativa y de procesamiento conectada por webhooks.
- Ya existe un flujo de carga documental en AuditaPatron con almacenamiento, hash SHA-256, clasificación inicial simple, contratos canónicos y envío al motor conectado.
- La clasificación actual es limitada y basada sobre todo en nombre de archivo, mimeType y textHint.
- Actualmente el sistema reconoce principalmente: payroll_receipt, cfdi, imss, contract, settlement, evidence, other.
- Existe helper server-side para invocar LLM con salida estructurada JSON.
- El usuario quiere ampliar AuditaPatron para que se puedan subir prácticamente CUALQUIER documento laboral relevante y que la IA lo analice a profundidad.
- Debe incluir contratos individuales de trabajo para calcular preliminarmente prestaciones, obligaciones, riesgos y posibles hallazgos.
- Se busca mínima intervención humana, máxima automatización, explicabilidad y robustez operativa.
- Es importante no prometer certeza jurídica absoluta cuando falten datos; el sistema debe distinguir entre cálculo preliminar, estimación y dato confirmado.

Objetivo del análisis:
Proponer la mejor arquitectura MVP para que AuditaPatron pueda:
1. aceptar documentos laborales heterogéneos,
2. clasificarlos con IA de forma más amplia,
3. extraer datos clave por tipo documental,
4. analizar contratos individuales de trabajo,
5. estimar prestaciones y conceptos laborales cuando sea razonable,
6. dejar resultados estructurados y útiles para expediente, interfaz y CompliLink MX,
7. mantener guardrails legales y operativos.

Quiero que respondas SOLO con JSON válido usando exactamente esta estructura:
{
  "document_families": [
    {
      "family": "string",
      "examples": ["string"],
      "analysis_priority": "high|medium|low"
    }
  ],
  "ingestion_and_analysis_pipeline": ["string"],
  "structured_outputs": {
    "common_fields": ["string"],
    "contract_fields": ["string"],
    "benefits_fields": ["string"],
    "risk_fields": ["string"]
  },
  "prestaciones_scope": {
    "can_estimate_with_contract_only": ["string"],
    "requires_additional_documents": ["string"],
    "should_be_marked_as_preliminary": ["string"]
  },
  "legal_and_product_guardrails": ["string"],
  "backend_changes": ["string"],
  "frontend_changes": ["string"],
  "complilink_integration": ["string"],
  "mvp_verdict": "string"
}
""".strip()


def call_openai():
    api_key = os.environ.get("OPENAI_API_KEY", "").strip()
    if not api_key:
        return {"error": "missing_openai_api_key"}

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
                {"role": "user", "content": USER_PROMPT},
            ],
        },
        timeout=180,
    )
    response.raise_for_status()
    payload = response.json()
    content = payload["choices"][0]["message"]["content"]
    return json.loads(content)


def call_gemini():
    api_key = os.environ.get("GEMINI_API_KEY", "").strip()
    if not api_key:
        return {"error": "missing_gemini_api_key"}

    response = requests.post(
        f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}",
        headers={"Content-Type": "application/json"},
        json={
            "generationConfig": {
                "temperature": 0.2,
                "responseMimeType": "application/json",
            },
            "systemInstruction": {"parts": [{"text": SYSTEM_PROMPT}]},
            "contents": [
                {
                    "role": "user",
                    "parts": [{"text": USER_PROMPT}],
                }
            ],
        },
        timeout=180,
    )
    response.raise_for_status()
    payload = response.json()
    content = payload["candidates"][0]["content"]["parts"][0]["text"]
    return json.loads(content)


def call_grok():
    api_key = os.environ.get("XAI_API_KEY", "").strip()
    if not api_key:
        return {"error": "missing_xai_api_key"}

    response = requests.post(
        "https://api.x.ai/v1/chat/completions",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json={
            "model": "grok-4",
            "temperature": 0.2,
            "response_format": {"type": "json_object"},
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": USER_PROMPT},
            ],
        },
        timeout=180,
    )
    response.raise_for_status()
    payload = response.json()
    content = payload["choices"][0]["message"]["content"]
    return json.loads(content)


if __name__ == "__main__":
    started_at = time.time()
    result = {
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "prompt": USER_PROMPT,
        "models": {},
    }

    for name, fn in (("chatgpt", call_openai), ("gemini", call_gemini), ("grok", call_grok)):
        try:
            result["models"][name] = {"status": "ok", "output": fn()}
        except Exception as exc:
            result["models"][name] = {"status": "error", "error": str(exc)}

    result["duration_seconds"] = round(time.time() - started_at, 2)
    OUTPUT_PATH.write_text(json.dumps(result, ensure_ascii=False, indent=2))
    print(str(OUTPUT_PATH))
