import fs from "fs/promises";

const outputDir = "/home/ubuntu/complilink_operativo_v1/tmp/tri_ai_round4";
await fs.mkdir(outputDir, { recursive: true });

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) throw new Error("GEMINI_API_KEY missing");

const prompt = `Contexto del producto:
- App: CompliLink / AuditaPatron.
- Pantalla foco: /auditar en móvil.
- Regla crítica: la pantalla NO puede ser larga. Debe sentirse compacta, inmediata y mágica.
- Ya existe un resultado post-upload con veredicto principal primero, semáforo explícito, un solo CTA principal, detalles secundarios colapsados y microtransición básica.
- Ahora se autorizó una cuarta ronda con 3 mejoras: (1) animación breve de progreso con mensajes humanos durante el análisis real; (2) CTA principal contextual según el tipo de documento detectado; (3) medición de tiempo y scroll hasta el veredicto en móvil.

Restricciones UX no negociables:
- Mobile-first.
- Sin lenguaje técnico interno.
- Un solo CTA principal visible.
- Veredicto primero.
- Cualquier progreso visual debe durar poco, sentirse humano y no empujar hacia abajo el veredicto.
- La medición analítica no debe meter fricción ni ruido visual.

Heurísticas actuales del flujo:
- Durante la carga ya existe una tarjeta compacta con progreso porcentual, etapas y una barra.
- Tras el análisis hay un preview y un estado confirmado con CTA principal.
- Existe infraestructura de analytics por eventos personalizados con Umami-style track(event, payload).

Tu tarea:
Actúa como auditor senior de UX de producto móvil. Propón una recomendación concreta para esta cuarta ronda, priorizando claridad, compactación y sensación de inteligencia inmediata. No rediseñes toda la pantalla; limita tus recomendaciones a cambios puntuales y ejecutables.

Devuelve JSON válido con esta forma exacta:
{
  "model_summary": "string breve",
  "non_negotiables": ["string", "string", "string"],
  "progress_recommendation": {
    "should_replace_existing_progress_copy": true,
    "messages": ["string", "string", "string"],
    "timing_seconds": "string",
    "placement": "string",
    "risk_to_avoid": "string"
  },
  "cta_by_document_type": [
    {
      "document_type": "payroll_receipt|employment_contract|policy|manual|imss|cfdi|other",
      "cta_label": "string",
      "cta_reason": "string"
    }
  ],
  "mobile_analytics": {
    "events": ["string", "string", "string"],
    "payload_fields": ["string", "string", "string"],
    "when_to_fire": "string",
    "risk_to_avoid": "string"
  },
  "implementation_priority": ["string", "string", "string"]
}

Responde solo con JSON, sin markdown.`;

async function tryModel(model) {
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: `${prompt}\n\nRecuerda: devuelve solo JSON válido.` }] }],
      generationConfig: {
        temperature: 0.3,
        responseMimeType: "application/json",
      },
    }),
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText}: ${text.slice(0, 500)}`);
  }

  const parsed = JSON.parse(text);
  return parsed.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}

const models = ["gemini-flash-latest", "gemini-2.5-flash-lite", "gemini-pro-latest"];
const attempts = [];
let success = null;

for (const model of models) {
  try {
    const content = await tryModel(model);
    success = { model, ok: true, content };
    break;
  } catch (error) {
    attempts.push({ model, ok: false, error: error instanceof Error ? error.message : String(error) });
  }
}

if (!success) {
  await fs.writeFile(`${outputDir}/gemini_retry2.error.json`, JSON.stringify(attempts, null, 2) + "\n");
  console.log(JSON.stringify({ ok: false, attempts }, null, 2));
  process.exit(1);
}

await fs.writeFile(`${outputDir}/gemini.json`, success.content + "\n");
await fs.writeFile(`${outputDir}/gemini_retry2.summary.json`, JSON.stringify({ success, attempts }, null, 2) + "\n");
console.log(JSON.stringify({ ok: true, model: success.model }, null, 2));
