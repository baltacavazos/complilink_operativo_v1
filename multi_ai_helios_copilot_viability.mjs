import fs from 'node:fs/promises';

const OUTPUT_PATH = '/home/ubuntu/complilink_operativo_v1/multi_ai_helios_copilot_viability_results.json';

const context = {
  proyecto: 'AuditaPatron / complilink_operativo_v1',
  estado_actual: {
    producto: 'AuditaPatron ya permite a la persona subir documentos laborales, analizarlos y consolidar un expediente digital con ayuda del motor Helios.',
    flujo_actual: 'En /auditar ya existe un flujo analizar → confirmar → guardar, con preanálisis temporal, OCR estructurado, confirmación previa, edición manual opcional, recomendación del siguiente documento y microinteracciones suaves.',
    integracion_helios: 'Helios ya opera como motor central de interpretación y ya existe un copiloto legal accesible desde la página de CompliLink.',
    restriccion: 'La nueva propuesta debe ser una capa extra, sin destruir ni rehacer el flujo actual.'
  },
  propuesta_a_evaluar: {
    landing: 'Dejar mucho más claro en el landing qué valor recibe la persona a cambio de subir sus documentos.',
    copiloto: 'Usar el mismo copiloto legal de CompliLink dentro de AuditaPatron.',
    posicionamiento: 'Venderlo como “un abogado laboral en tu bolsillo”, alimentado por tus propios datos y dándote consejos sobre tus propios datos.',
    arquitectura: 'Todo debe entrar y salir del motor Helios.'
  },
  usuario_objetivo: 'Trabajadores mexicanos con baja alfabetización digital que necesitan claridad, confianza y utilidad concreta en celular.',
  preguntas_clave: [
    '¿Es buena idea de producto y posicionamiento?',
    '¿Es viable técnicamente como extensión sin romper lo ya construido?',
    '¿Cómo debería presentarse en landing y producto sin sobreprometer?',
    '¿Qué riesgos legales, UX y de arquitectura deben cuidarse?',
    '¿Cuál sería el alcance más seguro para una primera versión?'
  ],
  restricciones: [
    'No destruir el flujo actual de /auditar.',
    'No duplicar lógica si Helios ya resuelve inteligencia y copiloto.',
    'La promesa comercial debe ser potente pero responsable.',
    'La experiencia debe sentirse simple, humana y mobile-first.',
    'La recomendación debe enfocarse en una capa extra reutilizable, no en una reescritura total.'
  ]
};

const prompt = `Analiza esta decisión real de producto, arquitectura y posicionamiento.

Contexto:
${JSON.stringify(context, null, 2)}

Quiero que evalúes si AuditaPatron debería incorporar, como capa extra, el mismo copiloto legal ya existente en CompliLink pero presentado dentro de AuditaPatron como una ayuda laboral personalizada alimentada por los datos del expediente y por el motor Helios.

Necesito una postura concreta sobre estos puntos:
1. si la idea es fuerte o débil como propuesta de valor,
2. si “abogado laboral en tu bolsillo” es buen posicionamiento o necesita matices,
3. si es viable técnicamente sin romper nada de lo ya construido,
4. cuál sería la forma correcta de integrarlo al landing y al producto,
5. cuál debería ser la primera versión segura.

Responde SOLO JSON válido con esta estructura exacta:
{
  "modelo": "nombre del modelo",
  "veredicto_general": "si_como_capa_extra | si_con_matices | no_asi",
  "resumen_ejecutivo": "max 140 palabras",
  "valor_de_producto": {
    "calificacion": 0,
    "comentario": "..."
  },
  "posicionamiento": {
    "frase_propuesta": "...",
    "evaluacion": "...",
    "riesgo": "...",
    "alternativa_mas_segura": "..."
  },
  "viabilidad_tecnica": {
    "calificacion": 0,
    "comentario": "...",
    "arquitectura_recomendada": ["...", "...", "..."]
  },
  "landing": {
    "que_debe_quedar_claro": ["...", "...", "..."],
    "mensajes_clave": ["...", "...", "..."],
    "evitar": ["...", "..."]
  },
  "producto": {
    "como_integrarlo": ["...", "...", "..."],
    "primera_version_segura": ["...", "...", "..."],
    "dejar_para_despues": ["...", "..."]
  },
  "riesgos": {
    "legales": ["...", "..."],
    "ux": ["...", "..."],
    "tecnicos": ["...", "..."]
  },
  "guardrails": ["...", "...", "..."],
  "copy_sugerido_landing": {
    "headline": "...",
    "subheadline": "...",
    "beneficios": ["...", "...", "..."]
  },
  "decision_recomendada": "max 120 palabras"
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
        { role: 'system', content: 'Eres un estratega de producto, UX y arquitectura. Responde únicamente JSON válido.' },
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
        { role: 'system', content: 'Eres un estratega de producto, UX y arquitectura. Responde únicamente JSON válido.' },
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
        parts: [{ text: 'Eres un estratega de producto, UX y arquitectura. Responde únicamente JSON válido.' }],
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
