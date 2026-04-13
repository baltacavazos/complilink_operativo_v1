import json
import os
import requests
from textwrap import dedent

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
XAI_API_KEY = os.getenv("XAI_API_KEY")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

PROMPT = dedent("""
Eres un auditor experto en UX/UI para producto web móvil-first.

Reaudita una micro-ronda ya implementada en la vista /auditar de AuditaPatron.

Base previa conocida:
- El flujo ya validaba tipos compatibles y límite preventivo de 15 MB.
- Ya existía un progreso porcentual con estados: 12, 38, 72, 92 y 100.
- Ya existía control de borrador antes de guardado final.

Cambios implementados en esta micro-ronda:
1. Se añadió un stepper visible de 4 etapas: Preparar, Analizar, Guardar, Revisar.
2. La tarjeta de progreso ahora muestra una etiqueta de etapa actual, por ejemplo:
   - Etapa 1 de 4 · Preparación segura
   - Etapa 2 de 4 · Analizando contenido
   - Etapa 3 de 4 · Guardando con control
   - Etapa 4 de 4 · Vista previa lista
3. La tarjeta ahora muestra tiempo estimado o siguiente acción contextual según el estado.
4. Se añadieron textos de transición visibles para explicar el cambio entre estados.
5. Se añadieron dos bloques persistentes junto al cargador:
   - Límites visibles: formatos permitidos y límite de 15 MB.
   - Privacidad y control: no se guarda en expediente hasta confirmar.
6. Se mantuvieron transiciones suaves en barra, tarjeta y stepper.
7. La suite de pruebas fue ampliada y está pasando.

Tu tarea:
1. Evalúa si esta micro-ronda realmente mejora el flujo sin sobrecargarlo.
2. Da un score UX/UI actual estimado.
3. Indica si ya es suficiente o si sólo falta un ajuste mínimo opcional.
4. Responde SOLO en JSON estricto con esta forma:
{
  "score_post": number,
  "veredicto": "string breve",
  "mejora_percibida": "string",
  "riesgo_de_sobrecarga": "bajo|medio|alto",
  "ajuste_minimo_opcional": "string",
  "consenso_recomendado": "cerrar_ronda|hacer_microajuste"
}
""").strip()


def safe_json_loads(text):
    return json.loads(text)


def call_openai():
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
    return safe_json_loads(response.json()["choices"][0]["message"]["content"])


def call_xai():
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
    return safe_json_loads(response.json()["choices"][0]["message"]["content"])


def call_gemini():
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={GEMINI_API_KEY}"
    schema = {
        "type": "OBJECT",
        "properties": {
            "score_post": {"type": "NUMBER"},
            "veredicto": {"type": "STRING"},
            "mejora_percibida": {"type": "STRING"},
            "riesgo_de_sobrecarga": {"type": "STRING"},
            "ajuste_minimo_opcional": {"type": "STRING"},
            "consenso_recomendado": {"type": "STRING"}
        },
        "required": [
            "score_post",
            "veredicto",
            "mejora_percibida",
            "riesgo_de_sobrecarga",
            "ajuste_minimo_opcional",
            "consenso_recomendado"
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
    return safe_json_loads(data["candidates"][0]["content"]["parts"][0]["text"])


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
