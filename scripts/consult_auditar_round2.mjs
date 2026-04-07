import fs from "node:fs/promises";
import path from "node:path";

const projectRoot = "/home/ubuntu/complilink_operativo_v1";
const outputDir = path.join(projectRoot, "research", "auditar_round2_multi_ai");
await fs.mkdir(outputDir, { recursive: true });

const auditarSource = await fs.readFile(path.join(projectRoot, "client/src/pages/Auditar.tsx"), "utf8");
const testSource = await fs.readFile(path.join(projectRoot, "server/auditapatron.homepage.test.ts"), "utf8");

const prompt = `
Contexto del producto:
- Producto: AuditaPatron.
- Público: trabajadores no técnicos en México.
- Helios debe sentirse como el cerebro central del expediente.
- El tono debe ser claro, protector, útil y nada técnico.
- La integración visible sigue siendo preliminar; no debemos sobreprometer.
- Ya existe en /auditar: carga documental, estado de Helios, siguiente documento recomendado y línea de tiempo simple del expediente.

Nuevas mejoras aprobadas:
1. Hacer la línea de tiempo más compacta y expandible/colapsable en móvil para reducir scroll.
2. Humanizar el bloque de seguimiento automático con mensajes distintos según estado, demora y avance.
3. Personalizar la recomendación del siguiente documento usando señales y hallazgos ya visibles del expediente.

Tu tarea:
Revisa el código actual y recomienda la mejor implementación de bajo riesgo y alto impacto para estas tres mejoras. Piensa como diseñador senior de producto mobile-first para legal-tech laboral. Prioriza claridad, sencillez y consistencia con Helios como guía central.

Responde SOLO en JSON válido con esta estructura exacta:
{
  "verdict": "approve_direction" | "adjust_direction" | "change_direction",
  "timeline_mobile": {
    "recommended_pattern": "string",
    "why": "string",
    "copy": ["string"],
    "interaction_notes": ["string"]
  },
  "tracking_messages": {
    "recommended_pattern": "string",
    "states": [
      {
        "state_key": "string",
        "title": "string",
        "body": "string"
      }
    ],
    "why": "string"
  },
  "next_document_personalization": {
    "recommended_pattern": "string",
    "explanation_formula": "string",
    "copy": ["string"],
    "why": "string"
  },
  "low_risk_changes": ["string"],
  "copy_risks": ["string"],
  "test_targets": ["string"],
  "recommended_next_step": "string"
}

Código relevante de Auditar.tsx:
<source_auditar>
${auditarSource}
</source_auditar>

Prueba relevante:
<source_test>
${testSource}
</source_test>
`;

async function callOpenAI() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY no está disponible");
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4.1-mini",
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "Eres un diseñador senior de producto y UX writing para legal-tech laboral en español. Das recomendaciones concretas, simples y de bajo riesgo. Evitas tecnicismos y sobrepromesas.",
        },
        { role: "user", content: prompt },
      ],
    }),
  });
  if (!response.ok) throw new Error(`OpenAI error ${response.status}: ${await response.text()}`);
  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("OpenAI no devolvió contenido");
  return JSON.parse(content);
}

async function callGemini() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY no está disponible");
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: {
        parts: [
          {
            text: "Eres un diseñador senior de producto y UX writing para legal-tech laboral en español. Das recomendaciones concretas, simples y de bajo riesgo. Evitas tecnicismos y sobrepromesas.",
          },
        ],
      },
      generationConfig: {
        temperature: 0.2,
        responseMimeType: "application/json",
      },
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    }),
  });
  if (!response.ok) throw new Error(`Gemini error ${response.status}: ${await response.text()}`);
  const data = await response.json();
  const content = data.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("");
  if (!content) throw new Error("Gemini no devolvió contenido");
  return JSON.parse(content);
}

async function callGrok() {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) throw new Error("XAI_API_KEY no está disponible");
  const response = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "grok-4",
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "Eres un diseñador senior de producto y UX writing para legal-tech laboral en español. Das recomendaciones concretas, simples y de bajo riesgo. Evitas tecnicismos y sobrepromesas.",
        },
        { role: "user", content: prompt },
      ],
    }),
  });
  if (!response.ok) throw new Error(`Grok error ${response.status}: ${await response.text()}`);
  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("Grok no devolvió contenido");
  return JSON.parse(content);
}

const results = {};
const failures = {};
for (const [name, fn] of [["openai", callOpenAI], ["gemini", callGemini], ["grok", callGrok]]) {
  try {
    const result = await fn();
    results[name] = result;
    await fs.writeFile(path.join(outputDir, `${name}.json`), JSON.stringify(result, null, 2));
  } catch (error) {
    failures[name] = String(error);
    await fs.writeFile(path.join(outputDir, `${name}_error.txt`), `${String(error)}\n`);
  }
}

const summary = {
  generatedAt: new Date().toISOString(),
  availableResults: Object.keys(results),
  failedResults: failures,
};

await fs.writeFile(path.join(outputDir, "summary.json"), JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
