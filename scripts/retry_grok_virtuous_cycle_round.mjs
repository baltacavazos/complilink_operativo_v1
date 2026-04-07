import fs from 'node:fs/promises';

const outputPath = '/home/ubuntu/complilink_operativo_v1/research/virtuous_cycle_round/grok_retry.json';

const prompt = `Responde SOLO con JSON válido. Contexto: AuditaPatron captura documentos del usuario; Helios es el cerebro central; CompliLink aporta conectores, reglas y contexto operativo. Objetivo: todo documento subido debe alimentar a Helios con trazabilidad y consentimiento; Helios y CompliLink se retroalimentan; AuditaPatron devuelve valor al usuario con lenguaje simple, hallazgos claros y siguientes pasos útiles.\n\nDevuélveme este JSON exacto:\n{\n  "architectural_principle": "string",\n  "top_visible_feature": "string",\n  "top_background_integration": "string",\n  "top_guardrail": "string",\n  "next_iteration": ["string", "string", "string"]\n}`;

async function main() {
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
      temperature: 0.1,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: 'Responde únicamente con JSON válido, sin markdown.' },
        { role: 'user', content: prompt },
      ],
    }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(data, null, 2));

  const content = data.choices?.[0]?.message?.content ?? '{}';
  await fs.writeFile(outputPath, typeof content === 'string' ? content : JSON.stringify(content, null, 2));
  console.log('grok retry ok');
}

main().catch(async (error) => {
  await fs.writeFile(outputPath, JSON.stringify({ error: error instanceof Error ? error.message : String(error) }, null, 2));
  console.error(error);
  process.exit(1);
});
