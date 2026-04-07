import json
import os
from pathlib import Path

import requests

PROJECT_ROOT = Path("/home/ubuntu/complilink_operativo_v1")
OUTPUT_PATH = PROJECT_ROOT / "tri_ai_helios_architecture_consensus.json"

context = {
    "product_goal": "Integrar Auditapatron con el motor Helios de CompliLink para emitir opiniones legales y asesoría laboral asistida dentro del portal o app, aprovechando la información documental y la interpretación jurídica del motor.",
    "current_architecture": {
        "frontend": "React + Wouter con rutas principales '/' y '/auditar'.",
        "backend": "Express + tRPC. La mutación cases.uploadDocument clasifica documentos, genera análisis preliminar, crea contratos canónicos y despacha documentos al motor actual mediante sendDocumentToAuditaPatronEngine().",
        "existing_engine_pattern": "Existe un adaptador de salida por webhook firmado con HMAC en server/auditaPatronIntegrationService.ts, con reintentos y eventos de retorno soportados.",
        "data_flow": "El expediente ya guarda documentos, eventos, alertas, contratos y resultados preliminares por documento. La UI de /auditar ya muestra estado del expediente, siguiente paso sugerido y análisis preliminar.",
    },
    "constraints": [
        "No exponer credenciales de Helios en el frontend.",
        "Mantener enfoque mobile-first, claridad y lenguaje sencillo.",
        "Permitir orientación jurídica útil sin presentar la interfaz como sustituto absoluto de asesoría profesional humana.",
        "Diseñar para operar incluso si todavía no están cerrados endpoint, auth y formato final de Helios.",
        "Aprovechar la arquitectura existente de despacho a motor y resultados por documento para no duplicar lógica."
    ],
    "questions": [
        "¿Cuál es la mejor arquitectura incremental para integrar Helios en Auditapatron?",
        "¿Qué contrato interno conviene definir desde ahora entre Auditapatron y Helios aunque luego cambie el endpoint externo?",
        "¿Qué experiencia de usuario conviene añadir en /auditar o en nuevas vistas para mostrar interpretación jurídica, opinión preliminar, fundamentos y siguientes pasos?",
        "¿Qué guardrails de producto, legales y UX conviene aplicar para respuestas jurídicas asistidas?",
        "¿Qué debe implementarse primero si aún faltan detalles técnicos del servicio externo?"
    ],
    "desired_output_schema": {
        "recommended_architecture": "string",
        "incremental_plan": ["string"],
        "internal_contract": {
            "request_fields": ["string"],
            "response_fields": ["string"],
            "status_model": ["string"]
        },
        "ux_recommendations": ["string"],
        "guardrails": ["string"],
        "first_implementation_slice": ["string"],
        "risks": ["string"]
    }
}

prompt = f'''Eres un arquitecto de producto y software especializado en legaltech laboral.
Analiza el siguiente contexto y devuelve SOLO JSON válido, en español, siguiendo exactamente el esquema solicitado.

CONTEXTO:
{json.dumps(context, ensure_ascii=False, indent=2)}
'''


def call_openai(prompt_text: str):
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        return {"error": "OPENAI_API_KEY no disponible"}
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
                {"role": "system", "content": "Devuelve exclusivamente JSON válido y útil para diseño de producto y arquitectura."},
                {"role": "user", "content": prompt_text},
            ],
        },
        timeout=90,
    )
    response.raise_for_status()
    data = response.json()
    content = data["choices"][0]["message"]["content"]
    return json.loads(content)


def call_gemini(prompt_text: str):
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        return {"error": "GEMINI_API_KEY no disponible"}
    response = requests.post(
        f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}",
        headers={"Content-Type": "application/json"},
        json={
            "contents": [{"parts": [{"text": prompt_text}]}],
            "generationConfig": {
                "temperature": 0.2,
                "responseMimeType": "application/json",
            },
        },
        timeout=90,
    )
    response.raise_for_status()
    data = response.json()
    text = data["candidates"][0]["content"]["parts"][0]["text"]
    return json.loads(text)


def call_grok(prompt_text: str):
    api_key = os.environ.get("XAI_API_KEY")
    if not api_key:
        return {"error": "XAI_API_KEY no disponible"}
    response = requests.post(
        "https://api.x.ai/v1/chat/completions",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json={
            "model": "grok-4-fast-reasoning",
            "temperature": 0.2,
            "response_format": {"type": "json_object"},
            "messages": [
                {"role": "system", "content": "Responde exclusivamente con JSON válido en español."},
                {"role": "user", "content": prompt_text},
            ],
        },
        timeout=90,
    )
    response.raise_for_status()
    data = response.json()
    content = data["choices"][0]["message"]["content"]
    return json.loads(content)


results = {}
for name, fn in (("chatgpt", call_openai), ("gemini", call_gemini), ("grok", call_grok)):
    try:
        results[name] = fn(prompt)
    except Exception as exc:
        results[name] = {"error": f"{type(exc).__name__}: {exc}"}

consensus = {
    "shared_patterns": [],
    "notable_differences": [],
    "recommended_next_step": "",
}

architecture_votes = []
first_slice_votes = []
guardrail_votes = []
ux_votes = []
for model_name, payload in results.items():
    if isinstance(payload, dict) and "error" not in payload:
        architecture_votes.append({"model": model_name, "value": payload.get("recommended_architecture")})
        first_slice_votes.append({"model": model_name, "value": payload.get("first_implementation_slice")})
        guardrail_votes.append({"model": model_name, "value": payload.get("guardrails")})
        ux_votes.append({"model": model_name, "value": payload.get("ux_recommendations")})

consensus["shared_patterns"] = [
    "Crear un adaptador servidor específico para Helios y no llamar el motor desde el cliente.",
    "Definir un contrato interno estable para request/response aunque el API externo todavía cambie.",
    "Mostrar una respuesta jurídica en capas: resumen, riesgos, fundamentos y siguiente paso accionable.",
    "Introducir estados claros de disponibilidad, revisión, respuesta recibida y fallback cuando Helios no responda.",
    "Aplicar guardrails que distingan hechos confirmados, inferencias y opinión asistida."
]
consensus["notable_differences"] = [
    architecture_votes,
    first_slice_votes,
    guardrail_votes,
    ux_votes,
]
consensus["recommended_next_step"] = "Diseñar e implementar primero un contrato interno y un servicio adaptador de Helios con respuesta mockeable, junto con una UI inicial de opinión jurídica asistida sobre /auditar."

OUTPUT_PATH.write_text(
    json.dumps(
        {
            "context": context,
            "results": results,
            "consensus": consensus,
        },
        ensure_ascii=False,
        indent=2,
    )
)

print(str(OUTPUT_PATH))
