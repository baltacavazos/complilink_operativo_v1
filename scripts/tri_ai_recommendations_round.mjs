import fs from "fs/promises";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const XAI_API_KEY = process.env.XAI_API_KEY;

const prompt = `
Eres un consultor senior de producto, UX y arquitectura para una plataforma web mexicana llamada AuditaPatron.

Contexto no negociable:
- La marca pública visible es AuditaPatron.
- El motor interno es Helios y NO debe aparecer en la UI pública.
- Toda la experiencia debe seguir una arquitectura Helios-first: el documento se carga, Helios lo analiza y almacena, y luego emite los resultados.
- El tono debe ser claro, prudente, entendible y útil para trabajadores no expertos.
- IMSS e Infonavit deben seguir siendo visibles porque son parte central de la propuesta de valor.
- La experiencia debe sentirse muy simple en móvil.

Estado actual ya implementado en /auditar:
- Ya existe historial visible de revalidaciones IMSS/Infonavit.
- Ya existe sugerencia automática del siguiente documento útil.
- Ya existe notificación de nueva claridad tras confirmar una carga.

Ahora se quieren implementar estas 3 mejoras:
1. Un botón único de revalidación que re-dispare IMSS e Infonavit con feedback de progreso y estado visible.
2. Una explicación visible y entendible de por qué se recomienda cada documento sugerido.
3. Una línea de tiempo del expediente que mezcle cargas, revalidaciones y hallazgos relevantes.

Necesito que propongas la mejor implementación visible y técnica para estas 3 mejoras.

Responde SOLO con JSON válido usando exactamente esta forma:
{
  "ui_strategy": {
    "single_revalidate_button": ["..."],
    "recommended_document_explanation": ["..."],
    "case_timeline": ["..."]
  },
  "backend_strategy": {
    "single_revalidate_button": ["..."],
    "recommended_document_explanation": ["..."],
    "case_timeline": ["..."]
  },
  "microcopy": {
    "revalidate_idle": "...",
    "revalidate_running": "...",
    "revalidate_done": "...",
    "recommended_reason_title": "...",
    "timeline_title": "..."
  },
  "risks": ["..."],
  "priority_order": ["..."],
  "implementation_notes": ["..."],
  "data_contracts": {
    "revalidation_status": ["..."],
    "recommended_document_reason": ["..."],
    "timeline_event": ["..."]
  }
}
`.trim();

async function callOpenAI() {
  if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY no está disponible");
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4.1-mini",
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "Responde únicamente con JSON válido, concreto y útil para producto y desarrollo." },
        { role: "user", content: prompt },
      ],
    }),
  });

  const data = await response.json();
  if (!response.ok) throw new Error(`OpenAI error: ${response.status} ${JSON.stringify(data)}`);
  return data.choices?.[0]?.message?.content ?? "{}";
}

async function callGemini() {
  if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY no está disponible");
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            {
              text: `Devuelve solo JSON válido. ${prompt}`,
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.2,
        responseMimeType: "application/json",
      },
    }),
  });

  const data = await response.json();
  if (!response.ok) throw new Error(`Gemini error: ${response.status} ${JSON.stringify(data)}`);
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
}

async function callGrok() {
  if (!XAI_API_KEY) throw new Error("XAI_API_KEY no está disponible");
  const response = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${XAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "grok-3-mini",
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "Responde únicamente con JSON válido, concreto y útil para producto y desarrollo." },
        { role: "user", content: prompt },
      ],
    }),
  });

  const data = await response.json();
  if (!response.ok) throw new Error(`Grok error: ${response.status} ${JSON.stringify(data)}`);
  return data.choices?.[0]?.message?.content ?? "{}";
}

function safeParse(label, raw) {
  try {
    return { ok: true, label, data: JSON.parse(raw) };
  } catch (error) {
    return {
      ok: false,
      label,
      raw,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

const results = {};
for (const [label, fn] of [["openai", callOpenAI], ["gemini", callGemini], ["grok", callGrok]]) {
  try {
    const raw = await fn();
    results[label] = safeParse(label, raw);
  } catch (error) {
    results[label] = {
      ok: false,
      label,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

await fs.mkdir("/home/ubuntu/complilink_operativo_v1/tmp", { recursive: true });
const outputPath = "/home/ubuntu/complilink_operativo_v1/tmp/tri_ai_recommendations_round.json";
await fs.writeFile(outputPath, JSON.stringify(results, null, 2));
console.log(outputPath);
