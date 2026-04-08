import fs from 'node:fs';

const prompt = `Actúa como un lead product engineer exigente para una app móvil-first en español para trabajadores en México.

Contexto del producto:
- App: AuditaPatron.
- Propósito: permitir que un trabajador suba documentos laborales y construya un expediente digital disponible 24/7.
- UX obligatoria: muy simple, confiable, centrada, sin scroll lateral en móvil, con sensación de claridad y “wow factor”.
- No exponer al usuario el motor backend interno ni nombres técnicos internos.
- Pantalla foco: /auditar.

Estado actual de /auditar:
- Ya existe carga documental.
- Ya existen recomendaciones conectadas a faltantes reales.
- Ya existe historial simple con filtros.
- Ya existe onboarding móvil reutilizable.
- Todo está en español.

Siguiente iteración a decidir:
1. Persistir filtros e historial por usuario entre sesiones.
2. Mostrar porcentaje de completitud por tipo documental.
3. Agregar CTA directo desde cada recomendación para subir ese documento específico.

Restricciones técnicas y de UX:
- No hacer una re-arquitectura grande si el valor visible puede lograrse con una solución simple y robusta.
- Mobile-first.
- Debe sentirse más claro, no más pesado.
- El CTA directo debe reducir fricción real.
- La persistencia por usuario puede ser local o remota, pero prioriza la mejor relación entre robustez, velocidad de implementación y experiencia percibida.

Quiero una respuesta ESTRICTA en JSON con esta forma exacta:
{
  "recommended_approach": "texto corto",
  "persistence_strategy": {
    "choice": "local_storage | server_db | hybrid",
    "why": "texto"
  },
  "completion_ui": {
    "pattern": "texto corto",
    "details": ["punto 1", "punto 2", "punto 3"]
  },
  "recommendation_cta": {
    "pattern": "texto corto",
    "microcopy": "texto",
    "interaction": "texto"
  },
  "risks": ["riesgo 1", "riesgo 2"],
  "implementation_notes": ["nota 1", "nota 2", "nota 3"],
  "priority_score": 0
}

Reglas adicionales:
- Responde solo JSON válido.
- priority_score debe ser un número de 0 a 100.
- Favorece soluciones elegantes, simples, intuitivas y fáciles de probar.
- Piensa como cliente exigente, no como programador que quiere complicar.`;

const results = [];

async function callOpenAI() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY missing');
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4.1-mini',
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: 'Eres un product engineer senior experto en UX móvil-first. Devuelves JSON estricto.' },
        { role: 'user', content: prompt },
      ],
    }),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(`OpenAI error: ${response.status} ${JSON.stringify(data)}`);
  }
  const content = data?.choices?.[0]?.message?.content;
  return JSON.parse(content);
}

async function callGrok() {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) throw new Error('XAI_API_KEY missing');
  const response = await fetch('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'grok-4-0709',
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: 'Eres un product engineer senior experto en UX móvil-first. Devuelves JSON estricto.' },
        { role: 'user', content: prompt },
      ],
    }),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(`Grok error: ${response.status} ${JSON.stringify(data)}`);
  }
  const content = data?.choices?.[0]?.message?.content;
  return JSON.parse(content);
}

async function callGemini() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY missing');
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
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
          parts: [{ text: `${prompt}` }],
        },
      ],
    }),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(`Gemini error: ${response.status} ${JSON.stringify(data)}`);
  }
  const content = data?.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('') || '{}';
  return JSON.parse(content);
}

for (const [name, fn] of [
  ['chatgpt', callOpenAI],
  ['grok', callGrok],
  ['gemini', callGemini],
]) {
  try {
    const output = await fn();
    results.push({ provider: name, ok: true, output });
  } catch (error) {
    results.push({ provider: name, ok: false, error: error instanceof Error ? error.message : String(error) });
  }
}

const outPath = '/home/ubuntu/complilink_operativo_v1/multi_ai_consult_results.json';
fs.writeFileSync(outPath, JSON.stringify({ prompt, results }, null, 2));
console.log(outPath);
