import fs from 'fs';

const promptPath = process.argv[2];
const outputPath = process.argv[3];

if (!promptPath || !outputPath) {
  console.error('Usage: node scripts/multi_ai_compare.mjs <prompt-file> <output-file>');
  process.exit(1);
}

const prompt = fs.readFileSync(promptPath, 'utf8');
const results = {
  generatedAt: new Date().toISOString(),
  prompt,
  models: {},
};

async function callOpenAI() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return { ok: false, error: 'OPENAI_API_KEY not set' };
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4.1-mini',
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content:
            'Eres un principal product UX + technical architect. Responde en español con cuatro secciones tituladas exactamente: Consenso útil, Recomendaciones de copy, Recomendaciones de integración, Riesgos y guardrails.',
        },
        { role: 'user', content: prompt },
      ],
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    return { ok: false, error: JSON.stringify(data) };
  }

  return {
    ok: true,
    model: data.model,
    content: data.choices?.[0]?.message?.content ?? '',
  };
}

async function callGemini() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { ok: false, error: 'GEMINI_API_KEY not set' };
  }

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      systemInstruction: {
        parts: [
          {
            text: 'Eres un principal product UX + technical architect. Responde en español con cuatro secciones tituladas exactamente: Consenso útil, Recomendaciones de copy, Recomendaciones de integración, Riesgos y guardrails.',
          },
        ],
      },
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        temperature: 0.2,
      },
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    return { ok: false, error: JSON.stringify(data) };
  }

  return {
    ok: true,
    model: data.modelVersion ?? 'gemini-2.5-flash',
    content:
      data.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('\n') ?? '',
  };
}

async function callGrok() {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) {
    return { ok: false, error: 'XAI_API_KEY not set' };
  }

  const response = await fetch('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'grok-4-fast-reasoning',
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content:
            'Eres un principal product UX + technical architect. Responde en español con cuatro secciones tituladas exactamente: Consenso útil, Recomendaciones de copy, Recomendaciones de integración, Riesgos y guardrails.',
        },
        { role: 'user', content: prompt },
      ],
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    return { ok: false, error: JSON.stringify(data) };
  }

  return {
    ok: true,
    model: data.model,
    content: data.choices?.[0]?.message?.content ?? '',
  };
}

async function main() {
  results.models.openai = await callOpenAI();
  results.models.gemini = await callGemini();
  results.models.grok = await callGrok();
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
  console.log(`Saved comparison to ${outputPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
