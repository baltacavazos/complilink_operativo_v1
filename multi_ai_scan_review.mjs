import fs from 'node:fs/promises';

const OUTPUT_PATH = '/home/ubuntu/complilink_operativo_v1/multi_ai_scan_review_results.json';

const context = {
  proyecto: 'AuditaPatron / complilink_operativo_v1',
  objetivo: 'Definir la mejor implementación para OCR estructurado por tipo documental, detección de bordes en cámara y pantalla final de confirmación antes de guardar, con fricción mínima y enfoque mobile-first.',
  usuarioFinal: 'Trabajadores mexicanos con muy baja alfabetización digital; debe servir incluso para un niño de 10 años o una persona mayor humilde.',
  restricciones: [
    'La experiencia debe ser mobile-first y sin scroll lateral.',
    'La IA no debe bloquear al usuario cuando la clasificación no sea concluyente.',
    'El motor interno debe quedar oculto; la experiencia visible debe sentirse simple y casi mágica.',
    'Debe priorizarse fricción mínima, confiabilidad y continuidad entre dispositivos.',
    'Se debe reutilizar lo que ya existe para evitar regresiones innecesarias.'
  ],
  backend_actual_resumen: {
    mutacion: 'cases.uploadDocument',
    input: {
      tenantId: 'string',
      caseId: 'string',
      fileName: 'string',
      mimeType: 'string',
      base64Content: 'string',
      textHint: 'string opcional',
      expectedDocumentType: 'tipo documental opcional',
      captureMode: 'camera | file opcional',
      visibility: 'case_team por default',
      consentStatus: 'pending por default',
      sourceChannel: 'manual | email | api | bulk_import'
    },
    comportamiento: [
      'Decodifica el archivo, lo guarda en storage y calcula SHA-256.',
      'Clasifica el documento con classifyMexicanLaborDocument.',
      'Evalúa calidad de captura con analyzeDocumentScanAssist.',
      'Construye análisis preliminar con buildPreliminaryLaborAnalysis.',
      'Crea el registro definitivo del documento, eventos, contratos canónicos y opinión de Helios.',
      'Despacha el documento al motor compartido.',
      'Retorna document, classification, preliminaryAnalysis, documentContract, sharedEngineEnvelope, heliosOpinion, heliosOpinionContract, engineDispatch y scanAssistance.'
    ],
    implicacion: 'Hoy el backend guarda y despacha el documento inmediatamente; no existe una fase previa formal de previsualización/confirmación antes de guardar.'
  },
  frontend_actual_resumen: {
    pagina: '/auditar',
    flujo: [
      'El usuario elige cámara o archivo.',
      'handleUpload convierte el archivo a base64 y llama una sola vez a uploadDocument.',
      'Después se renderiza lastUpload con resumen sencillo, scanAssistance, datos claros (confirmedEntries) y datos a revisar (estimatedEntries).',
      'No existe aún una pantalla previa de confirmación antes de guardar.'
    ]
  },
  iteracion_objetivo: {
    ocr_estructurado: 'Extraer campos clave según el tipo documental: por ejemplo nómina, CFDI, contrato, IMSS, evidencia, etc., reutilizando el modelo estructurado ya existente si conviene.',
    bordes_camara: 'Agregar guía visual de bordes en tiempo real durante la captura para ayudar a que la hoja se vea completa, derecha y legible.',
    confirmacion_final: 'Antes de guardar definitivamente, mostrar al usuario hallazgos clave de forma humana y simple.'
  },
  decision_real: 'Necesitamos una recomendación aplicada a ESTE codebase, no una respuesta genérica.'
};

const prompt = `Analiza este caso real de una app web mobile-first de auditoría laboral para trabajadores mexicanos.

Quiero una recomendación técnica aplicada al codebase descrito abajo. Hoy el backend ya guarda y despacha el documento en una sola mutación (uploadDocument), y el frontend muestra un resumen DESPUÉS. La nueva iteración pide tres cosas: OCR estructurado por tipo documental, detección de bordes en cámara en tiempo real y pantalla final de confirmación ANTES de guardar.

Necesito que propongas la mejor arquitectura equilibrando fricción mínima, robustez y riesgo de implementación. Debes decidir si conviene:
A) mantener un solo upload definitivo y convertir la confirmación en una revisión posterior,
o
B) introducir un flujo en dos pasos: análisis previo + confirmación + guardado final.

Quiero una respuesta en JSON estricto con esta estructura exacta:
{
  "modelo": "nombre del modelo",
  "veredicto": "A o B",
  "resumen_ejecutivo": "max 120 palabras",
  "porque": ["razón 1", "razón 2", "razón 3"],
  "diseno_backend": {
    "cambios_minimos": ["..."],
    "contrato_recomendado": ["..."],
    "reutilizacion_modelo_existente": "...",
    "riesgo_principal": "..."
  },
  "diseno_frontend": {
    "flujo_usuario": ["paso 1", "paso 2", "paso 3", "paso 4"],
    "pantalla_confirmacion": ["elemento 1", "elemento 2", "elemento 3"],
    "microcopy": ["frase 1", "frase 2", "frase 3"]
  },
  "bordes_en_camara": {
    "recomendacion": "...",
    "nivel": "bajo | medio | alto",
    "estrategia": ["...", "...", "..."],
    "fallback": "..."
  },
  "ocr_estructurado": {
    "campos_por_tipo": ["...", "...", "..."],
    "cuando_confirmar": ["...", "..."],
    "cuando_estimar": ["...", "..."]
  },
  "plan_iteracion": ["paso técnico 1", "paso técnico 2", "paso técnico 3", "paso técnico 4", "paso técnico 5"],
  "alertas": ["...", "..."],
  "puntaje": {
    "friccion": 0,
    "robustez": 0,
    "riesgo_implementacion": 0
  }
}

Usa el siguiente contexto del proyecto:
${JSON.stringify(context, null, 2)}`;

async function postJson(url, options) {
  const response = await fetch(url, options);
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${text.slice(0, 1200)}`);
  }
  return text;
}

function safeParseJson(label, text) {
  try {
    return { ok: true, data: JSON.parse(text) };
  } catch (error) {
    return {
      ok: false,
      data: {
        modelo: label,
        error_parseo: String(error),
        respuesta_cruda: text,
      },
    };
  }
}

async function callOpenAI() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('Falta OPENAI_API_KEY');
  const text = await postJson('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4.1-mini',
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: 'Eres un arquitecto de producto y software. Responde únicamente JSON válido.' },
        { role: 'user', content: prompt },
      ],
    }),
  });
  const json = JSON.parse(text);
  const content = json.choices?.[0]?.message?.content ?? '{}';
  const parsed = safeParseJson('gpt-4.1-mini', content);
  if (parsed.ok && typeof parsed.data === 'object' && parsed.data) parsed.data.modelo = 'gpt-4.1-mini';
  return parsed.data;
}

async function callGrok() {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) throw new Error('Falta XAI_API_KEY');
  const text = await postJson('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'grok-4',
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: 'Eres un arquitecto de producto y software. Responde únicamente JSON válido.' },
        { role: 'user', content: prompt },
      ],
    }),
  });
  const json = JSON.parse(text);
  const content = json.choices?.[0]?.message?.content ?? '{}';
  const parsed = safeParseJson('grok-4', content);
  if (parsed.ok && typeof parsed.data === 'object' && parsed.data) parsed.data.modelo = 'grok-4';
  return parsed.data;
}

async function callGemini() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('Falta GEMINI_API_KEY');
  const text = await postJson(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: 'Eres un arquitecto de producto y software. Responde únicamente JSON válido.' }],
      },
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        temperature: 0.2,
        responseMimeType: 'application/json',
      },
    }),
  });
  const json = JSON.parse(text);
  const content = json.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}';
  const parsed = safeParseJson('gemini-2.5-flash', content);
  if (parsed.ok && typeof parsed.data === 'object' && parsed.data) parsed.data.modelo = 'gemini-2.5-flash';
  return parsed.data;
}

async function main() {
  const startedAt = new Date().toISOString();
  const results = {
    startedAt,
    context,
    results: {},
  };

  for (const [label, fn] of [
    ['openai', callOpenAI],
    ['grok', callGrok],
    ['gemini', callGemini],
  ]) {
    try {
      results.results[label] = await fn();
    } catch (error) {
      results.results[label] = {
        modelo: label,
        error: String(error),
      };
    }
  }

  results.finishedAt = new Date().toISOString();
  await fs.writeFile(OUTPUT_PATH, JSON.stringify(results, null, 2));
  console.log(OUTPUT_PATH);
}

main().catch(async (error) => {
  const failure = {
    startedAt: new Date().toISOString(),
    fatalError: String(error),
  };
  await fs.writeFile(OUTPUT_PATH, JSON.stringify(failure, null, 2));
  console.error(error);
  process.exit(1);
});
