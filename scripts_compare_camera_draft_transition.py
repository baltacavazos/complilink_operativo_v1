import json
import os
import requests
from pathlib import Path

PROJECT = Path('/home/ubuntu/complilink_operativo_v1')
OUTPUT = PROJECT / 'camera_draft_transition_model_compare.json'

PROMPT = '''
Eres un auditor senior de UX móvil para una app laboral en México. Necesito una recomendación MUY concreta y conservadora para mejorar la transición entre tomar foto/elegir archivo y abrir el borrador, además de hacer más específico el microcopy según el tipo de documento detectado.

Contexto de producto:
- App: AuditaPatrón
- Público: trabajadores en México
- Tono: cercano, institucional, claro, nada técnico
- Objetivo: que la transición se sienta fluida, confiable y continua; que el usuario entienda rápido qué se recibió, qué está pasando y qué valor le dará ese documento.
- Restricción: no agregar funciones nuevas ni romper escritorio; solo simplificar copy, jerarquía, continuidad visual, estados y microinteracciones ligeras.

Fragmento 1: progreso humano durante análisis
```tsx
function getHumanUploadProgressMessages(stepKey) {
  switch (stepKey) {
    case "analyze":
      return [
        "Analizando lo más importante...",
        "Ubicando las señales clave...",
        "Preparando tu revisión rápida...",
      ];
    case "save":
      return [
        "Protegiendo tu documento...",
        "Guardándolo de forma segura...",
        "Dejando listo el resultado...",
      ];
    default:
      return [];
  }
}
```

Fragmento 2: copy general del resultado recibido
```tsx
function getResultRevealCopy(documentType) {
  const documentLabel = documentType ? getSimpleDocumentTypeLabel(documentType) : "Documento";
  return {
    eyebrow: "Archivo recibido",
    title: `${documentLabel} listo para mostrar resultado`,
    description:
      "Ordenamos primero lo más útil para enseñarte un veredicto simple antes del detalle completo.",
  };
}
```

Fragmento 3: valor por tipo de documento
```tsx
function getUploadInsight(documentType) {
  switch (documentType) {
    case "payroll_receipt":
      return {
        label: "Recibo de nómina incorporado",
        contribution:
          "Este archivo ayuda a revisar percepciones, deducciones y cambios entre pagos. Ya suma contexto útil para tu expediente.",
        nextSuggestion:
          "Si también tienes tu CFDI o contrato, subirlo puede ayudarte a comparar mejor lo reportado con lo que realmente pasó.",
      };
    case "cfdi":
      return {
        label: "CFDI incorporado",
        contribution:
          "Este documento aporta una capa fiscal muy útil para contrastar lo timbrado con lo que recibiste o trabajaste.",
        nextSuggestion:
          "Si cuentas con recibos de nómina o soporte IMSS, agregarlos puede aclarar mejor diferencias o patrones.",
      };
    case "contract":
      return {
        label: "Contrato incorporado",
        contribution:
          "Este archivo ayuda a fijar el punto de partida de la relación laboral y a entender mejor lo que se pactó desde el inicio.",
        nextSuggestion:
          "Subir recibos de nómina y CFDI puede ayudarte a comparar lo prometido con lo que sucedió en la práctica.",
      };
    case "imss":
      return {
        label: "Soporte IMSS incorporado",
        contribution:
          "Este documento fortalece el contexto de seguridad social y puede aclarar movimientos relevantes de tu historial laboral.",
        nextSuggestion:
          "Si también tienes contrato, recibos o CFDI, juntos pueden darte una visión laboral mucho más completa.",
      };
    default:
      return {
        label: "Documento incorporado",
        contribution:
          "Tu archivo ya forma parte del expediente y puede sumar contexto útil para una revisión más completa.",
        nextSuggestion:
          "Si sabes qué tipo de documento es, cuéntalo en la descripción o sube también recibos, CFDI o contrato para fortalecer mejor el análisis.",
      };
  }
}
```

Fragmento 4: línea de estado inferior actual
```tsx
{pendingDraft
  ? manualOverridePayload.length
    ? `Borrador listo: ${manualOverridePayload.length} ajustes para revisar.`
    : `Borrador listo: ${pendingDraft.previewAsset.fileName}`
  : selectedFile
    ? isAutoAnalyzingSelectedFile
      ? `Analizando: ${selectedFile.name}`
      : `Documento recibido: ${selectedFile.name}`
    : "Primero elige tu documento desde el celular o tus archivos guardados."}
```

Quiero una respuesta JSON estricta con esta estructura:
{
  "diagnosis": "máximo 100 palabras",
  "top_issues": ["issue 1", "issue 2", "issue 3"],
  "recommended_changes": [
    {
      "target": "progress_messages | result_reveal_copy | upload_insight | status_line | continuity_note",
      "change": "cambio concreto",
      "why": "por qué mejora móvil"
    }
  ],
  "microcopy": {
    "progress_analyze_1": "texto",
    "progress_analyze_2": "texto",
    "progress_analyze_3": "texto",
    "progress_save_1": "texto",
    "progress_save_2": "texto",
    "progress_save_3": "texto",
    "result_title_payroll": "texto",
    "result_title_cfdi": "texto",
    "result_title_contract": "texto",
    "result_title_imss": "texto",
    "result_description": "texto",
    "status_received": "texto",
    "status_analyzing": "texto"
  },
  "document_specific_notes": {
    "payroll_receipt": "texto breve",
    "cfdi": "texto breve",
    "contract": "texto breve",
    "imss": "texto breve"
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
