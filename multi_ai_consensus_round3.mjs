import fs from 'node:fs/promises';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const XAI_API_KEY = process.env.XAI_API_KEY;

if (!OPENAI_API_KEY || !GEMINI_API_KEY || !XAI_API_KEY) {
  throw new Error('Missing one or more API keys in environment');
}

const context = `
Proyecto: complilink_operativo_v1
Pantalla objetivo: /auditar en Auditapatron.

Problema de producto:
El gate legal activo se siente confuso y demasiado visible para una persona normal. El usuario percibe la aceptación legal como un paso extra, separado del acto natural de subir documentos. Queremos cumplir la ley, pero sin que el usuario sienta que está cediendo derechos ni entrando a un proceso desconfiable.

Criterios obligatorios:
1. El consentimiento debe quedar integrado al flujo natural de subir algo, no como barrera aparte.
2. Debe ser lo menos intrusivo, lo más sutil y lo más fluido posible.
3. Si hay clics legales necesarios, deben sentirse como parte orgánica del proceso de subida.
4. El lenguaje debe ser protector, claro y tranquilizador; nunca agresivo, técnico ni alarmante.
5. Debe mantenerse trazabilidad operativa y validez legal del consentimiento.
6. UX mobile-first, simple y comprensible para público masivo.
7. Debe evitar cualquier sensación de cesión amplia de derechos.

Quiero que propongas el mejor patrón UX/legal para esto. Compara opciones como:
- consentimiento inline cerca del CTA de subir,
- consentimiento implícito con aviso breve junto al botón,
- microcopy integrado en el área de carga,
- checkbox único embebido en el último paso de subir,
- sheet o drawer sutil solo si hace falta ampliar información,
- links secundarios a términos completos sin romper el flujo.

También quiero recomendaciones concretas de microcopy en español para México, tono protector y de confianza.

Responde con JSON exacto en este formato:
{
  "recommended_pattern": {
    "name": "",
    "why": [""],
    "legal_capture_moment": "",
    "user_visible_elements": [""],
    "avoid": [""]
  },
  "microcopy": {
    "primary": "",
    "secondary": "",
    "link_label": "",
    "checkbox_label": ""
  },
  "interaction_model": [""],
  "compliance_notes": [""],
  "implementation_notes": [""],
  "risks": [""]
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
        { role: 'system', content: 'Eres un arquitecto UX/legal senior para productos de consumo. Responde solo JSON válido.' },
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
          parts: [{ text: `Eres un arquitecto UX/legal senior para productos de consumo. Responde solo JSON válido. ${context}` }],
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
        { role: 'system', content: 'Eres un arquitecto UX/legal senior para productos de consumo. Responde solo JSON válido.' },
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
  promptSummary: 'Consenso multi-AI para rediseñar el consentimiento legal de /auditar con mínima fricción e integración natural al flujo de subida',
  openai: settled[0].status === 'fulfilled' ? settled[0].value : { error: String(settled[0].reason) },
  gemini: settled[1].status === 'fulfilled' ? settled[1].value : { error: String(settled[1].reason) },
  grok: settled[2].status === 'fulfilled' ? settled[2].value : { error: String(settled[2].reason) },
};

await fs.writeFile('/home/ubuntu/complilink_operativo_v1/multi_ai_consensus_round3_output.json', JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
