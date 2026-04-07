import fs from "node:fs/promises";
import path from "node:path";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const XAI_API_KEY = process.env.XAI_API_KEY;

const OUTPUT_PATH = "/home/ubuntu/complilink_operativo_v1/tri_ai_integracion_bidireccional_output.json";

const systemPrompt = `Eres un arquitecto principal de producto y backend especializado en plataformas laborales, integraciones webhook, análisis documental con IA y diseño de experiencias mágicas pero auditables. Debes responder con criterio ejecutivo y técnico a la vez. Siempre devuelve JSON válido, sin markdown, sin texto adicional fuera del JSON.`;

const userPrompt = `Contexto del proyecto:
- Existen dos plataformas conectadas pero separadas: AuditaPatron (cara al trabajador, centrada en protección, expediente creciente y carga documental) y CompliLink MX / CompliLink Operativo (backend operativo que procesa y analiza documentos laborales).
- La decisión estratégica aprobada es mantener ambas plataformas distinguibles pero integradas de forma bidireccional, con mínima intervención humana.
- Se quiere una experiencia de usuario de nivel cutting-edge, muy fluida y casi “mágica”, pero con trazabilidad, idempotencia, explicabilidad y guardrails legales.

Estado técnico confirmado:
- Stack principal: Next.js/React + TypeScript en un template web con backend server-side.
- Integración AuditaPatron -> CompliLink MX: webhook server-to-server.
- El contrato confirmado exige event name: document.uploaded.
- La firma debe usar HMAC-SHA256 sobre timestamp.body.
- Debe existir retry para respuestas 5xx con backoff 30s, 60s y 120s.
- Requisitos clave ya definidos: SHA256 deduplication, idempotency, payload estructurado, resultados explicables.

Alcance funcional ampliado:
- Ya no solo se aceptarán unos pocos tipos documentales. Ahora debe aceptarse CUALQUIER documento laboral relevante: contrato individual, recibos, CFDI, documentos IMSS/INFONAVIT, finiquitos, cartas, correos, chats, capturas, mensajes, constancias, opiniones de cumplimiento, etc.
- El sistema debe clasificar automáticamente el documento, extraer campos útiles, identificar señales importantes, y si el documento es contrato individual de trabajo, debe hacer análisis profundo de cláusulas y una estimación preliminar de prestaciones con guardrails claros entre dato confirmado y dato estimado.
- El pitch interno debe explicar en lenguaje no técnico por qué esta dupla AuditaPatron + CompliLink crea una base para futuros productos laborales todavía no imaginados.

Tu tarea:
Analiza la mejor forma de aterrizar esto EN LA SIGUIENTE ITERACIÓN de producto. No inventes un rediseño total imposible; enfócate en una versión fuerte pero realista para implementar ahora.

Devuelve exclusivamente un JSON con esta estructura exacta:
{
  "executive_summary": "string de 120 a 220 palabras",
  "recommended_outbound_contract": {
    "keep_event_name": "string",
    "signature_recipe": "string",
    "required_headers": ["string"],
    "payload_shape": ["string"],
    "retry_policy": ["string"],
    "idempotency_strategy": ["string"]
  },
  "recommended_return_webhooks": [
    {
      "event_name": "string",
      "when_to_emit": "string",
      "minimum_payload_fields": ["string"],
      "why_it_matters": "string"
    }
  ],
  "document_intelligence_architecture": {
    "classification_layers": ["string"],
    "must_extract_fields": ["string"],
    "how_to_handle_unknown_documents": "string",
    "explainability_requirements": ["string"],
    "dedup_and_traceability": ["string"]
  },
  "contract_analysis_module": {
    "must_detect": ["string"],
    "benefit_estimation_scope": ["string"],
    "guardrails": ["string"],
    "output_sections": ["string"]
  },
  "magical_ux_recommendations": ["string"],
  "implementation_order_next_sprint": ["string"],
  "key_risks": ["string"],
  "open_questions": ["string"],
  "verdict": {
    "approach_is_sound": true,
    "confidence_0_to_100": 0,
    "one_sentence_reason": "string"
  }
}`;

async function fetchJson(url, options, label) {
  const response = await fetch(url, options);
  const text = await response.text();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`${label} devolvió una respuesta no JSON: ${text.slice(0, 500)}`);
  }
  if (!response.ok) {
    throw new Error(`${label} devolvió HTTP ${response.status}: ${text.slice(0, 800)}`);
  }
  return parsed;
}

function parseModelJson(label, rawText) {
  const cleaned = String(rawText ?? "").trim();
  try {
    return { ok: true, data: JSON.parse(cleaned), raw: cleaned };
  } catch (error) {
    return {
      ok: false,
      error: `${label} no devolvió JSON parseable: ${error instanceof Error ? error.message : String(error)}`,
      raw: cleaned,
    };
  }
}

async function callOpenAI() {
  if (!OPENAI_API_KEY) {
    return { provider: "chatgpt", ok: false, error: "OPENAI_API_KEY no disponible" };
  }

  const data = await fetchJson(
    "https://api.openai.com/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4.1",
        temperature: 0.2,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
      }),
    },
    "ChatGPT",
  );

  const content = data?.choices?.[0]?.message?.content ?? "";
  return {
    provider: "chatgpt",
    model: data?.model ?? "gpt-4.1",
    ...parseModelJson("ChatGPT", content),
  };
}

async function callGrok() {
  if (!XAI_API_KEY) {
    return { provider: "grok", ok: false, error: "XAI_API_KEY no disponible" };
  }

  const data = await fetchJson(
    "https://api.x.ai/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${XAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "grok-4",
        temperature: 0.2,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
      }),
    },
    "Grok",
  );

  const content = data?.choices?.[0]?.message?.content ?? "";
  return {
    provider: "grok",
    model: data?.model ?? "grok-4",
    ...parseModelJson("Grok", content),
  };
}

async function callGemini() {
  if (!GEMINI_API_KEY) {
    return { provider: "gemini", ok: false, error: "GEMINI_API_KEY no disponible" };
  }

  const data = await fetchJson(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: systemPrompt }],
        },
        contents: [
          {
            role: "user",
            parts: [{ text: userPrompt }],
          },
        ],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: "application/json",
        },
      }),
    },
    "Gemini",
  );

  const content = data?.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("\n") ?? "";
  return {
    provider: "gemini",
    model: "gemini-2.5-flash",
    ...parseModelJson("Gemini", content),
  };
}

async function main() {
  const startedAt = new Date().toISOString();
  const results = await Promise.allSettled([callOpenAI(), callGrok(), callGemini()]);

  const normalized = results.map((result) => {
    if (result.status === "fulfilled") return result.value;
    return {
      provider: "unknown",
      ok: false,
      error: result.reason instanceof Error ? result.reason.message : String(result.reason),
    };
  });

  const payload = {
    task: "tri_ai_review_integracion_bidireccional_y_analisis_documental",
    startedAt,
    completedAt: new Date().toISOString(),
    promptVersion: "v1",
    results: normalized,
  };

  await fs.writeFile(OUTPUT_PATH, JSON.stringify(payload, null, 2) + "\n", "utf8");
  console.log(JSON.stringify({ output: OUTPUT_PATH, providers: normalized.map((item) => item.provider) }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
