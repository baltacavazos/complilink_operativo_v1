import fs from "node:fs/promises";

const OUTPUT_PATH = new URL("./tmp_multiview_ui_iter4.json", import.meta.url);

const systemPrompt = [
  "Eres una persona experta en UX/UI para productos de consumo masivo en México.",
  "Debes proponer mejoras cálidas, claras y sobrias para una landing de derechos laborales.",
  "No cambies la arquitectura del producto ni inventes nuevas funcionalidades.",
  "Responde únicamente JSON válido, sin markdown ni comentarios.",
].join(" ");

const userPrompt = `Contexto actual del producto: AuditaPatron es una web para personas trabajadoras. La home ya usa un tono cálido y claro, con header oscuro, hero de fondo menta muy claro, CTA principal \"Abrir mi expediente\", y una tarjeta derecha con progreso, checklist y siguiente paso sugerido. Ya existen fondos suaves por sección y divisores sutiles.

Objetivo de esta iteración: aplicar tres mejoras al mismo tiempo, sin tocar backend ni lógica:
1) Dar un poco más de contraste y jerarquía visual a la tarjeta derecha del hero, sin volverla pesada.
2) Añadir microanimaciones suaves en botones y cards, con sensación confiable y sobria, no juguetona.
3) Reforzar la jerarquía visual del menú superior en móvil para que navegación y acción principal se distingan mejor.

Necesito recomendaciones ejecutables, concretas y moderadas. Evita rediseños drásticos. Piensa para una persona de 10 años o una adulta mayor con baja alfabetización digital.

Devuelve JSON con esta forma exacta:
{
  "hero_card": {
    "summary": "string",
    "changes": ["string", "string", "string"],
    "colors": ["string", "string", "string"]
  },
  "microanimations": {
    "summary": "string",
    "changes": ["string", "string", "string"],
    "timings": ["string", "string", "string"]
  },
  "mobile_nav": {
    "summary": "string",
    "changes": ["string", "string", "string"]
  },
  "cta": {
    "label": "string",
    "reason": "string"
  },
  "guardrails": ["string", "string", "string"]
}`;

function safeJsonParse(text) {
  if (!text) return null;
  const cleaned = text
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();
  return JSON.parse(cleaned);
}

async function callOpenAICompatible({ name, url, apiKey, model }) {
  if (!apiKey) {
    return { provider: name, ok: false, error: "API key no disponible" };
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.5,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
    }),
  });

  const raw = await response.text();
  if (!response.ok) {
    return { provider: name, ok: false, status: response.status, error: raw };
  }

  const parsed = JSON.parse(raw);
  const content = parsed?.choices?.[0]?.message?.content ?? "";
  return {
    provider: name,
    ok: true,
    model,
    raw: parsed,
    parsed: safeJsonParse(content),
  };
}

async function callGemini() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { provider: "gemini", ok: false, error: "API key no disponible" };
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }],
        },
      ],
      generationConfig: {
        temperature: 0.5,
        responseMimeType: "application/json",
      },
    }),
  });

  const raw = await response.text();
  if (!response.ok) {
    return { provider: "gemini", ok: false, status: response.status, error: raw };
  }

  const parsed = JSON.parse(raw);
  const content = parsed?.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("\n") ?? "";
  return {
    provider: "gemini",
    ok: true,
    model: "gemini-2.5-flash",
    raw: parsed,
    parsed: safeJsonParse(content),
  };
}

async function main() {
  const [openaiResult, grokResult, geminiResult] = await Promise.allSettled([
    callOpenAICompatible({
      name: "openai",
      url: "https://api.openai.com/v1/chat/completions",
      apiKey: process.env.OPENAI_API_KEY,
      model: "gpt-4o-mini",
    }),
    callOpenAICompatible({
      name: "grok",
      url: "https://api.x.ai/v1/chat/completions",
      apiKey: process.env.XAI_API_KEY,
      model: "grok-4",
    }),
    callGemini(),
  ]);

  const normalize = (result) => {
    if (result.status === "fulfilled") return result.value;
    return { ok: false, error: String(result.reason) };
  };

  const payload = {
    generated_at: new Date().toISOString(),
    prompt_summary: {
      goal: "Mejorar contraste del hero, microanimaciones suaves y jerarquía móvil del menú superior sin cambiar la lógica.",
      current_cta: "Abrir mi expediente",
    },
    providers: {
      openai: normalize(openaiResult),
      grok: normalize(grokResult),
      gemini: normalize(geminiResult),
    },
  };

  await fs.writeFile(OUTPUT_PATH, JSON.stringify(payload, null, 2));
  console.log(`Comparación guardada en ${OUTPUT_PATH.pathname}`);
}

main().catch(async (error) => {
  const failure = {
    generated_at: new Date().toISOString(),
    fatal: true,
    error: String(error?.stack || error),
  };
  await fs.writeFile(OUTPUT_PATH, JSON.stringify(failure, null, 2));
  console.error(error);
  process.exit(1);
});
