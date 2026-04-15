import fs from "node:fs/promises";

const projectDir = "/home/ubuntu/complilink_operativo_v1";
const outputDir = `${projectDir}/tmp/tri_ai_round_all_next_steps`;
await fs.mkdir(outputDir, { recursive: true });

const prompt = `Contexto del producto:
- App: AuditaPatron / CompliLink.
- Pantalla foco: /auditar.
- Motor foco: Helios.
- Regla UX clave: el resultado debe ser entendible por cualquier persona, sin lenguaje técnico.
- Regla de producto clave: Helios debe usar toda la información disponible antes de pedir más archivos.

Estado actual resumido:
- Ya existe una capa “En simple” que explica mejor qué encontró Helios.
- Ya existe una separación más clara de qué se revisó y qué falta.
- Ya existe mejor visibilidad de señales sociales y del siguiente documento sugerido.

Nueva ronda solicitada:
Implementar TODO de una vez para que:
1) el tono del resumen cambie según gravedad y urgencia,
2) las posibles discrepancias queden separadas visual y conceptualmente de la información pendiente,
3) se mida qué explicación simple funciona mejor en móvil para mejorar confirmación y siguiente paso.

Restricciones:
- No proponer una reescritura total.
- Priorizar cambios pequeños pero potentes sobre la base actual.
- La explicación debe sentirse clara, humana y accionable.
- Evitar lenguaje técnico en el texto visible al usuario.

Devuelve JSON válido con esta forma exacta:
{
  "model_summary": "string breve",
  "shared_strategy": ["string", "string", "string"],
  "severity_tone": {
    "levels": ["leve", "importante", "urgente"],
    "rules": ["string", "string", "string"],
    "example_copy": {
      "leve": "string",
      "importante": "string",
      "urgente": "string"
    }
  },
  "discrepancy_vs_pending": {
    "must_show_as_separate_blocks": true,
    "discrepancy_definition": "string",
    "pending_definition": "string",
    "ui_rules": ["string", "string", "string"],
    "example_labels": ["string", "string", "string"]
  },
  "mobile_copy_measurement": {
    "variants_to_test": ["string", "string"],
    "events_to_track": ["string", "string", "string"],
    "success_metrics": ["string", "string", "string"],
    "lowest_risk_implementation": ["string", "string", "string"]
  },
  "minimum_backend_changes": ["string", "string", "string"],
  "minimum_frontend_changes": ["string", "string", "string"],
  "tests_to_add": ["string", "string", "string"],
  "highest_risk_to_avoid": "string",
  "implementation_order": ["string", "string", "string"]
}

Responde solo con JSON válido, sin markdown.`;

async function fetchText(url, options) {
  const response = await fetch(url, options);
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText}: ${text.slice(0, 800)}`);
  }
  return text;
}

async function callOpenAI() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY missing");
  const raw = await fetchText("https://api.openai.com/v1/chat/completions", {
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
          content: "Eres un arquitecto principal de producto legal-tech. Devuelves únicamente JSON válido.",
        },
        { role: "user", content: prompt },
      ],
    }),
  });
  const parsed = JSON.parse(raw);
  return parsed.choices?.[0]?.message?.content ?? "";
}

async function callGrok() {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) throw new Error("XAI_API_KEY missing");
  const raw = await fetchText("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "grok-3-mini",
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: "Eres un arquitecto principal de producto legal-tech. Devuelves únicamente JSON válido.",
        },
        { role: "user", content: prompt },
      ],
    }),
  });
  const parsed = JSON.parse(raw);
  return parsed.choices?.[0]?.message?.content ?? "";
}

async function callGemini() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY missing");
  const raw = await fetchText(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [{ text: `${prompt}\n\nRecuerda: devuelve solo JSON válido.` }],
        },
      ],
      generationConfig: {
        temperature: 0.2,
        responseMimeType: "application/json",
      },
    }),
  });
  const parsed = JSON.parse(raw);
  return parsed.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}

const results = {};
for (const [name, fn] of [
  ["chatgpt", callOpenAI],
  ["grok", callGrok],
  ["gemini", callGemini],
]) {
  try {
    const content = await fn();
    results[name] = { ok: true, content };
    await fs.writeFile(`${outputDir}/${name}.json`, content + "\n");
  } catch (error) {
    results[name] = {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
    await fs.writeFile(`${outputDir}/${name}.error.txt`, `${results[name].error}\n`);
  }
}

await fs.writeFile(`${outputDir}/summary.json`, JSON.stringify(results, null, 2) + "\n");
console.log(JSON.stringify(results, null, 2));
