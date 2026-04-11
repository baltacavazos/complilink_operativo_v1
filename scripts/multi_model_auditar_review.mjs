import fs from 'fs';

const [,, contextPath, outputPath] = process.argv;

if (!contextPath || !outputPath) {
  console.error('Usage: node scripts/multi_model_auditar_review.mjs <contextPath> <outputPath>');
  process.exit(1);
}

const context = fs.readFileSync(contextPath, 'utf8');

const prompt = [
  'Eres un asesor senior de producto y UX mobile-first para una app llamada AuditaPatron.',
  'Necesito recomendaciones concretas y ejecutables para reducir fricción en la ruta /auditar, especialmente en el flujo móvil de carga documental.',
  'Objetivo del negocio: que subir el primer documento desde celular sea extremadamente simple, claro y confiable.',
  'Restricciones operativas: no mencionar Helios al usuario final, no introducir complejidad visual innecesaria, priorizar infraestructura y claridad sobre ornamentación, y reforzar que mientras más documentos se suban más crece el expediente y más valor recibe el usuario.',
  'Quiero una respuesta corta y accionable con este formato JSON estricto:',
  '{"diagnosis":"...","top_changes":[{"title":"...","why":"...","implementation_hint":"..."}],"avoid":["..."],"mobile_copy":"...","confidence":0.0}',
  'No expliques fuera del JSON.',
  '',
  'Contexto real del flujo actual:',
  context,
].join('\n');

async function callOpenAI() {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4.1-mini',
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: 'Responde únicamente JSON válido.' },
        { role: 'user', content: prompt },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI ${response.status}: ${await response.text()}`);
  }

  const data = await response.json();
  return JSON.parse(data.choices[0].message.content);
}

async function callXAI() {
  const response = await fetch('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.XAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'grok-3-mini',
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: 'Responde únicamente JSON válido.' },
        { role: 'user', content: prompt },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`xAI ${response.status}: ${await response.text()}`);
  }

  const data = await response.json();
  return JSON.parse(data.choices[0].message.content);
}

async function callGemini() {
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      generationConfig: {
        temperature: 0.2,
        responseMimeType: 'application/json',
      },
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }],
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`Gemini ${response.status}: ${await response.text()}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('') || '{}';
  return JSON.parse(text);
}

function normalize(model, payload) {
  return {
    model,
    diagnosis: payload.diagnosis ?? null,
    top_changes: Array.isArray(payload.top_changes) ? payload.top_changes.slice(0, 3) : [],
    avoid: Array.isArray(payload.avoid) ? payload.avoid.slice(0, 5) : [],
    mobile_copy: payload.mobile_copy ?? null,
    confidence: typeof payload.confidence === 'number' ? payload.confidence : null,
  };
}

const results = {};
const errors = {};

for (const [name, fn] of Object.entries({ openai: callOpenAI, xai: callXAI, gemini: callGemini })) {
  try {
    results[name] = normalize(name, await fn());
  } catch (error) {
    errors[name] = error instanceof Error ? error.message : String(error);
  }
}

const report = {
  createdAt: new Date().toISOString(),
  contextPath,
  results,
  errors,
};

fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
console.log(`Saved multi-model review to ${outputPath}`);
