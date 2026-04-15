import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";

const root = "/home/ubuntu/complilink_operativo_v1";
const outputDir = resolve(root, "tmp", "tri_ai_v1_closure_audit");
await mkdir(outputDir, { recursive: true });

async function safeRead(relativePath, maxChars = 18000) {
  try {
    const content = await readFile(resolve(root, relativePath), "utf8");
    return `### ${relativePath}\n${content.slice(0, maxChars)}`;
  } catch (error) {
    return `### ${relativePath}\nNo disponible: ${error instanceof Error ? error.message : String(error)}`;
  }
}

const projectSummary = {
  product: "AuditaPatron",
  goal: "Cerrar versión 1 priorizando solo robustez, funcionalidad crítica y preparación final para salida.",
  currentFocus: [
    "Flujo principal: subir documento → analizar → ver resultado → acceder al archivo digital.",
    "Claridad de copy y CTA para usuarios nuevos.",
    "Robustez operativa y validación técnica.",
    "Separar explícitamente imprescindibles de post-V1.",
  ],
  alreadyDoneHighlights: [
    "Home y /auditar ya fueron simplificados en varias rondas.",
    "El archivo digital ya tiene acceso visible, CTA por tarjeta, filtros simples y retorno móvil.",
    "Hay suites Vitest activas y compilación TypeScript en verde en las últimas validaciones.",
  ],
  instruction: "No propongas wishlist amplia. Piensa como release manager de V1: mínimo sólido, funcional y publicable.",
};

const files = await Promise.all([
  safeRead("client/src/App.tsx", 12000),
  safeRead("client/src/pages/Home.tsx", 14000),
  safeRead("client/src/pages/Auditar.tsx", 22000),
  safeRead("client/src/pages/Acceso.tsx", 14000),
  safeRead("server/routers.ts", 22000),
  safeRead("client/src/pages/Auditar.alerts.test.ts", 12000),
  safeRead("todo.md", 12000),
]);

const prompt = `Actúa como un auditor senior de cierre de producto para una app legal-tech de cara a liberar la V1.

Contexto resumido:
${JSON.stringify(projectSummary, null, 2)}

Archivos y contexto actual:
${files.join("\n\n")}

Devuelve exclusivamente JSON válido con esta forma exacta:
{
  "release_readiness": "ready_if_checklist_completed" | "close_but_needs_key_fixes" | "not_ready",
  "must_have_before_v1": [
    {
      "area": "string",
      "issue": "string",
      "why_it_blocks_v1": "string",
      "recommended_action": "string",
      "severity": "high" | "medium"
    }
  ],
  "post_v1": [
    {
      "area": "string",
      "item": "string",
      "why_it_can_wait": "string"
    }
  ],
  "top_3_release_checks": ["string", "string", "string"],
  "biggest_hidden_risk": "string",
  "recommended_next_move": "string",
  "strict_v1_scope": "string breve y concreto"
}

Reglas:
- Prioriza robustez funcional sobre estética.
- No pidas rediseños amplios.
- Si algo ya parece suficientemente resuelto, no lo vuelvas a abrir.
- Sé estricto: solo marca como must-have lo que realmente impediría cerrar V1.`;

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${text.slice(0, 1000)}`);
  }
  return text;
}

async function callOpenAI() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY no disponible");
  const raw = await fetchJson("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4.1-mini",
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "Devuelve solo JSON válido." },
        { role: "user", content: prompt },
      ],
    }),
  });
  const parsed = JSON.parse(raw);
  return JSON.parse(parsed.choices?.[0]?.message?.content ?? "{}");
}

async function callGrok() {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) throw new Error("XAI_API_KEY no disponible");
  const raw = await fetchJson("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "grok-3-mini",
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "Devuelve solo JSON válido." },
        { role: "user", content: prompt },
      ],
    }),
  });
  const parsed = JSON.parse(raw);
  return JSON.parse(parsed.choices?.[0]?.message?.content ?? "{}");
}

async function callGemini() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY no disponible");
  const raw = await fetchJson(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: `${prompt}\n\nRecuerda: devuelve solo JSON válido.` }] }],
      generationConfig: {
        temperature: 0.1,
        responseMimeType: "application/json",
      },
    }),
  });
  const parsed = JSON.parse(raw);
  const text = parsed.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("") ?? "{}";
  return JSON.parse(text);
}

function summarizeModel(name, data) {
  return {
    model: name,
    release_readiness: data?.release_readiness ?? "error",
    must_have_count: Array.isArray(data?.must_have_before_v1) ? data.must_have_before_v1.length : 0,
    top_3_release_checks: data?.top_3_release_checks ?? [],
    recommended_next_move: data?.recommended_next_move ?? "",
    strict_v1_scope: data?.strict_v1_scope ?? "",
  };
}

const results = {};
for (const [name, fn] of [["chatgpt", callOpenAI], ["grok", callGrok], ["gemini", callGemini]]) {
  try {
    results[name] = await fn();
  } catch (error) {
    results[name] = { error: error instanceof Error ? error.message : String(error) };
  }
}

const summaries = Object.entries(results).map(([name, data]) => summarizeModel(name, data));

await writeFile(
  resolve(outputDir, "results.json"),
  JSON.stringify({ generatedAt: new Date().toISOString(), projectSummary, results, summaries }, null, 2),
  "utf8",
);

console.log(JSON.stringify({ output: resolve(outputDir, "results.json"), summaries }, null, 2));
