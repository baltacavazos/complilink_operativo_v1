import fs from "fs/promises";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

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

if (!GEMINI_API_KEY) {
  throw new Error("GEMINI_API_KEY no está disponible");
}

const models = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"];
const attempts = [];
let finalData = null;
let usedModel = null;

for (const model of models) {
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`, {
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
  attempts.push({ model, status: response.status, ok: response.ok, data });

  if (response.ok) {
    finalData = data;
    usedModel = model;
    break;
  }
}

if (!finalData) {
  const error = new Error("No fue posible obtener respuesta de Gemini con los modelos intentados");
  error.attempts = attempts;
  throw error;
}

await fs.mkdir("/home/ubuntu/complilink_operativo_v1/tmp", { recursive: true });
const outputPath = "/home/ubuntu/complilink_operativo_v1/tmp/gemini_retry_recommendations_round.json";
await fs.writeFile(outputPath, JSON.stringify({ usedModel, response: finalData, attempts }, null, 2));
console.log(outputPath);
