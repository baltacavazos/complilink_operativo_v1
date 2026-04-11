import fs from 'node:fs/promises';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const XAI_API_KEY = process.env.XAI_API_KEY;

if (!OPENAI_API_KEY || !GEMINI_API_KEY || !XAI_API_KEY) {
  throw new Error('Missing one or more API keys in environment');
}

const context = `
Proyecto: complilink_operativo_v1
Objetivo inmediato: implementar tres mejoras adicionales del gate legal de /auditar.

Estado actual observado:
1. El backend ya traduce conflictos de withDatabaseLock a un error de concurrencia explícito para consent.acceptLegalPackage.
2. El frontend de /auditar ya tiene reintento controlado del gate legal ante conflictos de lock.
3. Existen pruebas Vitest de concurrencia, retry e idempotencia en backend.
4. Aún falta una prueba de navegador del flujo real de reintento en UI.
5. Aún faltan métricas visibles u operativas en la interfaz para diagnosticar lock contention y tiempos de espera.
6. El mensaje de error legal puede mejorar con un temporizador corto y feedback progresivo de reintento.

Quiero implementar estas tres mejoras:
A. Una prueba de navegador o prueba de UI realista que valide el reintento del gate legal en /auditar.
B. Métricas operativas visibles del lock legal en /auditar, minimizando complejidad y sin abrir una superficie innecesaria al usuario final.
C. Un mensaje de error legal mejorado con temporizador breve, countdown o estado de espera/reintento progresivo.

Restricciones:
- Stack: React 19 + Tailwind 4 + Express + tRPC + Vitest.
- Cambios pequeños, específicos y fáciles de validar.
- No romper el comportamiento actual de idempotencia ni el gate legal ya endurecido.
- Dar prioridad a claridad operativa, UX móvil y robustez.
- Para métricas visibles, preferir reutilizar el tracking y componentes ya existentes.

Quiero una respuesta muy concreta y comparable con este formato JSON exacto:
{
  "browser_test": ["..."],
  "visible_metrics": ["..."],
  "error_ux": ["..."],
  "risks": ["..."],
  "recommended_minimal_plan": ["..."]
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
        { role: 'system', content: 'Eres un arquitecto full-stack senior. Responde solo JSON válido.' },
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
          parts: [{ text: `Eres un arquitecto full-stack senior. Responde solo JSON válido. ${context}` }],
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
        { role: 'system', content: 'Eres un arquitecto full-stack senior. Responde solo JSON válido.' },
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
  promptSummary: 'Comparativa multi-AI para prueba de navegador, métricas visibles del lock y UX del error legal en /auditar',
  openai: settled[0].status === 'fulfilled' ? settled[0].value : { error: String(settled[0].reason) },
  gemini: settled[1].status === 'fulfilled' ? settled[1].value : { error: String(settled[1].reason) },
  grok: settled[2].status === 'fulfilled' ? settled[2].value : { error: String(settled[2].reason) },
};

await fs.writeFile('/home/ubuntu/complilink_operativo_v1/multi_ai_consensus_round2_output.json', JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
