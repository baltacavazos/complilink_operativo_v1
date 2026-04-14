import fs from "node:fs/promises";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const XAI_API_KEY = process.env.XAI_API_KEY;

if (!OPENAI_API_KEY || !GEMINI_API_KEY || !XAI_API_KEY) {
  throw new Error("Missing one or more API keys in environment");
}

const context = `
Proyecto: complilink_operativo_v1
Objetivo inmediato: hacer una micro-ronda adicional del landing de AuditaPatron sin cambiar la estructura.

Situación actual:
1. Ya se corrigió un copy interno filtrado en el bloque final del landing.
2. El usuario pidió seguir con los siguientes pasos: recortar microcopy secundario y blindar la home para que no vuelvan a aparecer frases internas.
3. No quiero rediseñar la home; solo quiero hacerla más directa y ligera.
4. Quiero tocar máximo dos bloques secundarios de copy.
5. El hero principal ya comunica: "Sube un documento laboral y recibe una auditoría clara."

Bloques candidatos detectados:
A) pricingExperience.landing.description
Texto actual:
"Empieza con tu primer documento y entiende mejor tu situación laboral en minutos. Si más adelante necesitas más respaldo, las opciones adicionales aparecen dentro de tu expediente, cuando realmente te sirvan."

B) párrafo final del bloque CTA en Home.tsx
Texto actual:
"Si más adelante necesitas avanzar con mayor respaldo, esa opción aparece dentro de tu expediente, con contexto y sin interrumpir tu primera revisión."

C) pricingExperience.platform.description cuando todavía no hay suficiente contexto
Texto actual:
"Primero sigue fortaleciendo tu expediente gratis. Cuando quieras avanzar con más respaldo, podrás activar una preparación guiada basada en los documentos que ya reuniste."

Necesito una respuesta muy concreta y comparable en JSON exacto con este formato:
{
  "top_two_blocks_to_shorten": ["A o B o C", "A o B o C"],
  "recommended_rewrites": {
    "A": "...",
    "B": "...",
    "C": "..."
  },
  "guardrail_phrases_to_block": ["..."],
  "rationale": ["..."]
}
`;

async function callOpenAI() {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4.1-mini",
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "Eres un estratega senior de UX writing para productos consumer. Responde solo JSON válido." },
        { role: "user", content: context },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI error ${response.status}: ${await response.text()}`);
  }

  const data = await response.json();
  return JSON.parse(data.choices?.[0]?.message?.content ?? "{}");
}

async function callGemini() {
  const models = ["gemini-2.5-flash", "gemini-2.0-flash"];
  const errors = [];

  for (const model of models) {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: `Eres un estratega senior de UX writing para productos consumer. Responde solo JSON válido. ${context}` }],
          },
        ],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: "application/json",
        },
      }),
    });

    if (!response.ok) {
      errors.push(`${model}: ${response.status} ${await response.text()}`);
      continue;
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("") ?? "{}";
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === "object") {
      parsed.model = model;
    }
    return parsed;
  }

  throw new Error(`Gemini fallback exhausted: ${errors.join(" | ")}`);
}

async function callGrok() {
  const response = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${XAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "grok-3-mini",
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "Eres un estratega senior de UX writing para productos consumer. Responde solo JSON válido." },
        { role: "user", content: context },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`Grok error ${response.status}: ${await response.text()}`);
  }

  const data = await response.json();
  return JSON.parse(data.choices?.[0]?.message?.content ?? "{}");
}

const settled = await Promise.allSettled([callOpenAI(), callGemini(), callGrok()]);

const result = {
  generatedAt: new Date().toISOString(),
  promptSummary: "Micro-ronda tri-IA para recortar dos microcopies secundarios del landing de AuditaPatron y blindar frases internas",
  openai: settled[0].status === "fulfilled" ? settled[0].value : { error: String(settled[0].reason) },
  gemini: settled[1].status === "fulfilled" ? settled[1].value : { error: String(settled[1].reason) },
  grok: settled[2].status === "fulfilled" ? settled[2].value : { error: String(settled[2].reason) },
};

await fs.writeFile("/home/ubuntu/complilink_operativo_v1/tmp_multi_ai_landing_microcopy_round2_results.json", JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
