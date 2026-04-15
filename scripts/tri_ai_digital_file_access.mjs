import fs from "node:fs/promises";

const projectDir = "/home/ubuntu/complilink_operativo_v1";
const outputDir = `${projectDir}/tmp/tri_ai_digital_file_access`;
await fs.mkdir(outputDir, { recursive: true });

const prompt = `Contexto del producto:
- App: AuditaPatron / CompliLink.
- Pantalla foco: /auditar.
- Regla UX clave: la experiencia debe ser entendible por cualquier persona, sin lenguaje técnico.
- Regla de producto clave: el usuario debe poder ver y entender su archivo digital con el menor esfuerzo posible.
- Regla de ecosistema: el sistema debe aprovechar toda la información disponible antes de pedir más documentos.

Estado actual resumido:
- Ya existe un resultado más claro después de subir documentos.
- Ya existe una capa “En simple”.
- Ya existe mejor separación entre discrepancias y pendientes.
- Ya existe mejor visibilidad del siguiente paso sugerido.

Nueva mejora solicitada:
Diseñar una experiencia para que el usuario tenga acceso claro a su archivo digital y lo entienda fácilmente.

Qué se busca exactamente:
1) Que el usuario entienda qué documentos tiene cargados y qué información ya se obtuvo de ellos.
2) Que el usuario vea qué falta, por qué falta y para qué sirve subirlo.
3) Que la interfaz sea sumamente intuitiva, fácil de entender y sin fricción.
4) Que no se sienta como un expediente técnico, sino como una guía clara de su caso.

Restricciones:
- No proponer una reescritura total.
- Priorizar cambios pequeños pero de alto impacto sobre la base actual.
- No usar lenguaje técnico en el texto visible al usuario.
- No mencionar proveedores ni detalles internos del sistema.
- La propuesta debe funcionar bien en móvil.

Devuelve JSON válido con esta forma exacta:
{
  "model_summary": "string breve",
  "shared_strategy": ["string", "string", "string"],
  "digital_file_experience": {
    "plain_name": "string",
    "one_sentence_promise": "string",
    "primary_sections": ["string", "string", "string", "string"],
    "must_show_first": ["string", "string", "string"],
    "must_hide_or_reduce": ["string", "string", "string"]
  },
  "user_understanding": {
    "what_user_should_understand_in_5_seconds": ["string", "string", "string"],
    "copy_rules": ["string", "string", "string"],
    "example_empty_state": "string",
    "example_missing_doc_explanation": "string"
  },
  "document_clarity": {
    "document_groups": ["string", "string", "string"],
    "status_labels": ["string", "string", "string", "string"],
    "next_step_patterns": ["string", "string", "string"]
  },
  "mobile_design": {
    "layout_rules": ["string", "string", "string"],
    "interaction_rules": ["string", "string", "string"],
    "avoid": ["string", "string", "string"]
  },
  "minimum_backend_changes": ["string", "string", "string"],
  "minimum_frontend_changes": ["string", "string", "string"],
  "events_to_measure": ["string", "string", "string"],
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
