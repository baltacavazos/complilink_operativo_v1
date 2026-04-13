import { readFile, writeFile } from 'node:fs/promises';

const [, , promptFile, outputFile] = process.argv;

if (!promptFile || !outputFile) {
  console.error('Usage: node scripts/consult-multimodel.mjs <prompt-file> <output-file>');
  process.exit(1);
}

const prompt = await readFile(promptFile, 'utf8');

async function callOpenAI(input) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return { provider: 'openai', ok: false, error: 'OPENAI_API_KEY missing' };
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
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'auditar_result_redesign',
          strict: true,
          schema: {
            type: 'object',
            additionalProperties: false,
            properties: {
              verdict: { type: 'string' },
              primary_problem: { type: 'string' },
              proposed_structure: {
                type: 'array',
                items: { type: 'string' },
                minItems: 3,
                maxItems: 6,
              },
              what_to_remove: {
                type: 'array',
                items: { type: 'string' },
                minItems: 2,
                maxItems: 6,
              },
              copy_guidelines: {
                type: 'array',
                items: { type: 'string' },
                minItems: 2,
                maxItems: 6,
              },
              assistant_positioning: { type: 'string' },
              expediente_positioning: { type: 'string' },
              confidence: { type: 'number' }
            },
            required: ['verdict', 'primary_problem', 'proposed_structure', 'what_to_remove', 'copy_guidelines', 'assistant_positioning', 'expediente_positioning', 'confidence']
          }
        }
      },
      messages: [
        {
          role: 'system',
          content: 'Eres un experto senior en UX de productos legales para usuarios no expertos. Responde solo con JSON válido y muy concreto.'
        },
        {
          role: 'user',
          content: input
        }
      ]
    })
  });

  const data = await response.json();
  if (!response.ok) {
    return { provider: 'openai', ok: false, error: JSON.stringify(data) };
  }

  const content = data.choices?.[0]?.message?.content;
  return {
    provider: 'openai',
    ok: true,
    model: data.model,
    raw: content,
    parsed: JSON.parse(content)
  };
}

async function callXAI(input) {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) {
    return { provider: 'grok', ok: false, error: 'XAI_API_KEY missing' };
  }

  const response = await fetch('https://api.x.ai/v1/chat/completions', {
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
        {
          role: 'system',
          content: 'Eres un experto senior en UX de productos legales para usuarios no expertos. Devuelve solo JSON válido con las mismas claves pedidas.'
        },
        {
          role: 'user',
          content: input
        }
      ]
    })
  });

  const data = await response.json();
  if (!response.ok) {
    return { provider: 'grok', ok: false, error: JSON.stringify(data) };
  }

  const content = data.choices?.[0]?.message?.content;
  return {
    provider: 'grok',
    ok: true,
    model: data.model,
    raw: content,
    parsed: JSON.parse(content)
  };
}

async function callGemini(input) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { provider: 'gemini', ok: false, error: 'GEMINI_API_KEY missing' };
  }

  const schema = {
    type: 'OBJECT',
    required: ['verdict', 'primary_problem', 'proposed_structure', 'what_to_remove', 'copy_guidelines', 'assistant_positioning', 'expediente_positioning', 'confidence'],
    properties: {
      verdict: { type: 'STRING' },
      primary_problem: { type: 'STRING' },
      proposed_structure: { type: 'ARRAY', items: { type: 'STRING' } },
      what_to_remove: { type: 'ARRAY', items: { type: 'STRING' } },
      copy_guidelines: { type: 'ARRAY', items: { type: 'STRING' } },
      assistant_positioning: { type: 'STRING' },
      expediente_positioning: { type: 'STRING' },
      confidence: { type: 'NUMBER' }
    }
  };

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: 'Eres un experto senior en UX de productos legales para usuarios no expertos. Responde solo con JSON válido y muy concreto.' }]
      },
      contents: [{ role: 'user', parts: [{ text: input }] }],
      generationConfig: {
        temperature: 0.2,
        responseMimeType: 'application/json',
        responseSchema: schema
      }
    })
  });

  const data = await response.json();
  if (!response.ok) {
    return { provider: 'gemini', ok: false, error: JSON.stringify(data) };
  }

  const content = data.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('') ?? '';
  return {
    provider: 'gemini',
    ok: true,
    model: 'gemini-2.5-flash',
    raw: content,
    parsed: JSON.parse(content)
  };
}

const promptEnvelope = `${prompt.trim()}\n\nDevuelve un JSON con exactamente estas claves: verdict, primary_problem, proposed_structure, what_to_remove, copy_guidelines, assistant_positioning, expediente_positioning, confidence. proposed_structure debe describir la secuencia ideal de bloques visibles justo después de subir un documento. what_to_remove debe enfocarse en elementos que sobran o estorban. copy_guidelines debe ser específico para lenguaje de personas no expertas en México.`;

const results = await Promise.allSettled([
  callOpenAI(promptEnvelope),
  callXAI(promptEnvelope),
  callGemini(promptEnvelope),
]);

const normalized = results.map((result) =>
  result.status === 'fulfilled'
    ? result.value
    : { provider: 'unknown', ok: false, error: String(result.reason) }
);

await writeFile(outputFile, `${JSON.stringify({ prompt: promptEnvelope, generatedAt: new Date().toISOString(), results: normalized }, null, 2)}\n`, 'utf8');
console.log(outputFile);
