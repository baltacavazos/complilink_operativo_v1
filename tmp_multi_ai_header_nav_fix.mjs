import fs from 'node:fs/promises';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const XAI_API_KEY = process.env.XAI_API_KEY;

if (!OPENAI_API_KEY || !GEMINI_API_KEY || !XAI_API_KEY) {
  throw new Error('Missing one or more API keys in environment');
}

const context = `
Proyecto: complilink_operativo_v1
Problema: en el landing de AuditaPatron, los botones superiores 'Cómo funciona', 'Tu expediente' y 'Asistente' no funcionan bien en la preview.

Hallazgo técnico ya confirmado:
1. El header usa enlaces con href '#como-funciona', '#expediente' y '#copiloto'.
2. En client/src/pages/Home.tsx existen secciones reales con ids como-funciona, expediente y copiloto.
3. Pero también existen ids duplicados en bloques internos/móviles. En la DOM, querySelectorAll('#como-funciona') y querySelectorAll('#expediente') devuelven primero un DIV superior con topDoc 0 y luego la SECTION real más abajo.
4. Resultado: el hash cambia, pero el navegador resuelve el primer id duplicado y no desplaza al bloque esperado.
5. Ya existe una función scrollToId(id) que hace scrollIntoView sobre document.getElementById(id).

Restricciones:
- Quiero una corrección mínima, robusta y fácil de probar.
- Stack: React 19 + Tailwind 4 + Vitest + Playwright.
- Evitar parches frágiles.
- Quiero que el header funcione tanto en desktop como en menú móvil.

Devuélveme solo JSON válido con este formato exacto:
{
  "root_cause": ["..."],
  "minimal_code_changes": ["..."],
  "test_guardrails": ["..."],
  "recommended_fix": ["..."]
}
`;

async function callOpenAI() {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4.1-mini',
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: 'Eres un arquitecto frontend senior. Responde solo JSON válido.' },
        { role: 'user', content: context },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI error ${response.status}: ${await response.text()}`);
  }

  const data = await response.json();
  return JSON.parse(data.choices?.[0]?.message?.content ?? '{}');
}

async function callGemini() {
  const models = ['gemini-2.5-flash', 'gemini-2.0-flash'];
  let lastError = null;

  for (const model of models) {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [{ text: `Eres un arquitecto frontend senior. Responde solo JSON válido. ${context}` }],
          },
        ],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: 'application/json',
        },
      }),
    });

    if (response.ok) {
      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('') ?? '{}';
      return JSON.parse(text);
    }

    lastError = `Gemini ${model} error ${response.status}: ${await response.text()}`;
  }

  throw new Error(lastError ?? 'Gemini error desconocido');
}

async function callGrok() {
  const response = await fetch('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${XAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'grok-3-mini',
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: 'Eres un arquitecto frontend senior. Responde solo JSON válido.' },
        { role: 'user', content: context },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`Grok error ${response.status}: ${await response.text()}`);
  }

  const data = await response.json();
  return JSON.parse(data.choices?.[0]?.message?.content ?? '{}');
}

const settled = await Promise.allSettled([callOpenAI(), callGemini(), callGrok()]);

const result = {
  generatedAt: new Date().toISOString(),
  promptSummary: 'Consenso multi-IA para corregir la navegación superior del landing con ids duplicados',
  openai: settled[0].status === 'fulfilled' ? settled[0].value : { error: String(settled[0].reason) },
  gemini: settled[1].status === 'fulfilled' ? settled[1].value : { error: String(settled[1].reason) },
  grok: settled[2].status === 'fulfilled' ? settled[2].value : { error: String(settled[2].reason) },
};

await fs.writeFile('/home/ubuntu/complilink_operativo_v1/tmp_multi_ai_header_nav_fix_results.json', JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
