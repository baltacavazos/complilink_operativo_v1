import fs from 'node:fs/promises';
import path from 'node:path';

const outputDir = '/home/ubuntu/complilink_operativo_v1/research/virtuous_cycle_round';

const prompt = `Contexto del producto:
- AuditaPatron es la experiencia visible para trabajadores.
- Helios es el cerebro central que interpreta documentos, señales y contexto.
- CompliLink aporta conectores, resultados operativos y aprendizaje acumulado.
- Objetivo estratégico: todo documento subido por usuarios de AuditaPatron debe alimentar a Helios con trazabilidad y consentimiento; Helios y CompliLink deben retroalimentarse; AuditaPatron debe devolver ese valor al usuario con lenguaje simple, hallazgos claros y siguientes pasos útiles.

Necesito que propongas la mejor siguiente ronda de implementación para la UI y lógica visible en /auditar.

Responde SOLO en JSON válido con esta forma exacta:
{
  "architectural_principle": "string",
  "visible_features": [
    {
      "name": "string",
      "purpose": "string",
      "why_it_matters": "string"
    }
  ],
  "background_integrations": [
    {
      "name": "string",
      "role": "string",
      "guardrail": "string"
    }
  ],
  "user_copy_guidelines": ["string"],
  "next_best_iteration": ["string"],
  "risks": [
    {
      "risk": "string",
      "mitigation": "string"
    }
  ],
  "consent_and_trust": ["string"]
}

Criterios:
- Prioriza experiencia mobile-first.
- Haz a Helios más user friendly e inteligente.
- Debe sentirse como un ciclo virtuoso: más documentos => mejor lectura => mejores hallazgos => mejores recomendaciones.
- No prometas conclusiones jurídicas definitivas.
- Distingue claramente lo visible al usuario vs. lo que debe quedar en segundo plano.
- Piensa como product strategist + UX writer + systems architect.
- Evita jerga técnica innecesaria en la parte visible.`;

async function ensureDir() {
  await fs.mkdir(outputDir, { recursive: true });
}

async function callOpenAI() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY no está disponible');

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
        { role: 'system', content: 'Eres un estratega de producto y arquitectura UX. Debes responder únicamente con JSON válido.' },
        { role: 'user', content: prompt },
      ],
    }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(data, null, 2));
  const content = data.choices?.[0]?.message?.content;
  return typeof content === 'string' ? JSON.parse(content) : content;
}

async function callGemini() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY no está disponible');

  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.2,
        responseMimeType: 'application/json',
      },
    }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(data, null, 2));
  const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || '{}';
  return JSON.parse(text);
}

async function callGrok() {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) throw new Error('XAI_API_KEY no está disponible');

  const res = await fetch('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'grok-4-0709',
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: 'Eres un estratega de producto y arquitectura UX. Debes responder únicamente con JSON válido.' },
        { role: 'user', content: prompt },
      ],
    }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(data, null, 2));
  const content = data.choices?.[0]?.message?.content;
  return typeof content === 'string' ? JSON.parse(content) : content;
}

async function writeJson(name, payload) {
  await fs.writeFile(path.join(outputDir, `${name}.json`), JSON.stringify(payload, null, 2));
}

async function main() {
  await ensureDir();

  const tasks = [
    ['openai', callOpenAI],
    ['gemini', callGemini],
    ['grok', callGrok],
  ];

  for (const [name, fn] of tasks) {
    try {
      const result = await fn();
      await writeJson(name, result);
      console.log(`${name}: ok`);
    } catch (error) {
      await writeJson(`${name}_error`, {
        error: error instanceof Error ? error.message : String(error),
      });
      console.log(`${name}: error`);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
