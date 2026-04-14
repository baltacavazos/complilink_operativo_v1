import fs from 'fs/promises';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const XAI_API_KEY = process.env.XAI_API_KEY;

if (!OPENAI_API_KEY || !GEMINI_API_KEY || !XAI_API_KEY) {
  throw new Error('Missing one or more API keys in environment');
}

const context = `
Proyecto: complilink_operativo_v1 / AuditaPatron
Tarea: corregir el landing público móvil y desktop.

Problema confirmado:
- En el landing se está mostrando texto interno de trabajo al usuario final.
- Copy visible actual en client/src/lib/pricingExperience.ts:
  eyebrow: "Primero úsalo gratis"
  title: "No necesitas pagar para entender si AuditaPatrón te puede ayudar."
  description: "El landing debe vender confianza y utilidad inmediata. Las opciones de pago aparecen después, dentro de tu expediente, solo cuando ya viste valor real y te sirven para avanzar con más respaldo."
  principles:
  1. "Empieza gratis con tu primer documento."
  2. "Recibe claridad antes de tomar cualquier decisión de pago."
  3. "Las mejoras se presentan solo dentro de tu expediente y sin interrumpirte."

Contexto del producto:
- AuditaPatron ayuda a una persona trabajadora a subir un documento laboral y recibir una auditoría clara.
- El landing debe sonar comercial, confiable, simple y orientado a conversión.
- No debe mostrar instrucciones internas, racionales de producto ni lenguaje meta como "el landing debe...".
- Debe leerse natural para usuario real en México.
- Queremos una corrección mínima pero sólida: reemplazar el copy incorrecto sin reestructurar toda la página.

Devuélveme SOLO JSON válido con este formato exacto:
{
  "diagnosis": ["..."],
  "recommended_eyebrow": "...",
  "recommended_title": "...",
  "recommended_description": "...",
  "recommended_principles": ["...", "...", "..."],
  "guardrails": ["..."],
  "minimal_edit_strategy": ["..."]
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
        { role: 'system', content: 'Eres un estratega senior de producto y copy UX. Responde solo JSON válido.' },
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
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [{ text: `Eres un estratega senior de producto y copy UX. Responde solo JSON válido. ${context}` }],
        },
      ],
      generationConfig: {
        temperature: 0.2,
        responseMimeType: 'application/json',
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Gemini error ${response.status}: ${await response.text()}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('') ?? '{}';
  return JSON.parse(text);
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
        { role: 'system', content: 'Eres un estratega senior de producto y copy UX. Responde solo JSON válido.' },
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
  promptSummary: 'Consenso multi-IA para corregir copy interno visible en el landing de AuditaPatron',
  openai: settled[0].status === 'fulfilled' ? settled[0].value : { error: String(settled[0].reason) },
  gemini: settled[1].status === 'fulfilled' ? settled[1].value : { error: String(settled[1].reason) },
  grok: settled[2].status === 'fulfilled' ? settled[2].value : { error: String(settled[2].reason) },
};

await fs.writeFile('/home/ubuntu/complilink_operativo_v1/tmp_multi_ai_landing_copy_fix_results.json', JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
