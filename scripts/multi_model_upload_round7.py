import json
import os
import requests
from textwrap import dedent

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
XAI_API_KEY = os.getenv("XAI_API_KEY")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

PROMPT = dedent("""
Eres un auditor experto en UX/UI para producto web móvil-first.

Contexto del producto:
- App: AuditaPatron.
- Vista a evaluar/refinar: /auditar.
- Objetivo: mejorar incrementalmente el flujo de carga de archivos sin ampliar alcance funcional.
- Estado previo: el consenso multi-modelo ya alcanzó 9.0/10 en la ronda anterior.
- El usuario aprobó una nueva micro-ronda para pulir tres puntos concretos.

Implementación actual del flujo de upload:
1. Ya existe validación preventiva antes de subir: solo acepta PDF, XML e imágenes claras; límite preventivo de 15 MB con mensaje inmediato.
2. Ya existe una tarjeta de progreso con estados y porcentaje visible:
   - Idle: 12%.
   - Archivo seleccionado: 38%.
   - Análisis en curso: 72%.
   - Guardado/confirmación: 92%.
   - Vista previa lista: 100%.
3. Ya existe microcopy de control: el sistema explica que primero se prepara borrador, luego se revisa, y solo al final se confirma el guardado.
4. Ya existe mensaje preventivo sobre legibilidad del archivo y textos de privacidad/seguridad en el flujo.
5. Ya existe autoanálisis al seleccionar archivo y se abre revisión rápida al terminar.

Nueva micro-ronda aprobada por el usuario:
A. Añadir progreso por etapas o tiempo estimado durante carga/análisis/guardado.
B. Hacer más claras las transiciones visuales entre estados del upload.
C. Hacer persistentes, junto al cargador, los límites de tipo/tamaño y el mensaje de seguridad/privacidad.

Tu tarea:
1. Propón SOLO cambios mínimos y realistas, no rediseños.
2. Prioriza impacto UX alto con implementación pequeña.
3. Evalúa qué harías exactamente para intentar subir de 9.0 a 9.1/9.2.
4. Responde en JSON estricto con esta forma:
{
  "score_actual": number,
  "veredicto": "texto breve",
  "top_3_cambios": [
    {
      "titulo": "string",
      "impacto": "alto|medio|bajo",
      "esfuerzo": "bajo|medio|alto",
      "detalle": "string concreto y accionable"
    }
  ],
  "cambio_minimo_recomendado": "string",
  "riesgo_si_se_sobrediseña": "string",
  "score_estimado_post": number
}
""").strip()


def call_openai():
    if not OPENAI_API_KEY:
        return {"error": "OPENAI_API_KEY missing"}
    url = "https://api.openai.com/v1/chat/completions"
    payload = {
        "model": "gpt-4.1-mini",
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": "Eres un auditor UX/UI senior. Devuelves JSON válido y estricto."},
            {"role": "user", "content": PROMPT},
        ],
        "temperature": 0.2,
    }
    response = requests.post(url, headers={
        "Authorization": f"Bearer {OPENAI_API_KEY}",
        "Content-Type": "application/json",
    }, json=payload, timeout=90)
    response.raise_for_status()
    data = response.json()
    content = data["choices"][0]["message"]["content"]
    return json.loads(content)


def call_xai():
    if not XAI_API_KEY:
        return {"error": "XAI_API_KEY missing"}
    url = "https://api.x.ai/v1/chat/completions"
    payload = {
        "model": "grok-3-mini",
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": "Eres un auditor UX/UI senior. Devuelves JSON válido y estricto."},
            {"role": "user", "content": PROMPT},
        ],
        "temperature": 0.2,
    }
    response = requests.post(url, headers={
        "Authorization": f"Bearer {XAI_API_KEY}",
        "Content-Type": "application/json",
    }, json=payload, timeout=90)
    response.raise_for_status()
    data = response.json()
    content = data["choices"][0]["message"]["content"]
    return json.loads(content)


def call_gemini():
    if not GEMINI_API_KEY:
        return {"error": "GEMINI_API_KEY missing"}
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={GEMINI_API_KEY}"
    schema = {
        "type": "OBJECT",
        "properties": {
            "score_actual": {"type": "NUMBER"},
            "veredicto": {"type": "STRING"},
            "top_3_cambios": {
                "type": "ARRAY",
                "items": {
                    "type": "OBJECT",
                    "properties": {
                        "titulo": {"type": "STRING"},
                        "impacto": {"type": "STRING"},
                        "esfuerzo": {"type": "STRING"},
                        "detalle": {"type": "STRING"}
                    },
                    "required": ["titulo", "impacto", "esfuerzo", "detalle"]
                }
            },
            "cambio_minimo_recomendado": {"type": "STRING"},
            "riesgo_si_se_sobrediseña": {"type": "STRING"},
            "score_estimado_post": {"type": "NUMBER"}
        },
        "required": [
            "score_actual",
            "veredicto",
            "top_3_cambios",
            "cambio_minimo_recomendado",
            "riesgo_si_se_sobrediseña",
            "score_estimado_post"
        ]
    }
    payload = {
        "contents": [{"parts": [{"text": PROMPT}]}],
        "generationConfig": {
            "temperature": 0.2,
            "responseMimeType": "application/json",
            "responseSchema": schema,
        },
    }
    response = requests.post(url, headers={"Content-Type": "application/json"}, json=payload, timeout=90)
    response.raise_for_status()
    data = response.json()
    content = data["candidates"][0]["content"]["parts"][0]["text"]
    return json.loads(content)


def safe_call(name, fn):
    try:
        return fn()
    except Exception as exc:
        return {"error": f"{type(exc).__name__}: {exc}"}


if __name__ == "__main__":
    result = {
        "openai": safe_call("openai", call_openai),
        "xai": safe_call("xai", call_xai),
        "gemini": safe_call("gemini", call_gemini),
    }
    print(json.dumps(result, ensure_ascii=False, indent=2))
