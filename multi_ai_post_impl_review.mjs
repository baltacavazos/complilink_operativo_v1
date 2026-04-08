import fs from 'node:fs/promises';

const OUTPUT_PATH = '/home/ubuntu/complilink_operativo_v1/multi_ai_post_impl_review_results.json';

const context = {
  proyecto: 'AuditaPatron / complilink_operativo_v1',
  objetivo_validacion: 'Validar post-implementación la nueva iteración visible de /auditar antes del cierre técnico.',
  implementado: {
    flujo_base: 'La app ya cuenta con analizar → confirmar → guardar en /auditar.',
    nueva_iteracion: [
      'Edición manual opcional de campos críticos dentro de la confirmación previa al guardado.',
      'Recomendación automática del siguiente documento ideal dentro de la vista previa.',
      'Microinteracciones suaves en vista previa, confirmación, guardado y CTAs persistentes.',
      'El guardado final ya acepta manualOverrides y fusiona esos cambios con el preanálisis antes de persistir.'
    ],
    validacion_local: [
      'TypeScript compila sin errores.',
      'Vitest pasa: 36 pruebas exitosas.',
      'La intención UX sigue siendo mobile-first, clara y con baja fricción.'
    ]
  },
  usuario_final: 'Trabajadores mexicanos con baja alfabetización digital; el flujo debe sentirse humano, confiable y muy fácil de usar en celular.',
  restricciones: [
    'No aumentar fricción ni convertir la confirmación en un formulario pesado.',
    'Las microinteracciones deben aportar claridad, no decoración.',
    'La recomendación del siguiente documento debe sentirse útil y natural, no invasiva.',
    'La edición manual debe limitarse a campos críticos y opcionales.',
    'El análisis debe enfocarse en esta implementación específica, no en ideas genéricas.'
  ],
  pregunta_central: '¿La iteración implementada quedó bien priorizada y bien aterrizada? ¿Qué refinamientos concretos conviene hacer después sin rehacer el flujo?'
};

const prompt = `Analiza esta implementación REAL ya terminada de producto y software.

Necesito una revisión post-implementación de la nueva iteración de /auditar en AuditaPatron.

Contexto implementado:
${JSON.stringify(context, null, 2)}

Quiero que evalúes si la combinación de:
1) edición manual opcional de campos críticos,
2) recomendación automática del siguiente documento,
3) microinteracciones suaves,
quedó bien priorizada para este producto y este tipo de usuario.

Debes responder SOLO JSON válido con esta estructura exacta:
{
  "modelo": "nombre del modelo",
  "veredicto_general": "aprobado | aprobado_con_ajustes | replantear_parcialmente",
  "resumen_ejecutivo": "max 120 palabras",
  "evaluacion": {
    "edicion_manual": {"calificacion": 0, "comentario": "..."},
    "siguiente_documento": {"calificacion": 0, "comentario": "..."},
    "microinteracciones": {"calificacion": 0, "comentario": "..."},
    "claridad_para_usuario": {"calificacion": 0, "comentario": "..."},
    "riesgo_de_friccion": {"calificacion": 0, "comentario": "..."}
  },
  "lo_mejor_logrado": ["...", "...", "..."],
  "riesgos_detectados": ["...", "...", "..."],
  "ajustes_prioritarios": [
    {"prioridad": 1, "ajuste": "...", "por_que": "..."},
    {"prioridad": 2, "ajuste": "...", "por_que": "..."},
    {"prioridad": 3, "ajuste": "...", "por_que": "..."}
  ],
  "guardrails_ux": ["...", "...", "..."],
  "siguiente_iteracion_recomendada": {
    "enfoque": "...",
    "alcance": ["...", "...", "..."],
    "evitar": ["...", "..."]
  },
  "microcopy_sugerido": ["...", "...", "..."],
  "decision_final": "max 80 palabras"
}`;

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
        { role: 'system', content: 'Eres un auditor de producto y UX. Responde únicamente JSON válido.' },
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
        { role: 'system', content: 'Eres un auditor de producto y UX. Responde únicamente JSON válido.' },
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
        parts: [{ text: 'Eres un auditor de producto y UX. Responde únicamente JSON válido.' }],
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
