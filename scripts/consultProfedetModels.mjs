import { readFile, writeFile } from "node:fs/promises";

const prompt = await readFile(new URL("../artifacts/profedet_tri_ia_prompt.md", import.meta.url), "utf8");
const system = "Responde en español con análisis preciso, prudente y accionable. No inventes requisitos oficiales ni sustituyas fuentes públicas.";

async function save(name, response) {
  await writeFile(new URL(`../artifacts/profedet_${name}_evaluation.json`, import.meta.url), JSON.stringify(response, null, 2));
}

async function callOpenAI() {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({ model: "gpt-4.1-mini", temperature: 0.2, messages: [{ role: "system", content: system }, { role: "user", content: prompt }] }),
  });
  const body = await response.json();
  await save("chatgpt", { ok: response.ok, status: response.status, body });
}

async function callGemini() {
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ systemInstruction: { parts: [{ text: system }] }, contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig: { temperature: 0.2 } }),
  });
  const body = await response.json();
  await save("gemini", { ok: response.ok, status: response.status, body });
}

async function callGrok() {
  const response = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.XAI_API_KEY}` },
    body: JSON.stringify({ model: "grok-4", temperature: 0.2, messages: [{ role: "system", content: system }, { role: "user", content: prompt }] }),
  });
  const body = await response.json();
  await save("grok", { ok: response.ok, status: response.status, body });
}

await Promise.all([callOpenAI(), callGemini(), callGrok()]);
console.log("Consultas guardadas en artifacts/profedet_*_evaluation.json");
