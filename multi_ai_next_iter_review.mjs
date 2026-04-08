import fs from 'node:fs/promises';

const OUTPUT_PATH = '/home/ubuntu/complilink_operativo_v1/multi_ai_next_iter_review_results.json';

const context = {
  proyecto: 'AuditaPatron / complilink_operativo_v1',
  estado_actual: 'La app ya tiene flujo analizar → confirmar → guardar en /auditar, con preanálisis temporal, OCR estructurado por tipo documental, pantalla de confirmación previa al guardado y guía visual de captura mobile-first.',
  usuarioFinal: 'Trabajadores mexicanos con baja alfabetización digital; el flujo debe sentirse claro, humano y usable en celular.',
  objetivo: 'Definir la mejor siguiente iteración visible en /auditar sin aumentar fricción innecesaria.',
  candidatos: [
    'Permitir edición manual de campos detectados antes de confirmar el guardado final.',
    'Mostrar una recomendación automática del siguiente mejor documento según el expediente actual.',
    'Añadir microinteracciones suaves en cámara, vista previa y confirmación para reforzar claridad y sensación de respuesta.'
  ],
  restricciones: [
    'Debe mantenerse mobile-first y sin sobrecarga visual.',
    'No debe romper el flujo actual ya validado por pruebas.',
    'La prioridad es claridad, confianza y utilidad real para la persona usuaria.',
    'La intervención manual debe ser mínima, pero suficiente para corregir errores importantes.',
    'Si hay recomendaciones de UX, deben ser implementables con riesgo bajo o medio en esta base de código.'
  ],
  decision_requerida: 'Necesitamos una priorización aplicada a ESTE producto y un alcance recomendado para la siguiente iteración, no ideas genéricas.'
};

const prompt = `Analiza este caso real de producto y software.

La aplicación AuditaPatron ya implementó en /auditar un flujo analizar → confirmar → guardar. Ahora quiero decidir la SIGUIENTE iteración visible más conveniente entre tres frentes:
1) edición manual de campos detectados antes de confirmar,
2) recomendación automática del siguiente mejor documento,
3) microinteracciones suaves en cámara, vista previa y confirmación.

Quiero que propongas una priorización práctica y un alcance realista para esta siguiente ronda. Debes tomar postura sobre si conviene:
A) implementar solo un frente primero,
B) combinar dos frentes en una misma iteración,
C) hacer una iteración pequeña transversal.

Responde en JSON estricto con esta estructura exacta:
{
  "modelo": "nombre del modelo",
  "veredicto": "A | B | C",
  "resumen_ejecutivo": "max 120 palabras",
  "prioridad": [
    {"frente": "edicion_manual | siguiente_documento | microinteracciones", "prioridad": 1, "motivo": "..."},
    {"frente": "edicion_manual | siguiente_documento | microinteracciones", "prioridad": 2, "motivo": "..."},
    {"frente": "edicion_manual | siguiente_documento | microinteracciones", "prioridad": 3, "motivo": "..."}
  ],
  "alcance_recomendado": {
    "para_esta_iteracion": ["...", "...", "..."],
    "dejar_despues": ["...", "..."]
  },
  "diseno_ux": {
    "edicion_manual": ["...", "...", "..."],
    "siguiente_documento": ["...", "...", "..."],
    "microinteracciones": ["...", "...", "..."]
  },
  "riesgos": ["...", "...", "..."],
  "guardrails": ["...", "...", "..."],
  "plan_tecnico": ["paso 1", "paso 2", "paso 3", "paso 4", "paso 5"],
  "microcopy_ejemplo": ["...", "...", "..."],
  "puntajes": {
    "impacto_usuario": 0,
    "riesgo_implementacion": 0,
    "claridad": 0,
    "velocidad_entrega": 0
  }
}

Usa este contexto del proyecto:
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
