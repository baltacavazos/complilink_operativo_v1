import fs from "node:fs/promises";
import path from "node:path";

const PROJECT_ROOT = "/home/ubuntu/complilink_operativo_v1";
const OUTPUT_PATH = path.resolve(PROJECT_ROOT, "artifacts/tri_ai_appfirst_macro_consensus.json");

const SOURCE_PATHS = {
  home: path.resolve(PROJECT_ROOT, "client/src/pages/Home.tsx"),
  access: path.resolve(PROJECT_ROOT, "client/src/pages/Access.tsx"),
  auditar: path.resolve(PROJECT_ROOT, "client/src/pages/Auditar.tsx"),
  pricing: path.resolve(PROJECT_ROOT, "client/src/lib/pricingExperience.ts"),
};

const SYSTEM_PROMPT = [
  "Eres un principal product designer, mobile UX strategist y UX writer senior.",
  "Tu especialidad es convertir experiencias web complejas en flujos muy simples, confiables y listos para evolucionar a app iOS/Android.",
  "Responde SOLO JSON válido, sin markdown.",
].join(" ");

function buildUserPrompt(sources) {
  return `
Contexto:
- Producto: AUDITAPATRON.
- Mercado: México.
- Usuario objetivo: personas no técnicas que suben documentos laborales y necesitan entender rápido si hay una señal útil, qué está confirmado, qué sigue y cómo volver después.
- Prioridad nueva: dejar de optimizar microcopys uno por uno y decidir SOLO cambios macro de mayor impacto.
- Objetivo: hacer la experiencia lo más fácil e intuitiva posible y dejarla encaminada a una futura app.
- Restricciones: sin tecnicismos, sin promesas exageradas, sin rediseños imposibles. Todo debe poder implementarse ya en la web actual y servir como base para Android/iOS.

Quiero que analices Home, /acceso, /auditar y pricingExperience, y me des una sola priorización de alto impacto.

Devuelve SOLO un JSON con esta forma exacta:
{
  "north_star": "string",
  "top_5_changes": [
    {
      "priority": 1,
      "name": "string",
      "surface": "home|access|auditar|cross_app",
      "problem": "string",
      "change": "string",
      "why_it_matters": "string",
      "implementation_scope": "low|medium|high",
      "app_readiness_value": "string"
    }
  ],
  "remove_or_reduce": [
    {
      "surface": "home|access|auditar|cross_app",
      "current_pattern": "string",
      "reason": "string"
    }
  ],
  "mobile_first_structure": {
    "home": ["string"],
    "access": ["string"],
    "auditar": ["string"]
  },
  "app_ready_foundations": [
    {
      "name": "string",
      "why_now": "string"
    }
  ],
  "fast_wins_this_week": ["string"],
  "do_not_spend_time_on": ["string"],
  "confidence": "high|medium|low"
}

Reglas estrictas:
- Prioriza cambios estructurales, no microajustes cosméticos.
- Si ves demasiada explicación secundaria, dilo y propón consolidación.
- Debes favorecer navegación de una mano, foco en acción primaria, continuidad clara y estados fáciles de entender.
- En Home debes pensar en activación.
- En /acceso debes pensar en continuidad sin ansiedad.
- En /auditar debes pensar en resultado primero, siguiente paso obvio y base reusable para app.
- Máximo 5 elementos en top_5_changes.
- Máximo 5 elementos en remove_or_reduce.
- Máximo 5 elementos en app_ready_foundations.
- Máximo 6 elementos en fast_wins_this_week.
- Máximo 6 elementos en do_not_spend_time_on.

SOURCES_START
[HOME]\n${sources.home}\n[/HOME]
[ACCESS]\n${sources.access}\n[/ACCESS]
[AUDITAR]\n${sources.auditar}\n[/AUDITAR]
[PRICING]\n${sources.pricing}\n[/PRICING]
SOURCES_END
  `.trim();
}

function extractJson(text) {
  if (!text) throw new Error("Respuesta vacía");
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {}
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) {
    return JSON.parse(trimmed.slice(start, end + 1));
  }
  throw new Error("No se pudo parsear JSON");
}

async function callOpenAI(userPrompt) {
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY no disponible");
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4.1-mini",
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
    }),
  });
  if (!response.ok) {
    throw new Error(`OpenAI ${response.status}: ${await response.text()}`);
  }
  const json = await response.json();
  return {
    provider: "chatgpt",
    model: json.model || "gpt-4.1-mini",
    data: extractJson(json.choices?.[0]?.message?.content || ""),
  };
}

async function callGemini(userPrompt) {
  if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY no disponible");
  const model = "gemini-2.5-flash";
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ role: "user", parts: [{ text: userPrompt }] }],
      generationConfig: {
        temperature: 0.2,
        responseMimeType: "application/json",
      },
    }),
  });
  if (!response.ok) {
    throw new Error(`Gemini ${response.status}: ${await response.text()}`);
  }
  const json = await response.json();
  const text = json.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("\n") || "";
  return {
    provider: "gemini",
    model,
    data: extractJson(text),
  };
}

async function callXAI(userPrompt) {
  if (!process.env.XAI_API_KEY) throw new Error("XAI_API_KEY no disponible");
  const response = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.XAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "grok-4",
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
    }),
  });
  if (!response.ok) {
    throw new Error(`xAI ${response.status}: ${await response.text()}`);
  }
  const json = await response.json();
  return {
    provider: "grok",
    model: json.model || "grok-4",
    data: extractJson(json.choices?.[0]?.message?.content || ""),
  };
}

function countByName(items) {
  const map = new Map();
  for (const item of items) {
    const key = item?.name?.trim()?.toLowerCase();
    if (!key) continue;
    const current = map.get(key) || { count: 0, samples: [] };
    current.count += 1;
    current.samples.push(item);
    map.set(key, current);
  }
  return [...map.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .map(([key, value]) => ({ key, count: value.count, samples: value.samples }));
}

function buildConsensus(results) {
  const valid = results.filter((item) => item.ok);
  const allChanges = valid.flatMap((item) => item.data.top_5_changes || []);
  const ranked = countByName(allChanges).slice(0, 5).map((entry, index) => {
    const base = entry.samples[0];
    return {
      priority: index + 1,
      name: base.name,
      support: entry.count,
      surface: base.surface,
      problem: base.problem,
      change: base.change,
      why_it_matters: base.why_it_matters,
      implementation_scope: base.implementation_scope,
      app_readiness_value: base.app_readiness_value,
    };
  });

  return {
    provider_count: valid.length,
    ranked_consensus_changes: ranked,
    representative_views: valid.map((item) => ({
      provider: item.provider,
      model: item.model,
      north_star: item.data.north_star,
      top_5_changes: item.data.top_5_changes || [],
      fast_wins_this_week: item.data.fast_wins_this_week || [],
      do_not_spend_time_on: item.data.do_not_spend_time_on || [],
      confidence: item.data.confidence,
    })),
  };
}

async function main() {
  const sources = {
    home: await fs.readFile(SOURCE_PATHS.home, "utf8"),
    access: await fs.readFile(SOURCE_PATHS.access, "utf8"),
    auditar: await fs.readFile(SOURCE_PATHS.auditar, "utf8"),
    pricing: await fs.readFile(SOURCE_PATHS.pricing, "utf8"),
  };

  const userPrompt = buildUserPrompt(sources);
  const providers = [
    { provider: "chatgpt", run: () => callOpenAI(userPrompt) },
    { provider: "gemini", run: () => callGemini(userPrompt) },
    { provider: "grok", run: () => callXAI(userPrompt) },
  ];

  const results = [];
  for (const provider of providers) {
    try {
      const result = await provider.run();
      results.push({ ...result, ok: true });
    } catch (error) {
      results.push({
        provider: provider.provider,
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const output = {
    generated_at: new Date().toISOString(),
    source_paths: SOURCE_PATHS,
    providers: results,
    consensus: buildConsensus(results),
  };

  await fs.mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await fs.writeFile(OUTPUT_PATH, `${JSON.stringify(output, null, 2)}\n`, "utf8");
  console.log(`Resultado guardado en ${OUTPUT_PATH}`);
}

main().catch(async (error) => {
  const output = {
    generated_at: new Date().toISOString(),
    error: error instanceof Error ? error.message : String(error),
  };
  await fs.mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await fs.writeFile(OUTPUT_PATH, `${JSON.stringify(output, null, 2)}\n`, "utf8");
  console.error(error);
  process.exit(1);
});
