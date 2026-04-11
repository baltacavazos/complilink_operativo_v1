const prompt = `Contexto actual:
- Ya existe un dashboard CEO con modo "vista como usuario", exportes CSV/PDF validados y un tracking básico de eventos.
- El siguiente bloque aprobado tiene tres partes: (1) panel maestro con métricas visibles solo para el usuario administrador principal; (2) registro más claro de bloqueos de seguridad y guardrails para diagnóstico; (3) pruebas Vitest y Playwright para snapshot stale, reintentos y errores controlados.
- Restricción: mantener el alcance pequeño, robusto y sin romper la experiencia actual.
- Preferencia: explicaciones simples y directas.

Quiero que propongas un plan mínimo y robusto para implementar estas tres mejoras en un proyecto React + Express + tRPC ya existente.

Devuelve JSON con esta forma exacta:
{
  "summary": "máximo 120 palabras",
  "priority_order": ["item1", "item2", "item3"],
  "master_metrics_panel": {
    "must_show": ["..."],
    "access_control": "...",
    "implementation_hint": "..."
  },
  "guardrail_logging": {
    "events_to_record": ["..."],
    "fields": ["..."],
    "main_risks": ["..."]
  },
  "failure_testing": {
    "vitest_cases": ["..."],
    "playwright_cases": ["..."],
    "main_risks": ["..."]
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
