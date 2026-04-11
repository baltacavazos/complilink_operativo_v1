import fs from 'node:fs/promises';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const XAI_API_KEY = process.env.XAI_API_KEY;

if (!OPENAI_API_KEY || !GEMINI_API_KEY || !XAI_API_KEY) {
  throw new Error('Missing one or more API keys in environment');
}

const context = `
Proyecto: complilink_operativo_v1
Objetivo inmediato: avanzar con tres mejoras del flujo legal de /auditar.

Estado actual observado:
1. Frontend en client/src/pages/Auditar.tsx ya registra eventos analytics "legal_gate_viewed" y "legal_package_accepted".
2. El botón de aceptación legal llama a acceptLegalPackageMutation.mutateAsync(...) dentro de handleAcceptLegalPackage().
3. Si falla, hoy solo hace setLegalGateError(...). No existe una estrategia visible de reintento, distinción de conflicto de lock, ni CTA específico para reintentar.
4. En backend, server/routers.ts usa withDatabaseLock con lockKey legal:{tenantId}:{caseId}:{LEGAL_ACCEPTANCE_VERSION} dentro de consent.acceptLegalPackage.
5. El procedimiento ya es idempotente en términos de artefactos: evita duplicados y repara faltantes si ya estaba aceptado.
6. Falta decidir cómo exponer telemetría operativa del lock, cómo mapear errores de concurrencia en la UI y cómo cubrir el flujo con pruebas más robustas.

Quiero implementar estas tres mejoras:
A. Telemetría de lock y/o conflicto cuando dos aceptaciones compiten o cuando el lock retrasa/falla.
B. Reintento controlado en la UI del gate legal de /auditar, sin duplicar aceptaciones y con mensajes claros.
C. Cobertura de pruebas, incluyendo pruebas unitarias/Vitest y una prueba de flujo que valide concurrencia/reintento/idempotencia.

Restricciones:
- Stack: React 19 + Tailwind 4 + Express + tRPC + Vitest.
- No romper la idempotencia ya existente del backend.
- Priorizar robustez operativa sobre cambios cosméticos.
- Preferir cambios pequeños y específicos, fáciles de validar.

Quiero una respuesta muy concreta y comparable con este formato JSON exacto:
{
  "backend_changes": ["..."],
  "frontend_changes": ["..."],
  "tests": ["..."],
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

const settled = await Promise.allSettled([
  callOpenAI(),
  callGemini(),
  callGrok(),
]);

const result = {
  generatedAt: new Date().toISOString(),
  promptSummary: 'Comparativa multi-AI para telemetría de lock, reintento UI y pruebas del gate legal de /auditar',
  openai: settled[0].status === 'fulfilled' ? settled[0].value : { error: String(settled[0].reason) },
  gemini: settled[1].status === 'fulfilled' ? settled[1].value : { error: String(settled[1].reason) },
  grok: settled[2].status === 'fulfilled' ? settled[2].value : { error: String(settled[2].reason) },
};

await fs.writeFile('/home/ubuntu/complilink_operativo_v1/multi_ai_consensus_output.json', JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
