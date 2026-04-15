import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = "/home/ubuntu/complilink_operativo_v1";
const outputDir = resolve(root, "tmp", "tri_ai_single_case_guardrail");
await mkdir(outputDir, { recursive: true });

async function safeRead(relativePath, maxChars = 18000) {
  try {
    const content = await readFile(resolve(root, relativePath), "utf8");
    return `### ${relativePath}\n${content.slice(0, maxChars)}`;
  } catch (error) {
    return `### ${relativePath}\nNo disponible: ${error instanceof Error ? error.message : String(error)}`;
  }
}

const productSummary = {
  product: "AuditaPatron",
  focus: "Cierre V1 con regla estricta de identidad por expediente",
  criticalRule: "Cada usuario normal debe quedar limitado a un solo expediente/persona. El perfil CEO debe conservar bypass completo para subir y probar múltiples expedientes sin restricción.",
  currentRisk: "Hoy un usuario con alcance tenant podría terminar viendo o usando varios casos dentro de su cuenta, o subir documentos que pertenezcan a otra persona dentro del mismo expediente.",
  constraints: [
    "Evitar cambios innecesarios de esquema si puede resolverse robustamente con reglas de acceso existentes.",
    "Priorizar enforcement backend por encima del frontend.",
    "No romper el flujo actual de /auditar ni el acceso operativo del CEO.",
    "Si un usuario normal intenta subir un documento que parece de otra persona, el sistema debe detenerse y notificarlo cordialmente sin lenguaje acusatorio.",
  ],
};

const files = await Promise.all([
  safeRead("drizzle/schema.ts", 18000),
  safeRead("server/db.ts", 26000),
  safeRead("server/routers.ts", 22000),
  safeRead("client/src/pages/Auditar.tsx", 12000),
  safeRead("todo.md", 8000),
]);

const prompt = `Actúa como arquitecto senior y release manager de una app legal-tech.

Contexto:
${JSON.stringify(productSummary, null, 2)}

Archivos relevantes:
${files.join("\n\n")}

Devuelve exclusivamente JSON válido con esta forma exacta:
{
  "recommended_enforcement_layer": "backend_only" | "backend_plus_ui_signal" | "needs_schema_change",
  "primary_strategy": {
    "summary": "string",
    "why_it_fits_v1": "string",
    "ceo_bypass_model": "string"
  },
  "implementation_points": [
    {
      "file": "string",
      "change": "string",
      "reason": "string"
    }
  ],
  "edge_cases": ["string"],
  "tests_required": ["string"],
  "main_risk_if_done_wrong": "string",
  "friendly_user_message": "string",
  "recommended_detection_moment": "draft_preview" | "draft_confirmation" | "final_upload" | "multiple_points",
  "final_recommendation": "string corta y accionable"
}

Reglas:
- Prioriza enforcement real sobre copy o señales visuales.
- Evita rediseños amplios.
- Si puedes resolverlo sin migración de base de datos y sin debilitar seguridad, prioriza esa opción.
- El usuario normal jamás debe poder operar varios expedientes/personas con una sola cuenta.
- El CEO sí debe poder hacerlo para pruebas.
- Propón el mensaje cordial exacto que debería ver el usuario cuando el documento parece pertenecer a otra persona.
- Indica el mejor momento del flujo para detectar y frenar ese intento con la menor fricción posible.`;

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

function summarize(name, data) {
  return {
    model: name,
    recommended_enforcement_layer: data?.recommended_enforcement_layer ?? "error",
    final_recommendation: data?.final_recommendation ?? "",
    implementation_points: Array.isArray(data?.implementation_points) ? data.implementation_points.length : 0,
    tests_required: Array.isArray(data?.tests_required) ? data.tests_required.length : 0,
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

const summaries = Object.entries(results).map(([name, data]) => summarize(name, data));
await writeFile(resolve(outputDir, "results.json"), JSON.stringify({ generatedAt: new Date().toISOString(), productSummary, results, summaries }, null, 2), "utf8");
console.log(JSON.stringify({ output: resolve(outputDir, "results.json"), summaries }, null, 2));
