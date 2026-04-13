import fs from "node:fs";
import path from "node:path";

const projectRoot = "/home/ubuntu/complilink_operativo_v1";
const outDir = path.join(projectRoot, ".manus-artifacts");
fs.mkdirSync(outDir, { recursive: true });

const candidates = [
  ["Home", path.join(projectRoot, "client/src/pages/Home.tsx")],
  ["Auditar", path.join(projectRoot, "client/src/pages/Auditar.tsx")],
  ["Acceso", path.join(projectRoot, "client/src/pages/Acceso.tsx")],
  ["CEODashboard", path.join(projectRoot, "client/src/pages/CEODashboard.tsx")],
  ["ceoDashboard", path.join(projectRoot, "client/src/pages/ceoDashboard.tsx")],
  ["CEOBridgeMonitoring", path.join(projectRoot, "client/src/pages/CEOBridgeMonitoring.tsx")],
];

function squeeze(text, max = 2200) {
  return text.replace(/\s+/g, " ").trim().slice(0, max);
}

const snapshots = candidates
  .filter(([, file]) => fs.existsSync(file))
  .map(([name, file]) => ({
    name,
    file,
    excerpt: squeeze(fs.readFileSync(file, "utf8")),
  }));

const prompt = [
  "Eres auditor senior de UX móvil para AuditaPatron.",
  "Objetivo: elegir UN solo microajuste no fundamental, de alto impacto y bajo riesgo, para la siguiente ronda.",
  "Restricciones: no cambiar arquitectura, no añadir funciones nuevas, no tocar backend, no introducir pasos adicionales.",
  "Prioriza: menos scroll móvil, acción principal más dominante, lenguaje más claro, más confianza sin más chrome.",
  "Responde SOLO JSON con esta forma estricta:",
  '{"winner_surface":"Home|Auditar|Acceso|Consola CEO|Otro","score":0,"change_summary":"...","why":"...","exact_target":"...","risk":"low|medium","copy_suggestion":"..."}',
  "Contexto resumido del checkpoint actual:",
  ...snapshots.map((item) => `### ${item.name}\n${item.excerpt}`),
].join("\n\n");

async function callOpenAI() {
  if (!process.env.OPENAI_API_KEY) return { model: "chatgpt", available: false, error: "OPENAI_API_KEY missing" };
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
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
        { role: "system", content: "Responde únicamente JSON válido." },
        { role: "user", content: prompt },
      ],
    }),
  });
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content ?? "{}";
  return { model: "chatgpt", available: true, raw: data, parsed: JSON.parse(content) };
}

async function callGrok() {
  if (!process.env.XAI_API_KEY) return { model: "grok", available: false, error: "XAI_API_KEY missing" };
  const res = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.XAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "grok-4-fast-reasoning",
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "Responde únicamente JSON válido." },
        { role: "user", content: prompt },
      ],
    }),
  });
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content ?? "{}";
  return { model: "grok", available: true, raw: data, parsed: JSON.parse(content) };
}

async function callGemini() {
  if (!process.env.GEMINI_API_KEY) return { model: "gemini", available: false, error: "GEMINI_API_KEY missing" };
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;
  const schema = {
    type: "OBJECT",
    properties: {
      winner_surface: { type: "STRING" },
      score: { type: "NUMBER" },
      change_summary: { type: "STRING" },
      why: { type: "STRING" },
      exact_target: { type: "STRING" },
      risk: { type: "STRING" },
      copy_suggestion: { type: "STRING" },
    },
    required: ["winner_surface", "score", "change_summary", "why", "exact_target", "risk", "copy_suggestion"],
  };
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      generationConfig: {
        temperature: 0.2,
        responseMimeType: "application/json",
        responseSchema: schema,
      },
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    }),
  });
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
  return { model: "gemini", available: true, raw: data, parsed: JSON.parse(text) };
}

function synthesize(results) {
  const valid = results.filter((r) => r.available && r.parsed && !r.error);
  const counts = new Map();
  for (const item of valid) {
    const key = `${item.parsed.winner_surface}|||${item.parsed.change_summary}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const winner = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  const [winner_surface, change_summary] = winner
    ? winner.split("|||")
    : [valid[0]?.parsed?.winner_surface ?? "Sin consenso", valid[0]?.parsed?.change_summary ?? "Sin síntesis"];
  return {
    generated_at: new Date().toISOString(),
    round: 9,
    snapshot_count: snapshots.length,
    results,
    consensus: {
      winner_surface,
      change_summary,
      agreement_count: winner ? counts.get(winner) : 0,
      recommended_exact_target:
        valid.find((v) => v.parsed?.winner_surface === winner_surface)?.parsed?.exact_target ?? "",
      recommended_copy_suggestion:
        valid.find((v) => v.parsed?.winner_surface === winner_surface)?.parsed?.copy_suggestion ?? "",
    },
  };
}

const results = [];
for (const fn of [callOpenAI, callGrok, callGemini]) {
  try {
    results.push(await fn());
  } catch (error) {
    results.push({ model: fn.name, available: true, error: String(error) });
  }
}

const report = synthesize(results);
fs.writeFileSync(path.join(outDir, "ronda9_multiview_audit.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
