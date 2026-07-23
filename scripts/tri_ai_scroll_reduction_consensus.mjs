import fs from "node:fs/promises";
import path from "node:path";

const PROJECT_ROOT = "/home/ubuntu/complilink_operativo_v1";
const OUTPUT_PATH = path.resolve(PROJECT_ROOT, "artifacts/tri_ai_scroll_reduction_consensus.json");

const SOURCE_PATHS = {
  home: path.resolve(PROJECT_ROOT, "client/src/pages/Home.tsx"),
  access: path.resolve(PROJECT_ROOT, "client/src/pages/Access.tsx"),
  auditar: path.resolve(PROJECT_ROOT, "client/src/pages/Auditar.tsx"),
  pricing: path.resolve(PROJECT_ROOT, "client/src/lib/pricingExperience.ts"),
};

const SYSTEM_PROMPT = [
  "Eres un principal product designer, mobile UX strategist y CRO lead.",
  "Tu especialidad es recortar altura, reducir scrolling y condensar experiencias móviles sin perder claridad, confianza ni conversión.",
  "Responde SOLO JSON válido, sin markdown.",
].join(" ");

function buildUserPrompt(sources) {
  return `
Contexto:
- Producto: AUDITAPATRON.
- Mercado: México.
- Usuario objetivo: personas no técnicas que quieren revisar documentos laborales desde el celular.
- Problema actual: todavía hay demasiada altura visual, demasiados bloques y demasiado scrolling, sobre todo en Home y /auditar.
- Objetivo de esta ronda: decidir SOLO qué recortes estructurales harían la experiencia más corta, más directa y más parecida a app.
- Restricción crítica: no sacrificar claridad, confianza, privacidad visible ni conversión hacia subir el primer documento.
- También puedes mencionar /acceso si ves oportunidades, pero la prioridad principal es Home y /auditar.

Quiero que analices Home, /acceso, /auditar y pricingExperience, y devuelvas SOLO una priorización de recorte estructural.

Devuelve SOLO un JSON con esta forma exacta:
{
  "north_star": "string",
  "home_scroll_reduction": {
    "current_problem": "string",
    "blocks_to_remove": ["string"],
    "blocks_to_merge": ["string"],
    "blocks_to_keep_above_fold": ["string"],
    "recommended_order": ["string"]
  },
  "auditar_scroll_reduction": {
    "current_problem": "string",
    "blocks_to_remove": ["string"],
    "blocks_to_merge": ["string"],
    "blocks_to_keep_first": ["string"],
    "recommended_order": ["string"]
  },
  "access_scroll_reduction": {
    "current_problem": "string",
    "blocks_to_reduce": ["string"]
  },
  "top_7_actions": [
    {
      "priority": 1,
      "surface": "home|auditar|access|cross_app",
      "action": "string",
      "expected_scroll_savings": "low|medium|high",
      "risk": "low|medium|high",
      "why": "string"
    }
  ],
  "do_not_cut": ["string"],
  "quick_win_sequence": ["string"],
  "confidence": "high|medium|low"
}

Reglas estrictas:
- Prioriza recortar bloques enteros o fusionar secciones, no solo editar copy.
- Señala si Home tiene demasiada información antes del primer scroll importante.
- Señala si /auditar tiene demasiados paneles o explicaciones visibles antes de la acción principal.
- Favorece una experiencia de una mano, parecida a app, con jerarquía más corta y clara.
- Máximo 4 elementos por cada lista de remove/merge/keep.
- Máximo 7 elementos en top_7_actions.
- Máximo 6 elementos en quick_win_sequence.
- Si detectas duplicación de señales, dilo explícitamente.

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
  if (!response.ok) throw new Error(`OpenAI ${response.status}: ${await response.text()}`);
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
  if (!response.ok) throw new Error(`Gemini ${response.status}: ${await response.text()}`);
  const json = await response.json();
  const text = json.candidates?.[0]?.content?.parts?.map(part => part.text || "").join("\n") || "";
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
  if (!response.ok) throw new Error(`xAI ${response.status}: ${await response.text()}`);
  const json = await response.json();
  return {
    provider: "grok",
    model: json.model || "grok-4",
    data: extractJson(json.choices?.[0]?.message?.content || ""),
  };
}

function rankActions(results) {
  const map = new Map();
  for (const result of results.filter(item => item.ok)) {
    for (const action of result.data.top_7_actions || []) {
      const key = `${action.surface}::${String(action.action || "").trim().toLowerCase()}`;
      if (!action.action) continue;
      const current = map.get(key) || { count: 0, sample: action };
      current.count += 1;
      map.set(key, current);
    }
  }
  return [...map.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 7)
    .map((entry, index) => ({ priority: index + 1, support: entry.count, ...entry.sample }));
}

function buildConsensus(results) {
  const valid = results.filter(item => item.ok);
  const first = valid[0]?.data || null;
  return {
    provider_count: valid.length,
    ranked_actions: rankActions(results),
    representative_views: valid.map(item => ({
      provider: item.provider,
      model: item.model,
      north_star: item.data.north_star,
      home_scroll_reduction: item.data.home_scroll_reduction,
      auditar_scroll_reduction: item.data.auditar_scroll_reduction,
      access_scroll_reduction: item.data.access_scroll_reduction,
      top_7_actions: item.data.top_7_actions || [],
      quick_win_sequence: item.data.quick_win_sequence || [],
      confidence: item.data.confidence,
    })),
    merged_summary: first
      ? {
          home_scroll_reduction: first.home_scroll_reduction,
          auditar_scroll_reduction: first.auditar_scroll_reduction,
          access_scroll_reduction: first.access_scroll_reduction,
          do_not_cut: first.do_not_cut || [],
          quick_win_sequence: first.quick_win_sequence || [],
        }
      : null,
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

main().catch(async error => {
  const output = {
    generated_at: new Date().toISOString(),
    error: error instanceof Error ? error.message : String(error),
  };
  await fs.mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await fs.writeFile(OUTPUT_PATH, `${JSON.stringify(output, null, 2)}\n`, "utf8");
  console.error(error);
  process.exit(1);
});
