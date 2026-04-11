const prompt = `Eres un arquitecto técnico senior revisando una app web interna con stack React + tRPC + Vitest + Playwright. Responde en español y en formato JSON válido.

Contexto actual:
- Existe un rol CEO maestro con modo "vista como usuario" para demos, sin perder permisos reales.
- Ya se corrigió una regresión de exportación PDF mediante descarga explícita de blob.
- Quedan tres frentes estrictamente acotados: (1) prueba E2E del flujo CEO -> vista usuario -> expediente -> regreso a CEO; (2) validación automática de exportes CSV/PDF descargados; (3) métricas y embudo de uso mínimos para soporte operativo.
- Restricción: mantener el alcance en estabilidad y correcciones bloqueantes, sin abrir frentes nuevos.
- Preferencia: explicaciones simples y directas.

Quiero que propongas un plan de implementación mínimo y robusto para estos tres frentes.

Devuelve JSON con esta forma exacta:
{
  "summary": "máximo 120 palabras",
  "priority_order": ["item1", "item2", "item3"],
  "e2e": {
    "critical_assertions": ["..."],
    "test_strategy": "...",
    "main_risks": ["..."]
  },
  "exports": {
    "critical_assertions": ["..."],
    "validation_strategy": "...",
    "main_risks": ["..."]
  },
  "metrics": {
    "events": ["..."],
    "funnel": ["..."],
    "implementation_hint": "..."
  },
  "recommended_sequence": ["..."],
  "what_not_to_do": ["..."]
}`;

async function callOpenAI() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return { provider: 'chatgpt', ok: false, error: 'OPENAI_API_KEY no disponible' };
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
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
        { role: 'system', content: 'Responde sólo JSON válido.' },
        { role: 'user', content: prompt },
      ],
    }),
  });
  const data = await res.json();
  if (!res.ok) return { provider: 'chatgpt', ok: false, error: JSON.stringify(data) };
  return { provider: 'chatgpt', ok: true, raw: data.choices?.[0]?.message?.content ?? '' };
}

async function callGrok() {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) return { provider: 'grok', ok: false, error: 'XAI_API_KEY no disponible' };
  const res = await fetch('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'grok-3-mini',
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: 'Responde sólo JSON válido.' },
        { role: 'user', content: prompt },
      ],
    }),
  });
  const data = await res.json();
  if (!res.ok) return { provider: 'grok', ok: false, error: JSON.stringify(data) };
  return { provider: 'grok', ok: true, raw: data.choices?.[0]?.message?.content ?? '' };
}

async function callGemini() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { provider: 'gemini', ok: false, error: 'GEMINI_API_KEY no disponible' };
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      generationConfig: {
        temperature: 0.2,
        responseMimeType: 'application/json',
      },
      contents: [{
        role: 'user',
        parts: [{ text: prompt }],
      }],
    }),
  });
  const data = await res.json();
  if (!res.ok) return { provider: 'gemini', ok: false, error: JSON.stringify(data) };
  const raw = data.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('') ?? '';
  return { provider: 'gemini', ok: true, raw };
}

function parseResult(result) {
  if (!result.ok) return result;
  try {
    return { ...result, parsed: JSON.parse(result.raw) };
  } catch (error) {
    return { ...result, ok: false, error: `JSON inválido: ${error instanceof Error ? error.message : String(error)}`, raw: result.raw };
  }
}

const results = await Promise.all([callOpenAI(), callGrok(), callGemini()]);
const parsed = results.map(parseResult);
console.log(JSON.stringify(parsed, null, 2));
