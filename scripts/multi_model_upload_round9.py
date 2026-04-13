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
- Ya existe una tarjeta de progreso con stepper visible de 4 etapas: Preparar, Analizar, Guardar y Revisar.
- Ya existe ayuda compacta y colapsable con límites, privacidad y momento de guardado.
- El stepper ya tiene mejoras de accesibilidad básicas y textos persistentes más compactos en móvil.
- La micro-ronda anterior hizo más explícito el texto visible de la ayuda colapsable.

Objetivo de esta nueva micro-ronda:
1. Hacer más visible en móvil que existe ayuda disponible sin volver a saturar el bloque.
2. Anunciar de forma accesible cada cambio de etapa del stepper para lector de pantalla.
3. Mantener el ajuste mínimo posible y de bajo riesgo.

Tu tarea:
- Propón el ajuste mínimo de mayor impacto y menor riesgo.
- Indica cómo hacer persistente la pista de ayuda en móvil sin recargar visualmente.
- Indica la recomendación correcta para anunciar el cambio de etapa a lectores de pantalla.
- Responde SOLO en JSON estricto con esta forma:
{
  "prioridad_1": "string",
  "pista_movil": "string",
  "anuncio_accesible": "string",
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
            "pista_movil": {"type": "STRING"},
            "anuncio_accesible": {"type": "STRING"},
            "riesgo": {"type": "STRING"},
            "plan_minimo": {"type": "STRING"},
        },
        "required": [
            "prioridad_1",
            "pista_movil",
            "anuncio_accesible",
            "riesgo",
            "plan_minimo",
        ],
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
