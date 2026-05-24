import json
import os
import requests
from pathlib import Path

OUTPUT = Path('/home/ubuntu/complilink_operativo_v1/tmp_bridge_hardening_multi_model_output.json')

CONTEXT = {
    "problem_summary": [
        "La app local sí clasifica y guarda documentos, y sí dispara el flujo hacia Helios.",
        "El bridge remoto falla con reason=invalid_ack_contract en devserver.log.",
        "https://www.complilink.mx/api/auditapatron/health responde 301 a complilink.mx y luego 200 text/html, no JSON contractual.",
        "https://complilink.mx/api/internal/helios/bridge/contract responde 200 application/json con contractReady=true.",
        "https://complilink.mx/api/auditapatron/webhook responde 200 text/html, no un ack con responseContract=auditapatron.bridge.ack.v1.",
        "En código fuente actual existe registerCompliLinkReturnWebhook(app) y registra /api/auditapatron/health, /api/auditapatron/webhook, /api/internal/helios/bridge/contract y otras rutas.",
        "El usuario pide una conexión a prueba de balas con Helios o el bridge, evitando quedar atados a un endpoint remoto que devuelva HTML o un contrato inválido."
    ],
    "current_design_notes": {
        "dispatch_function": "sendDocumentToAuditaPatronEngine() hace POST firmado al webhookUrl configurado y sólo considera válido el ack si responseContract == auditapatron.bridge.ack.v1.",
        "current_config": "getAuditaPatronEngineConfig() hoy sólo contempla un webhookUrl primario y un hmacSecret.",
        "observable_risk": "Si el dominio público queda desalineado o publica una versión sin esas rutas, el flujo documental se rompe aunque Helios interno siga sano."
    }
}

PROMPT = f'''Eres un arquitecto senior de integraciones y resiliencia. Analiza este problema real y responde EXCLUSIVAMENTE en JSON válido con este esquema exacto:
{{
  "root_cause_hypothesis": "string",
  "recommended_fix": "string",
  "hardening_steps": ["string", "string", "string"],
  "tests_to_add": ["string", "string", "string"],
  "risk_level": "low|medium|high"
}}

Contexto técnico:\n{json.dumps(CONTEXT, ensure_ascii=False, indent=2)}

Prioriza una solución práctica para un proyecto Node/Express publicado en Manus con dominio custom. Considera contrato, fallback, health check, smoke tests, publicación desalineada y necesidad de que Helios/bridge sea bulletproof.'''


def call_openai():
    key = os.environ.get('OPENAI_API_KEY', '').strip()
    if not key:
        return {"error": "missing OPENAI_API_KEY"}
    url = 'https://api.openai.com/v1/chat/completions'
    payload = {
        "model": "gpt-4.1-mini",
        "messages": [{"role": "user", "content": PROMPT}],
        "response_format": {"type": "json_object"},
        "temperature": 0.2,
    }
    r = requests.post(url, headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"}, json=payload, timeout=90)
    return {"status_code": r.status_code, "body": safe_json(r)}


def call_xai():
    key = os.environ.get('XAI_API_KEY', '').strip()
    if not key:
        return {"error": "missing XAI_API_KEY"}
    url = 'https://api.x.ai/v1/chat/completions'
    payload = {
        "model": "grok-4-latest",
        "messages": [{"role": "user", "content": PROMPT}],
        "response_format": {"type": "json_object"},
        "temperature": 0.2,
    }
    r = requests.post(url, headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"}, json=payload, timeout=90)
    return {"status_code": r.status_code, "body": safe_json(r)}


def call_gemini():
    key = os.environ.get('GEMINI_API_KEY', '').strip()
    if not key:
        return {"error": "missing GEMINI_API_KEY"}
    url = f'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={key}'
    payload = {
        "contents": [{"parts": [{"text": PROMPT}]}],
        "generationConfig": {
            "temperature": 0.2,
            "responseMimeType": "application/json"
        }
    }
    r = requests.post(url, headers={"Content-Type": "application/json"}, json=payload, timeout=90)
    return {"status_code": r.status_code, "body": safe_json(r)}


def safe_json(resp):
    try:
        return resp.json()
    except Exception:
        return {"raw": resp.text[:4000]}


def extract_openai(result):
    try:
        content = result["body"]["choices"][0]["message"]["content"]
        return json.loads(content) if isinstance(content, str) else content
    except Exception as exc:
        return {"parse_error": str(exc), "raw": result}


def extract_xai(result):
    try:
        content = result["body"]["choices"][0]["message"]["content"]
        return json.loads(content) if isinstance(content, str) else content
    except Exception as exc:
        return {"parse_error": str(exc), "raw": result}


def extract_gemini(result):
    try:
        parts = result["body"]["candidates"][0]["content"]["parts"]
        text = ''.join(part.get('text', '') for part in parts)
        return json.loads(text)
    except Exception as exc:
        return {"parse_error": str(exc), "raw": result}


results = {
    "context": CONTEXT,
    "chatgpt": call_openai(),
    "grok": call_xai(),
    "gemini": call_gemini(),
}
results["normalized"] = {
    "chatgpt": extract_openai(results["chatgpt"]),
    "grok": extract_xai(results["grok"]),
    "gemini": extract_gemini(results["gemini"]),
}
OUTPUT.write_text(json.dumps(results, ensure_ascii=False, indent=2))
print(str(OUTPUT))
