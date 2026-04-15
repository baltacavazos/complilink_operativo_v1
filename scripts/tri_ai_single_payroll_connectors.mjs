import fs from "node:fs/promises";

const projectDir = "/home/ubuntu/complilink_operativo_v1";
const outputDir = `${projectDir}/tmp/tri_ai_single_payroll_connectors`;
await fs.mkdir(outputDir, { recursive: true });

const prompt = `Contexto del producto:
- App: CompliLink / AuditaPatron.
- Pantalla foco: /auditar.
- Pregunta de negocio: si el usuario solo tiene un recibo de nómina, Helios debería aprovechar la mayor cantidad posible de conectores y contexto para extraer información útil. Si detecta discrepancias, queremos saber si hoy eso realmente ya está ocurriendo.

Hallazgos reales del código actual:
1) Para un documento tipo payroll_receipt, Helios hoy recomienda: "Si puedes, sube el CFDI o el contrato del mismo periodo para comprobar si pagos, deducciones y prestaciones coinciden entre sí." También propone acciones como contrastar el recibo con el CFDI del mismo periodo y agregar contrato o evidencia si detectas diferencias repetidas.
2) El resumen de validación social solo calcula señales de IMSS e Infonavit con base en documentos ya presentes en el expediente. Cuenta documentos tipo IMSS y menciones a Infonavit dentro de nombre/opinión/payload del documento. Si no hay IMSS ni Infonavit, el sistema responde que el cruce está pendiente y recomienda subir soporte IMSS o constancia de Infonavit.
3) Al confirmar un documento, el backend construye una sharedEngineEnvelope, genera una heliosOpinion inicial y envía el documento al motor remoto. Pero en esta capa no se observa una orquestación explícita de "usar todos los conectores disponibles" para enriquecer automáticamente el caso cuando solo existe una nómina.
4) En el frontend sí existe lógica contextual para sugerir el siguiente documento: si ya hay nómina y no hay CFDI, se sugiere CFDI; si hay IMSS y no hay nómina, se sugiere nómina. También existe comparación lado a lado, pero requiere al menos dos documentos.

Tu tarea:
Actúa como auditor senior de producto e integración. Evalúa si con estos hallazgos el sistema actual ya cumple la expectativa de "usar todos los conectores" y de "detectar discrepancias útiles" cuando el usuario solo tiene una nómina. Distingue claramente entre lo que YA pasa y lo que SOLO es expectativa deseada.

Devuelve JSON válido con esta forma exacta:
{
  "model_summary": "string breve",
  "what_already_happens": ["string", "string", "string"],
  "what_is_missing": ["string", "string", "string"],
  "does_it_use_all_connectors_today": {
    "answer": true,
    "why": "string"
  },
  "does_it_detect_discrepancies_from_single_payroll_today": {
    "answer": true,
    "why": "string"
  },
  "best_user_explanation": "string en español, muy simple",
  "highest_priority_next_step": "string"
}

Responde solo con JSON, sin markdown.`;

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText}: ${text.slice(0, 500)}`);
  }
  return text;
}

async function callOpenAI() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY missing");
  const raw = await fetchJson("https://api.openai.com/v1/chat/completions", {
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
        { role: "system", content: "Eres un auditor senior de producto e integración. Devuelves únicamente JSON válido." },
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
  const raw = await fetchJson("https://api.x.ai/v1/chat/completions", {
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
        { role: "system", content: "Eres un auditor senior de producto e integración. Devuelves únicamente JSON válido." },
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
  const raw = await fetchJson(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
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
for (const [name, fn] of [["chatgpt", callOpenAI], ["grok", callGrok], ["gemini", callGemini]]) {
  try {
    const content = await fn();
    results[name] = { ok: true, content };
    await fs.writeFile(`${outputDir}/${name}.json`, content + "\n");
  } catch (error) {
    results[name] = { ok: false, error: error instanceof Error ? error.message : String(error) };
    await fs.writeFile(`${outputDir}/${name}.error.txt`, `${results[name].error}\n`);
  }
}

await fs.writeFile(`${outputDir}/summary.json`, JSON.stringify(results, null, 2) + "\n");
console.log(JSON.stringify(results, null, 2));
