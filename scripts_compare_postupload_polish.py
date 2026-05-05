import json
import os
import requests
from pathlib import Path

PROJECT = Path('/home/ubuntu/complilink_operativo_v1')
OUTPUT = PROJECT / 'postupload_polish_model_compare.json'

PROMPT = '''
Eres un auditor senior de UX móvil para una app laboral en México. Necesito una recomendación MUY concreta y conservadora para compactar el primer viewport post-upload y mejorar el feedback de carga/OCR.

Contexto de producto:
- App: AuditaPatrón
- Público: trabajadores en México
- Tono: cercano, institucional, claro, nada técnico
- Objetivo: que después de subir un documento el usuario entienda en segundos qué llegó, qué hallazgo importa y qué sigue.
- Restricción: no agregar funciones nuevas ni romper escritorio; solo simplificar copy, jerarquía, densidad y estados de carga.

Fragmento 1: estados de carga/análisis
```tsx
if (isConfirmingDraft) {
  return {
    eyebrow: "Guardado en curso",
    title: "Estamos guardando tu documento en la bóveda laboral",
    description:
      "No necesitas repetir la carga. En cuanto termine, verás el resultado, el hallazgo guardado y el siguiente paso sugerido.",
    progress: 92,
  };
}

if (pendingDraft) {
  return {
    eyebrow: "Vista previa lista",
    title: "Tu documento ya quedó listo para revisión",
    description:
      "Todavía no se guarda en tu bóveda laboral: primero revisas lo leído y después confirmas si quieres conservarlo.",
    progress: 100,
  };
}

if (isAnalyzingDraft) {
  return {
    eyebrow: "Análisis en curso",
    title: "Estamos leyendo tu archivo y preparando la primera lectura",
    description:
      "Quédate en esta pantalla. En cuanto termine, abriremos la revisión rápida automáticamente para que veas qué documento llegó y qué señal encontramos.",
    progress: 72,
  };
}

if (selectedFile) {
  return {
    eyebrow: "Archivo listo",
    title: "Documento preparado para una primera lectura automática",
    description:
      "La revisión preliminar empieza sola en cuanto termina la carga, para que llegues a la vista previa sin pasos extra antes de decidir si quieres guardarlo.",
  };
}
```

Fragmento 2: CTA y mensajes inmediatos
```tsx
<Button>
  {isProcessingDocument
    ? pendingDraft
      ? "Guardando documento..."
      : autoAdvanceFlash
        ? "Autoavance activado..."
        : "Analizando documento..."
    : acceptLegalPackageMutation.isPending
      ? "Registrando autorización..."
      : pendingDraft
        ? confirmPrimaryActionLabel
        : uploadPrimaryActionLabel}
</Button>
{autoAdvanceFlash && !pendingDraft ? (
  <p>
    Autoavance activado: terminando el análisis abrimos la revisión rápida automáticamente.
  </p>
) : null}
<p>
  {pendingDraft
    ? manualOverridePayload.length
      ? `Vista previa lista: ${manualOverridePayload.length} ajustes preparados antes de guardar.`
      : `Vista previa lista: ${pendingDraft.previewAsset.fileName}`
    : selectedFile
      ? `Borrador automático en preparación: ${selectedFile.name}`
      : "Primero elige tu documento desde el celular o tus archivos guardados."}
</p>
```

Fragmento 3: primer viewport del veredicto post-upload
```tsx
<div data-testid="auditar-verdict-panel">
  <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
    <span>Documento recibido</span>
    <span>{tipoDocumento}</span>
    <span>{veredicto}</span>
  </div>

  <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.18fr)_minmax(18rem,0.82fr)]">
    <div>
      <p>Lo importante primero</p>
      <h3>{headline}</h3>
      <p>{lead}</p>

      <div>
        <span>{tipoDocumento}</span>
        <span>{veredictoCorto}</span>
        <span>Expediente actualizado</span>
      </div>

      <div>
        <div>
          <div>
            <p>Lo más útil ahora</p>
            <p>Qué ya está claro, qué pide atención y qué te conviene hacer a continuación.</p>
          </div>
          <span>Máximo 3 puntos</span>
        </div>

        <div>
          <div>
            <p>{label1}</p>
            <p>{summary1}</p>
          </div>
          <div>
            <p>{label2}</p>
            <p>{summary2}</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
```

Quiero una respuesta JSON estricta con esta estructura:
{
  "diagnosis": "máximo 90 palabras",
  "top_issues": ["issue 1", "issue 2", "issue 3"],
  "recommended_changes": [
    {
      "target": "loading_state | upload_cta | verdict_header | verdict_body",
      "change": "cambio concreto",
      "why": "por qué mejora móvil"
    }
  ],
  "microcopy": {
    "analyzing_title": "texto",
    "analyzing_description": "texto",
    "saving_title": "texto",
    "saving_description": "texto",
    "cta_processing": "texto",
    "cta_autoadvance": "texto",
    "status_line_selected_file": "texto",
    "status_line_pending_draft": "texto",
    "verdict_intro": "texto"
  },
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
