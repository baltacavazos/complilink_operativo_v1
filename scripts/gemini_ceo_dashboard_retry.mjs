import fs from "node:fs/promises";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const outputPath = "/home/ubuntu/complilink_operativo_v1/.manus-ai/gemini_ceo_dashboard_retry.json";

const systemPrompt = `Eres un chief product officer y principal security architect. Debes diseñar un dashboard de CEO muy simple, potente y seguro para administrar una plataforma SaaS sensible sin depender del proveedor de desarrollo. Responde SOLO JSON válido, sin texto extra.`;

const userPrompt = `
Contexto:
- Producto: AuditaPatron.
- Ya existen casos, documentos, consentimientos, políticas de visibilidad, auditoría con trace_id y hash chain, RBAC inicial por tenant/caso y dashboard operativo básico.
- Nueva meta: crear un dashboard para el CEO que permita administrar AuditaPatron fuera de Manus.
- Usuario objetivo: CEO no programador.
- Restricción: interfaz minimalista, autoexplicativa, con foco en operación real y no en jerga técnica.

Devuelve SOLO JSON con esta forma exacta:
{
  "north_star": "...",
  "must_have_modules": [{"name": "...", "why": "...", "priority": 1}],
  "ceo_kpis": ["..."],
  "admin_actions": ["..."],
  "security_controls": ["..."],
  "what_not_to_build_yet": ["..."],
  "recommended_information_hierarchy": ["..."],
  "first_iteration_scope": ["..."],
  "main_risks": ["..."],
  "one_sentence_direction": "..."
}`.trim();

const models = ["gemini-2.0-flash", "gemini-1.5-flash", "gemini-2.5-flash"];

async function callModel(model) {
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      generationConfig: { temperature: 0.3, responseMimeType: "application/json" },
      contents: [{ role: "user", parts: [{ text: userPrompt }] }],
    }),
  });
  const data = await response.json();
  return { status: response.status, ok: response.ok, data };
}

async function main() {
  await fs.mkdir("/home/ubuntu/complilink_operativo_v1/.manus-ai", { recursive: true });
  if (!GEMINI_API_KEY) {
    await fs.writeFile(outputPath, JSON.stringify({ ok: false, error: "GEMINI_API_KEY missing" }, null, 2));
    return;
  }

  const attempts = [];
  for (const model of models) {
    try {
      const result = await callModel(model);
      attempts.push({ model, status: result.status, ok: result.ok, data: result.data });
      if (result.ok) {
        const text = result.data.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("") ?? "{}";
        await fs.writeFile(outputPath, JSON.stringify({ ok: true, model, parsed: JSON.parse(text), attempts }, null, 2));
        console.log(JSON.stringify({ ok: true, model, outputPath }, null, 2));
        return;
      }
    } catch (error) {
      attempts.push({ model, ok: false, error: error instanceof Error ? error.message : String(error) });
    }
  }

  await fs.writeFile(outputPath, JSON.stringify({ ok: false, attempts }, null, 2));
  console.log(JSON.stringify({ ok: false, outputPath }, null, 2));
}

main().catch(async (error) => {
  await fs.mkdir("/home/ubuntu/complilink_operativo_v1/.manus-ai", { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify({ ok: false, fatal: error instanceof Error ? { message: error.message, stack: error.stack } : String(error) }, null, 2));
  console.error(error);
  process.exit(1);
});
