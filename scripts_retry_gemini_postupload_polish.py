import json
import os
import requests
from pathlib import Path

PROJECT = Path('/home/ubuntu/complilink_operativo_v1')
OUTPUT = PROJECT / 'postupload_polish_gemini_retry.json'

PROMPT = '''
Responde solo con JSON válido.

Eres un auditor senior de UX móvil para una app laboral en México. Necesito una recomendación muy concreta y conservadora para compactar el primer viewport post-upload y mejorar el feedback de carga/OCR.

Objetivo: que después de subir un documento el usuario entienda en segundos qué llegó, qué hallazgo importa y qué sigue.
Restricción: no agregar funciones nuevas ni romper escritorio; solo simplificar copy, jerarquía, densidad y estados de carga.

Estados de carga actuales:
- Análisis en curso / Estamos leyendo tu archivo y preparando la primera lectura / Quédate en esta pantalla. En cuanto termine, abriremos la revisión rápida automáticamente para que veas qué documento llegó y qué señal encontramos.
- Guardado en curso / Estamos guardando tu documento en la bóveda laboral / No necesitas repetir la carga. En cuanto termine, verás el resultado, el hallazgo guardado y el siguiente paso sugerido.
- Vista previa lista / Tu documento ya quedó listo para revisión / Todavía no se guarda en tu bóveda laboral: primero revisas lo leído y después confirmas si quieres conservarlo.

CTA y feedback actual:
- Analizando documento...
- Autoavance activado...
- Guardando documento...
- Registrando autorización...
- Borrador automático en preparación: nombreArchivo
- Vista previa lista: nombreArchivo

Veredicto actual:
- Chips: Documento recibido / tipo de documento / veredicto
- Título principal + párrafo lead
- Bloque 'Lo más útil ahora' con 2-3 tarjetas

Devuelve JSON con:
{
  "diagnosis": "máximo 80 palabras",
  "top_issues": ["...", "...", "..."],
  "recommended_changes": [
    {"target": "loading_state|upload_cta|verdict_header|verdict_body", "change": "...", "why": "..."}
  ],
  "microcopy": {
    "analyzing_title": "...",
    "analyzing_description": "...",
    "saving_title": "...",
    "saving_description": "...",
    "cta_processing": "...",
    "cta_autoadvance": "...",
    "status_line_selected_file": "...",
    "status_line_pending_draft": "...",
    "verdict_intro": "..."
  },
  "confidence": "high|medium|low"
}
'''


def main():
    api_key = os.environ['GEMINI_API_KEY']
    models = ['gemini-2.5-flash-lite', 'gemini-flash-lite-latest', 'gemini-flash-latest']
    last_error = None
    for model in models:
        try:
            url = f'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}'
            payload = {
                'contents': [{'role': 'user', 'parts': [{'text': PROMPT}]}],
                'generationConfig': {
                    'temperature': 0.2,
                    'responseMimeType': 'application/json'
                }
            }
            response = requests.post(url, json=payload, timeout=120)
            response.raise_for_status()
            data = response.json()
            text = data['candidates'][0]['content']['parts'][0]['text']
            parsed = json.loads(text)
            OUTPUT.write_text(json.dumps({'model': model, 'result': parsed}, ensure_ascii=False, indent=2))
            print(str(OUTPUT))
            return
        except Exception as exc:
            last_error = f'{model}: {exc}'
    OUTPUT.write_text(json.dumps({'error': last_error}, ensure_ascii=False, indent=2))
    print(str(OUTPUT))


if __name__ == '__main__':
    main()
