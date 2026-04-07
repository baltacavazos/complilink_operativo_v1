import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const projectRoot = "/home/ubuntu/complilink_operativo_v1";
const outputDir = path.join(projectRoot, "research", "helios_round3_priority");

const prompt = `
Eres un principal product designer + staff frontend engineer.

Contexto del producto:
- App: AuditaPatron.
- Ruta: /auditar.
- Helios es el cerebro central del expediente.
- El tono debe ser claro, humano, útil y sin sobreprometer.
- La experiencia debe ser mobile-first, minimalista, elegante y muy fácil de entender.
- Ya existe un bloque llamado “Helios: ¿Qué cambió aquí?” que compara automáticamente documentos del expediente.
- Ya existe una línea de tiempo del expediente y una tarjeta de siguiente documento recomendado.

Nueva ronda prioritaria a diseñar:
1. Permitir selección manual de dos documentos para comparar dentro del bloque de Helios.
2. Añadir microinteracciones suaves en comparación y línea de tiempo.
3. Convertir hallazgos repetidos o relevantes en alertas priorizadas, con contexto y momento visible.

Restricciones:
- No introducir complejidad innecesaria.
- No usar lenguaje jurídico pesado.
- No prometer conclusiones definitivas.
- Mantener a Helios como guía útil, no como reemplazo de revisión humana final.
- Debe incentivar a subir más documentos explicando que el expediente crece y Helios entiende mejor.
- Debe poder implementarse rápido en el frontend actual.

Quiero una respuesta estrictamente en JSON válido con esta estructura exacta:
{
  "summary": "string",
  "ui_priorities": ["string"],
  "manual_compare": {
    "interaction_model": "string",
    "default_behavior": "string",
    "mobile_pattern": "string",
    "fallback_when_few_docs": "string",
    "recommended_controls": ["string"]
  },
  "microinteractions": [
    {
      "target": "string",
      "effect": "string",
      "rationale": "string"
    }
  ],
  "prioritized_alerts": {
    "logic": "string",
    "cards": [
      {
        "title": "string",
        "when": "string",
        "body": "string",
        "priority": "high|medium|low",
        "timestamp_pattern": "string"
      }
    ]
  },
  "copy_examples": {
    "compare_cta": "string",
    "alert_heading": "string",
    "alert_body": "string",
    "empty_state": "string"
  },
  "implementation_order": ["string"],
  "risks_to_avoid": ["string"]
}

No incluyas markdown. No incluyas texto fuera del JSON.
`.trim();

function stripCodeFences(text) {
  return text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();
}

function safeJsonParse(text) {
  const cleaned = stripCodeFences(text);
  return JSON.parse(cleaned);
}

async function callOpenAI() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY no está disponible");
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4.1-mini",
      temperature: 0.4,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: "Responde solo con JSON válido. Eres un experto en UX producto y frontend para experiencias guiadas por IA.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
    }),
  });

  const json = await response.json();
  if (!response.ok) {
    throw new Error(JSON.stringify(json, null, 2));
  }

  const content = json.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("OpenAI no devolvió contenido");
  }

  return { raw: json, normalized: safeJsonParse(content) };
}

async function callGemini() {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY no está disponible");
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      generationConfig: {
        temperature: 0.4,
        responseMimeType: "application/json",
      },
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }],
        },
      ],
    }),
  });

  const json = await response.json();
  if (!response.ok) {
    throw new Error(JSON.stringify(json, null, 2));
  }

  const content = json.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("\n");
  if (!content) {
    throw new Error("Gemini no devolvió contenido");
  }

  return { raw: json, normalized: safeJsonParse(content) };
}

async function callGrok() {
  if (!process.env.XAI_API_KEY) {
    throw new Error("XAI_API_KEY no está disponible");
  }

  const response = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.XAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "grok-4",
      temperature: 0.4,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: "Responde exclusivamente con JSON válido. Eres un experto en UX producto, diseño mobile-first y frontend para sistemas guiados por IA.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
    }),
  });

  const json = await response.json();
  if (!response.ok) {
    throw new Error(JSON.stringify(json, null, 2));
  }

  const content = json.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("Grok no devolvió contenido");
  }

  return { raw: json, normalized: safeJsonParse(content) };
}

async function settle(name, task) {
  try {
    const result = await task();
    await writeFile(path.join(outputDir, `${name}.json`), JSON.stringify(result.normalized, null, 2));
    await writeFile(path.join(outputDir, `${name}_raw.json`), JSON.stringify(result.raw, null, 2));
    return { provider: name, ok: true };
  } catch (error) {
    const payload = {
      provider: name,
      error: error instanceof Error ? error.message : String(error),
    };
    await writeFile(path.join(outputDir, `${name}_error.json`), JSON.stringify(payload, null, 2));
    return { provider: name, ok: false, error: payload.error };
  }
}

async function main() {
  await mkdir(outputDir, { recursive: true });

  const summary = [];
  summary.push(await settle("openai", callOpenAI));
  summary.push(await settle("gemini", callGemini));
  summary.push(await settle("grok", callGrok));

  await writeFile(path.join(outputDir, "summary.json"), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
