import { readFile, writeFile } from "node:fs/promises";

const prompt = await readFile(new URL("../artifacts/imss_sat_tri_ia_prompt.md", import.meta.url), "utf8");
const system = "Eres un analista de producto y cumplimiento para servicios laborales mexicanos. Responde solo en español, separa hechos de recomendaciones y no inventes acceso a portales o APIs oficiales.";

async function save(name, response) {
  await writeFile(new URL(`../artifacts/imss_sat_${name}_evaluation.json`, import.meta.url), JSON.stringify(response, null, 2));
}

async function callOpenAI() {
  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify({ model: "gpt-4.1-mini", temperature: 0.15, messages: [{ role: "system", content: system }, { role: "user", content: prompt }] }),
    });
    await save("chatgpt", { ok: response.ok, status: response.status, body: await response.json() });
  } catch (error) {
    await save("chatgpt", { ok: false, error: error instanceof Error ? error.message : String(error) });
  }
}

async function callGemini() {
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ systemInstruction: { parts: [{ text: system }] }, contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig: { temperature: 0.15 } }),
    });
    await save("gemini", { ok: response.ok, status: response.status, body: await response.json() });
  } catch (error) {
    await save("gemini", { ok: false, error: error instanceof Error ? error.message : String(error) });
  }
}

async function callGrok() {
  if (!process.env.XAI_API_KEY) {
    await save("grok", { ok: false, status: 0, error: "XAI_API_KEY no disponible en esta sesión; no se realizó ninguna consulta." });
    return;
  }
  try {
    const response = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.XAI_API_KEY}` },
      body: JSON.stringify({ model: "grok-4", temperature: 0.15, messages: [{ role: "system", content: system }, { role: "user", content: prompt }] }),
    });
    await save("grok", { ok: response.ok, status: response.status, body: await response.json() });
  } catch (error) {
    await save("grok", { ok: false, error: error instanceof Error ? error.message : String(error) });
  }
}

await Promise.all([callOpenAI(), callGemini(), callGrok()]);
console.log("Consultas guardadas en artifacts/imss_sat_*_evaluation.json");
