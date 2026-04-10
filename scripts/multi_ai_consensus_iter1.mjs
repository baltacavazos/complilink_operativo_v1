import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const outDir = resolve("/home/ubuntu/complilink_operativo_v1/.manus-ai");
mkdirSync(outDir, { recursive: true });

const prompt = [
  "Eres arquitecto senior de producto y backend.",
  "Contexto: app web tRPC+React+DB con un flujo legal ya versionado.",
  "Debemos mejorar 3 cosas:",
  "1) idempotencia persistente real para acceptLegalPackage y consentimientos, resistente a refresh, doble clic y concurrencia;",
  "2) lectura operativa mínima del embudo home→expediente→aceptación legal→subida documental, usando la analítica ya existente;",
  "3) validación bajo dominio final publicado.",
  "Responde SOLO JSON válido con estas claves exactas:",
  JSON.stringify({
    idempotencia_persistente: {
      estrategia: "",
      clave_idempotencia: "",
      persistencia: "",
      manejo_concurrencia: "",
    },
    lectura_embudo_operativo: {
      metrica_principal: "",
      eventos_minimos: [""],
      vista_minima: "",
    },
    validacion_dominio_final: {
      checks: [""],
      riesgos: [""],
    },
    pruebas_prioritarias: [""],
    recomendacion_final: "",
  }),
  "Sé específico y breve.",
].join(" ");

async function callOpenAI() {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4.1-mini",
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "Responde solo JSON válido y conciso." },
        { role: "user", content: prompt },
      ],
    }),
  });

  const text = await response.text();
  writeFileSync(resolve(outDir, "openai_iter1.json"), text);
}

async function callGrok() {
  const response = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.XAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "grok-4",
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "Responde solo JSON válido y conciso." },
        { role: "user", content: prompt },
      ],
    }),
  });

  const text = await response.text();
  writeFileSync(resolve(outDir, "grok_iter1.json"), text);
}

async function callGemini() {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(process.env.GEMINI_API_KEY ?? "")}`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      system_instruction: {
        parts: [{ text: "Responde solo JSON válido y conciso." }],
      },
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.2,
        responseMimeType: "application/json",
      },
    }),
  });

  const text = await response.text();
  writeFileSync(resolve(outDir, "gemini_iter1.json"), text);
}

await callOpenAI();
await callGrok();
await callGemini();
console.log("done");
