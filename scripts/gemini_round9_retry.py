import json
import os
import requests
from textwrap import dedent

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

Responde SOLO en JSON estricto con esta forma:
{
  "prioridad_1": "string",
  "pista_movil": "string",
  "anuncio_accesible": "string",
  "riesgo": "bajo|medio|alto",
  "plan_minimo": "string"
}
""").strip()

SCHEMA = {
    "type": "OBJECT",
    "properties": {
        "prioridad_1": {"type": "STRING"},
        "pista_movil": {"type": "STRING"},
        "anuncio_accesible": {"type": "STRING"},
        "riesgo": {"type": "STRING"},
        "plan_minimo": {"type": "STRING"}
    },
    "required": [
        "prioridad_1",
        "pista_movil",
        "anuncio_accesible",
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
            "responseSchema": SCHEMA,
        },
    },
    timeout=90,
)
response.raise_for_status()
data = response.json()
print(data["candidates"][0]["content"]["parts"][0]["text"])
