import fs from "node:fs/promises";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const XAI_API_KEY = process.env.XAI_API_KEY;
const outputPath = "/home/ubuntu/complilink_operativo_v1/.manus-ai/ceo_dashboard_consensus.json";

const systemPrompt = `Eres un chief product officer y principal security architect. Debes diseñar un dashboard de CEO muy simple, potente y seguro para administrar una plataforma SaaS sensible sin depender del proveedor de desarrollo. Responde SOLO JSON válido, sin texto extra.`;

const userPrompt = `
Contexto:
- Producto: AuditaPatron.
- Estado actual: ya existen casos, documentos, consentimientos, políticas de visibilidad, auditoría con trace_id y hash chain, RBAC inicial por tenant/caso, y dashboard operativo básico.
- Nueva meta: crear un dashboard para el CEO que permita administrar AuditaPatron fuera de Manus.
- Usuario objetivo: CEO no programador.
- Restricción: interfaz minimalista, autoexplicativa, con foco en operación real y no en jerga técnica.
- Prioridad: reutilizar lo existente, reducir complejidad y dejar una base segura y extensible.

Tarea:
Propón el primer bloque mínimo y correcto de este dashboard ejecutivo.

Devuelve SOLO JSON con esta forma exacta:
{
  "north_star": "...",
  "must_have_modules": [
    {"name": "...", "why": "...", "priority": 1}
  ],
  "ceo_kpis": ["..."],
  "admin_actions": ["..."],
  "security_controls": ["..."],
  "what_not_to_build_yet": ["..."],
  "recommended_information_hierarchy": ["..."],
  "first_iteration_scope": ["..."],
  "main_risks": ["..."],
  "one_sentence_direction": "..."
}`.trim();

async function callOpenAI() {
  if (!OPENAI_API_KEY) return { provider: "chatgpt", ok: false, error: "OPENAI_API_KEY missing" };
  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        temperature: 0.3,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });
    const data = await response.json();
    if (!response.ok) return { provider: "chatgpt", ok: false, error: JSON.stringify(data) };
    return { provider: "chatgpt", ok: true, parsed: JSON.parse(data.choices?.[0]?.message?.content ?? "{}") };
  } catch (error) {
    return { provider: "chatgpt", ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

async function callGemini() {
  if (!GEMINI_API_KEY) return { provider: "gemini", ok: false, error: "GEMINI_API_KEY missing" };
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        generationConfig: { temperature: 0.3, responseMimeType: "application/json" },
        contents: [{ role: "user", parts: [{ text: userPrompt }] }],
      }),
    });
    const data = await response.json();
    if (!response.ok) return { provider: "gemini", ok: false, error: JSON.stringify(data) };
    const text = data.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("") ?? "{}";
    return { provider: "gemini", ok: true, parsed: JSON.parse(text) };
  } catch (error) {
    return { provider: "gemini", ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

async function callGrok() {
  if (!XAI_API_KEY) return { provider: "grok", ok: false, error: "XAI_API_KEY missing" };
  try {
    const response = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${XAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "grok-4-0709",
        temperature: 0.3,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });
    const data = await response.json();
    if (!response.ok) return { provider: "grok", ok: false, error: JSON.stringify(data) };
    return { provider: "grok", ok: true, parsed: JSON.parse(data.choices?.[0]?.message?.content ?? "{}") };
  } catch (error) {
    return { provider: "grok", ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

async function main() {
  await fs.mkdir("/home/ubuntu/complilink_operativo_v1/.manus-ai", { recursive: true });
  const providers = await Promise.all([callOpenAI(), callGemini(), callGrok()]);
  const result = {
    generatedAt: new Date().toISOString(),
    promptVersion: "ceo-dashboard-v1-compact",
    providers: Object.fromEntries(providers.map((entry) => [entry.provider, entry])),
  };
  await fs.writeFile(outputPath, JSON.stringify(result, null, 2));
  console.log(JSON.stringify({ ok: true, outputPath }, null, 2));
}

main().catch(async (error) => {
  await fs.mkdir("/home/ubuntu/complilink_operativo_v1/.manus-ai", { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify({ ok: false, error: error instanceof Error ? { message: error.message, stack: error.stack } : String(error) }, null, 2));
  console.error(error);
  process.exit(1);
});
