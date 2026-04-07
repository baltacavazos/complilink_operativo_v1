import fs from "node:fs/promises";
import path from "node:path";

const projectRoot = "/home/ubuntu/complilink_operativo_v1";
const screenshotPath = "/home/ubuntu/screenshots/webdev-preview-1775537898.png";
const outputPath = path.join(projectRoot, "tri_ai_hero_phrase_consensus_output.json");

function extractJson(text) {
  if (!text) return null;
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {}
  const match = trimmed.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

function tallyPick(results) {
  const counts = new Map();
  for (const result of results) {
    const id = result?.parsed?.recommended_candidate_id;
    if (!id) continue;
    counts.set(id, (counts.get(id) || 0) + 1);
  }
  return Object.fromEntries([...counts.entries()].sort((a, b) => b[1] - a[1]));
}

async function callOpenAI(promptText, imageDataUrl) {
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
            "Eres un director de marca y producto extremadamente exigente. Debes elegir el mejor hero headline posible para una app laboral dirigida a trabajadores. Priorizas claridad, fuerza emocional, confianza, memorabilidad, simplicidad y lectura móvil. Responde solo JSON válido.",
        },
        {
          role: "user",
          content: [
            { type: "text", text: promptText },
            { type: "image_url", image_url: { url: imageDataUrl } },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI ${response.status}: ${await response.text()}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content ?? "";
}

async function callGrok(promptText, imageDataUrl) {
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
            "Eres un estratega de branding y UX muy exigente. Debes escoger el mejor hero headline posible para una app laboral para trabajadores. Prioriza claridad, impacto humano, confianza, simplicidad, memorabilidad y lectura en móvil. Responde solo JSON válido.",
        },
        {
          role: "user",
          content: [
            { type: "text", text: promptText },
            { type: "image_url", image_url: { url: imageDataUrl } },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`Grok ${response.status}: ${await response.text()}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content ?? "";
}

async function callGemini(promptText, imageBase64, mimeType) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY no está disponible");

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      generationConfig: {
        temperature: 0.4,
        responseMimeType: "application/json",
      },
      contents: [
        {
          role: "user",
          parts: [
            { text: promptText },
            {
              inline_data: {
                mime_type: mimeType,
                data: imageBase64,
              },
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`Gemini ${response.status}: ${await response.text()}`);
  }

  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("\n") ?? "";
}

async function main() {
  const [homeSource, auditSource, screenshotBuffer] = await Promise.all([
    fs.readFile(path.join(projectRoot, "client/src/pages/Home.tsx"), "utf8").catch(() => ""),
    fs.readFile(path.join(projectRoot, "client/src/pages/Auditar.tsx"), "utf8").catch(() => ""),
    fs.readFile(screenshotPath),
  ]);

  const imageBase64 = screenshotBuffer.toString("base64");
  const imageDataUrl = `data:image/png;base64,${imageBase64}`;

  const promptText = `
Producto: Auditapatron.
Público principal: trabajadores no expertos en México.
Objetivo de la primera impresión: transmitir claridad, protección, respaldo y acción inmediata sin sonar técnico, exagerado ni legalista.
Nueva prioridad estratégica: considerar que en México el lenguaje de defensa de derechos laborales genera empatía, cercanía y sentido de protección. Evalúa explícitamente si conviene incluir la idea de derechos en el headline principal.
Restricciones clave: debe leerse muy bien en móvil, idealmente en 2 o 3 líneas, ser fácil de recordar, sonar humano y dar confianza real.

Contexto actual del hero y experiencia:
- Ya existe una interfaz clara y amable, pero queremos una última ronda de pulido.
- El usuario considera el headline principal como la pieza más importante de la primera impresión.
- Queremos un consenso fuerte sobre la mejor frase de entrada posible.

Home.tsx (extracto relevante):
${homeSource.slice(0, 12000)}

Auditar.tsx (extracto relevante):
${auditSource.slice(0, 6000)}

Evalúa la captura actual y el contexto del código. Luego propón 5 candidatos de headline principal en español. Cada headline debe ser corto, fuerte y muy claro. Al menos 3 candidatos deben incorporar explícitamente la idea de derechos laborales o defensa de derechos, pero sin sonar panfletario ni legalista. También propone un subtítulo corto que lo acompañe.

Responde SOLO JSON válido con esta estructura exacta:
{
  "current_headline_assessment": {
    "score": 0,
    "what_works": "",
    "what_fails": ""
  },
  "candidates": [
    {
      "id": "a",
      "headline": "",
      "subheadline": "",
      "score_clarity": 0,
      "score_trust": 0,
      "score_memorability": 0,
      "score_mobile": 0,
      "why": ""
    }
  ],
  "recommended_candidate_id": "a",
  "recommended_why": "",
  "rights_language_assessment": {
    "should_include_rights": true,
    "why": ""
  },
  "microcopy_adjustments": {
    "header_primary_cta": "",
    "header_secondary_cta": "",
    "hero_supporting_badge": ""
  },
  "final_advice": ""
}

Reglas:
- score debe ser entero de 1 a 10.
- Deben venir exactamente 5 candidatos con ids a, b, c, d, e.
- No uses tecnicismos, claims imposibles ni lenguaje legal complicado.
- Evita frases genéricas estilo consultoría. Debe sonar a producto humano y útil para trabajadores.
- El headline debe ser la mejor primera impresión posible.
`.trim();

  const models = [
    { name: "chatgpt", fn: () => callOpenAI(promptText, imageDataUrl) },
    { name: "grok", fn: () => callGrok(promptText, imageDataUrl) },
    { name: "gemini", fn: () => callGemini(promptText, imageBase64, "image/png") },
  ];

  const results = [];
  for (const model of models) {
    try {
      const raw = await model.fn();
      const parsed = extractJson(raw);
      if (!parsed) {
        results.push({ model: model.name, error: "No se pudo parsear JSON", raw });
      } else {
        results.push({ model: model.name, raw, parsed });
      }
    } catch (error) {
      results.push({ model: model.name, error: error instanceof Error ? error.message : String(error) });
    }
  }

  const output = {
    generated_at: new Date().toISOString(),
    screenshot_path: screenshotPath,
    results,
    recommended_candidate_vote_count: tallyPick(results),
  };

  await fs.writeFile(outputPath, JSON.stringify(output, null, 2));
  console.log(`Resultado guardado en ${outputPath}`);
}

main().catch(async (error) => {
  const fallback = {
    generated_at: new Date().toISOString(),
    fatal_error: error instanceof Error ? error.message : String(error),
  };
  await fs.writeFile(outputPath, JSON.stringify(fallback, null, 2));
  console.error(error);
  process.exit(1);
});
