import fs from "node:fs/promises";

const projectDir = "/home/ubuntu/complilink_operativo_v1";
const outputDir = `${projectDir}/tmp/tri_ai_max_enrichment_simple`;
await fs.mkdir(outputDir, { recursive: true });

const prompt = `Contexto del producto:
- App: AuditaPatron / CompliLink.
- Pantalla foco: /auditar.
- Motor foco: Helios.
- Regla de negocio crítica: Helios debe usar SIEMPRE todo lo que tenga a su alcance para extraer la mayor información útil posible para el usuario, incluso si solo subió un documento.
- Caso especialmente importante: el usuario solo sube un recibo de nómina.
- Restricción UX crítica: si falta algo para concluir mejor, debe explicarse con palabras tan simples que cualquier persona lo entienda.

Comportamiento actual resumido:
- Hoy Helios sí genera una lectura inicial del documento.
- Hoy sí sugiere qué documento conviene subir después.
- Hoy NO hay una orquestación claramente visible de "usar todas las señales y conectores posibles" antes de pedir más documentos.
- Hoy las discrepancias fuertes dependen mucho de tener otro documento para comparar.

Objetivo del cambio:
Diseña una estrategia de producto + backend + UX para que Helios:
1) agote primero toda la información disponible,
2) clasifique qué pudo confirmar, inferir o dejar pendiente,
3) detecte discrepancias aunque todavía haya un solo documento,
4) explique al usuario, en lenguaje muy simple, qué encontró, qué no pudo confirmar y qué documento o señal sería el siguiente más útil.

Piensa como principal product architect + legal-tech systems designer. No propongas una reescritura total. Prioriza cambios ejecutables dentro de un producto ya existente.

Devuelve JSON válido con esta forma exacta:
{
  "model_summary": "string breve",
  "non_negotiables": ["string", "string", "string"],
  "max_enrichment_strategy": {
    "before_asking_for_more": ["string", "string", "string"],
    "connectors_or_signals_to_exhaust_first": ["string", "string", "string"],
    "single_payroll_behavior": ["string", "string", "string"],
    "discrepancy_logic_without_second_document": ["string", "string", "string"]
  },
  "simple_explanation_contract": {
    "sections": ["string", "string", "string", "string"],
    "tone_rules": ["string", "string", "string"],
    "example_for_single_payroll": "string"
  },
  "minimum_backend_changes": ["string", "string", "string"],
  "minimum_frontend_changes": ["string", "string", "string"],
  "highest_risk_to_avoid": "string",
  "implementation_priority": ["string", "string", "string"]
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
