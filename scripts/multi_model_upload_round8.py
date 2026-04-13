import json
import os
import requests
from textwrap import dedent

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
XAI_API_KEY = os.getenv("XAI_API_KEY")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

PROMPT = dedent("""
Eres un auditor experto en UX/UI móvil-first para un flujo de upload documental laboral.

Contexto actual en la vista /auditar de AuditaPatron:
- Ya existe una tarjeta de progreso con aria-live="polite".
- Ya existe un stepper visible de 4 etapas: Preparar, Analizar, Guardar, Revisar.
- Ya existen bloques persistentes con límites visibles y privacidad/control.
- Dentro de la tarjeta se muestran varios textos consecutivos: etapa actual, descripción, tiempo estimado, texto de transición, apoyo persistente y resumen de seguridad.
- El bloque persistente inferior hoy ocupa dos tarjetas visibles en móvil.

Objetivo de esta nueva micro-ronda:
1. Reforzar accesibilidad del stepper y de los mensajes de estado.
2. Compactar el copy persistente en móvil sin perder claridad ni confianza.
3. Evaluar si conviene una ayuda colapsable o si es mejor mantener todo visible.

Tu tarea:
- Propón el ajuste mínimo de mayor impacto y menor riesgo.
- Indica si conviene mantener visibles los bloques de límites/privacidad o volver uno de ellos colapsable.
- Sugiere el tratamiento correcto de accesibilidad para el stepper.
- Responde SOLO en JSON estricto con esta forma:
{
  "prioridad_1": "string",
  "decision_colapsable": "mantener_visible|hacer_colapsable|mixto",
  "recomendacion_accesibilidad": "string",
  "recomendacion_copy_movil": "string",
  "riesgo": "bajo|medio|alto",
  "plan_minimo": "string"
}
""").strip()


def parse_json(text):
    return json.loads(text)


def call_openai():
    response = requests.post(
        "https://api.openai.com/v1/chat/completions",
        headers={
            "Authorization": f"Bearer {OPENAI_API_KEY}",
            "Content-Type": "application/json",
        },
        json={
            "model": "gpt-4.1-mini",
            "response_format": {"type": "json_object"},
            "messages": [
                {"role": "system", "content": "Eres un auditor UX/UI senior. Devuelves JSON válido y estricto."},
                {"role": "user", "content": PROMPT},
            ],
            "temperature": 0.2,
        },
        timeout=90,
    )
    response.raise_for_status()
    return parse_json(response.json()["choices"][0]["message"]["content"])


def call_xai():
    response = requests.post(
        "https://api.x.ai/v1/chat/completions",
        headers={
            "Authorization": f"Bearer {XAI_API_KEY}",
            "Content-Type": "application/json",
        },
        json={
            "model": "grok-3-mini",
            "response_format": {"type": "json_object"},
            "messages": [
                {"role": "system", "content": "Eres un auditor UX/UI senior. Devuelves JSON válido y estricto."},
                {"role": "user", "content": PROMPT},
            ],
            "temperature": 0.2,
        },
        timeout=90,
    )
    response.raise_for_status()
    return parse_json(response.json()["choices"][0]["message"]["content"])


def call_gemini():
    schema = {
        "type": "OBJECT",
        "properties": {
            "prioridad_1": {"type": "STRING"},
            "decision_colapsable": {"type": "STRING"},
            "recomendacion_accesibilidad": {"type": "STRING"},
            "recomendacion_copy_movil": {"type": "STRING"},
            "riesgo": {"type": "STRING"},
            "plan_minimo": {"type": "STRING"}
        },
        "required": [
            "prioridad_1",
            "decision_colapsable",
            "recomendacion_accesibilidad",
            "recomendacion_copy_movil",
            "riesgo",
            "plan_minimo"
        ]
    }
    response = requests.post(
        f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={GEMINI_API_KEY}",
        headers={"Content-Type": "application/json"},
        json={
            "contents": [{"parts": [{"text": PROMPT}]}],
            "generationConfig": {
                "temperature": 0.2,
                "responseMimeType": "application/json",
                "responseSchema": schema,
            },
        },
        timeout=90,
    )
    response.raise_for_status()
    data = response.json()
    return parse_json(data["candidates"][0]["content"]["parts"][0]["text"])


def safe_call(fn):
    try:
        return fn()
    except Exception as exc:
        return {"error": f"{type(exc).__name__}: {exc}"}


if __name__ == "__main__":
    result = {
        "openai": safe_call(call_openai),
        "xai": safe_call(call_xai),
        "gemini": safe_call(call_gemini),
    }
    print(json.dumps(result, ensure_ascii=False, indent=2))
