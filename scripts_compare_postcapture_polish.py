import json
import os
import requests
from pathlib import Path

PROJECT = Path('/home/ubuntu/complilink_operativo_v1')
OUTPUT = PROJECT / 'postcapture_polish_model_compare.json'

PROMPT = '''
Eres un auditor senior de UX móvil para una app laboral en México. Necesito una recomendación MUY concreta y conservadora para mejorar la pantalla inmediata tras tomar foto o elegir archivo, y volver más claro y vivo el feedback de análisis automático.

Contexto de producto:
- App: AuditaPatrón
- Público: trabajadores en México
- Tono: cercano, institucional, claro, nada técnico
- Objetivo: que justo después de tomar foto o elegir archivo el usuario entienda qué pasó, que su documento sí fue recibido y que el análisis ya empezó sin fricción.
- Restricción: no agregar funciones nuevas ni romper escritorio; solo simplificar copy, jerarquía, densidad, microinteracciones y feedback visual.

Fragmento 1: entrada móvil y CTA inmediata
```tsx
<Button>
  {isAutoAnalyzingSelectedFile
    ? "Analizando documento..."
    : selectedFile
      ? "Cambiar documento"
      : shouldCompactMobileUploadEntry
        ? activeCaptureMode === "camera"
          ? "Toma foto para empezar"
          : "Elige archivo para empezar"
        : uploadPrimaryActionLabel}
</Button>

<p>
  {isAutoAnalyzingSelectedFile
    ? "Estamos preparando tu vista previa."
    : shouldCompactMobileUploadEntry
      ? `${COMPACT_UPLOAD_GUARDRAILS.fileRules} El borrador se abre aquí mismo.`
      : preferredCaptureMode === "camera"
        ? "Abriremos la cámara primero."
        : preferredCaptureMode === "file"
          ? "Abriremos tus archivos primero."
          : "Abriremos tus archivos; si prefieres foto puedes cambiarlo aquí."}
</p>
```

Fragmento 2: estado de análisis automático tras captura
```tsx
{isAutoAnalyzingSelectedFile ? (
  <div>
    <p>Estamos analizando tu documento</p>
    <p>
      Bloqueamos la cámara y los archivos unos segundos para evitar duplicados.
      Enseguida abriremos el borrador.
    </p>
  </div>
) : null}
```

Fragmento 3: estado resumido inferior
```tsx
<p>
  {pendingDraft
    ? manualOverridePayload.length
      ? `Borrador listo: ${manualOverridePayload.length} ajustes para revisar.`
      : `Borrador listo: ${pendingDraft.previewAsset.fileName}`
    : selectedFile
      ? `Documento cargado: ${selectedFile.name}`
      : "Primero elige tu documento desde el celular o tus archivos guardados."}
</p>

{autoAdvanceFlash && !pendingDraft ? (
  <p>En cuanto termine, abrimos tu revisión rápida automáticamente.</p>
) : null}
```

Quiero una respuesta JSON estricta con esta estructura:
{
  "diagnosis": "máximo 90 palabras",
  "top_issues": ["issue 1", "issue 2", "issue 3"],
  "recommended_changes": [
    {
      "target": "capture_cta | capture_helper | analyzing_state | status_line | autoadvance_feedback",
      "change": "cambio concreto",
      "why": "por qué mejora móvil"
    }
  ],
  "microcopy": {
    "cta_camera": "texto",
    "cta_file": "texto",
    "helper_idle": "texto",
    "analyzing_title": "texto",
    "analyzing_description": "texto",
    "status_selected_file": "texto",
    "autoadvance_message": "texto"
  },
  "microinteraction_notes": ["nota 1", "nota 2"],
  "confidence": "high|medium|low"
}

Devuelve solo JSON válido.
'''


def call_openai():
    api_key = os.environ.get('OPENAI_API_KEY')
    if not api_key:
        return {'error': 'OPENAI_API_KEY missing'}
    url = 'https://api.openai.com/v1/chat/completions'
    headers = {'Authorization': f'Bearer {api_key}', 'Content-Type': 'application/json'}
    payload = {
        'model': 'gpt-4.1-mini',
        'temperature': 0.2,
        'response_format': {'type': 'json_object'},
        'messages': [
            {'role': 'system', 'content': 'Eres un experto en UX móvil y microcopy. Responde solo con JSON válido.'},
            {'role': 'user', 'content': PROMPT},
        ],
    }
    r = requests.post(url, headers=headers, json=payload, timeout=120)
    r.raise_for_status()
    content = r.json()['choices'][0]['message']['content']
    return json.loads(content)


def call_grok():
    api_key = os.environ.get('XAI_API_KEY')
    if not api_key:
        return {'error': 'XAI_API_KEY missing'}
    url = 'https://api.x.ai/v1/chat/completions'
    headers = {'Authorization': f'Bearer {api_key}', 'Content-Type': 'application/json'}
    payload = {
        'model': 'grok-3-mini',
        'temperature': 0.2,
        'response_format': {'type': 'json_object'},
        'messages': [
            {'role': 'system', 'content': 'Eres un experto en UX móvil y microcopy. Responde solo con JSON válido.'},
            {'role': 'user', 'content': PROMPT},
        ],
    }
    r = requests.post(url, headers=headers, json=payload, timeout=120)
    r.raise_for_status()
    content = r.json()['choices'][0]['message']['content']
    return json.loads(content)


def call_gemini():
    api_key = os.environ.get('GEMINI_API_KEY')
    if not api_key:
        return {'error': 'GEMINI_API_KEY missing'}
    url = f'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}'
    payload = {
        'contents': [
            {
                'role': 'user',
                'parts': [{'text': PROMPT}],
            }
        ],
        'generationConfig': {
            'temperature': 0.2,
            'responseMimeType': 'application/json',
        },
    }
    r = requests.post(url, json=payload, timeout=120)
    r.raise_for_status()
    data = r.json()
    content = data['candidates'][0]['content']['parts'][0]['text']
    return json.loads(content)


def main():
    results = {}
    for name, fn in [('openai', call_openai), ('grok', call_grok), ('gemini', call_gemini)]:
        try:
            results[name] = fn()
        except Exception as exc:
            results[name] = {'error': str(exc)}
    OUTPUT.write_text(json.dumps(results, ensure_ascii=False, indent=2))
    print(str(OUTPUT))


if __name__ == '__main__':
    main()
