import fs from "node:fs/promises";
import path from "node:path";

const outputDir = "/home/ubuntu/complilink_operativo_v1/research/auditar_next_block_multi_ai";
await fs.mkdir(outputDir, { recursive: true });

const prompt = `Contexto del producto:
- Producto: AuditaPatron.
- Público: trabajadores no técnicos que construyen un expediente laboral.
- Idioma: español.
- Restricción central: Helios debe sentirse como el cerebro central que interpreta y guía, pero sin sonar técnico.
- Estado actual: existe /auditar con carga documental, lectura preliminar, separación entre dato confirmado y estimado, microestados de Helios y lista de documentos del expediente.
- Helios remoto sigue en modo mock; no activar integración remota todavía.

Bloque aprobado para implementar ahora:
1. Una tarjeta de “siguiente mejor documento” que diga qué archivo conviene subir después y por qué fortalece el expediente.
2. Una línea de tiempo simple del expediente que muestre cómo Helios fortalece el caso documento por documento.
3. Criterios de prueba para validar la implementación.

Necesito una propuesta de UX y contenido MUY concreta y aplicable en frontend, con enfoque mobile-first.

Responde SOLO en JSON válido con esta estructura exacta:
{
  "card": {
    "title": "string",
    "explanation": "string",
    "why_it_helps": "string",
    "empty_state": "string"
  },
  "timeline": {
    "title": "string",
    "intro": "string",
    "empty_state": "string",
    "stages": [
      {
        "label": "string",
        "description": "string",
        "helios_role": "string"
      }
    ]
  },
  "ui_rules": ["string"],
  "test_cases": ["string"],
  "risks": ["string"],
  "implementation_notes": ["string"]
}`;

async function callOpenAI() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY no está disponible");

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4.1-mini",
      temperature: 0.4,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "Eres un experto en UX legal-tech en español. Diseñas interfaces móviles simples, confiables y no técnicas. Siempre posicionas a Helios como el cerebro central del expediente sin prometer certeza absoluta.",
        },
        { role: "user", content: prompt },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI error ${response.status}: ${await response.text()}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("OpenAI no devolvió contenido");
  return JSON.parse(content);
}

async function callGemini() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY no está disponible");

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [
            {
              text: "Eres un experto en UX legal-tech en español. Diseñas interfaces móviles simples, confiables y no técnicas. Siempre posicionas a Helios como el cerebro central del expediente sin prometer certeza absoluta.",
            },
          ],
        },
        generationConfig: {
          temperature: 0.4,
          responseMimeType: "application/json",
        },
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }],
          },
        ],
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`Gemini error ${response.status}: ${await response.text()}`);
  }

  const data = await response.json();
  const content = data.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("");
  if (!content) throw new Error("Gemini no devolvió contenido");
  return JSON.parse(content);
}

async function callGrok() {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) throw new Error("XAI_API_KEY no está disponible");

  const response = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "grok-4",
      temperature: 0.4,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "Eres un experto en UX legal-tech en español. Diseñas interfaces móviles simples, confiables y no técnicas. Siempre posicionas a Helios como el cerebro central del expediente sin prometer certeza absoluta.",
        },
        { role: "user", content: prompt },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`Grok error ${response.status}: ${await response.text()}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("Grok no devolvió contenido");
  return JSON.parse(content);
}

const results = {};
const failures = {};

for (const [name, fn] of [
  ["openai", callOpenAI],
  ["gemini", callGemini],
  ["grok", callGrok],
]) {
  try {
    const result = await fn();
    results[name] = result;
    await fs.writeFile(path.join(outputDir, `${name}_response.json`), JSON.stringify(result, null, 2));
  } catch (error) {
    failures[name] = String(error);
    await fs.writeFile(path.join(outputDir, `${name}_error.txt`), `${String(error)}\n`);
  }
}

const summary = {
  generatedAt: new Date().toISOString(),
  availableResults: Object.keys(results),
  failedResults: failures,
};

await fs.writeFile(path.join(outputDir, "summary.json"), JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
