import json
import os
import time
import requests
from textwrap import dedent

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

Responde SOLO en JSON estricto con esta forma:
{
  "prioridad_1": "string",
  "decision_colapsable": "mantener_visible|hacer_colapsable|mixto",
  "recomendacion_accesibilidad": "string",
  "recomendacion_copy_movil": "string",
  "riesgo": "bajo|medio|alto",
  "plan_minimo": "string"
}
""").strip()

SCHEMA = {
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

URL = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={GEMINI_API_KEY}"

for attempt in range(3):
    response = requests.post(
        URL,
        headers={"Content-Type": "application/json"},
        json={
            "contents": [{"parts": [{"text": PROMPT}]}],
            "generationConfig": {
                "temperature": 0.2,
                "responseMimeType": "application/json",
                "responseSchema": SCHEMA,
            },
        },
        timeout=90,
    )
    if response.ok:
        data = response.json()
        print(data["candidates"][0]["content"]["parts"][0]["text"])
        break
    if response.status_code != 503 or attempt == 2:
        response.raise_for_status()
    time.sleep(4 * (attempt + 1))
