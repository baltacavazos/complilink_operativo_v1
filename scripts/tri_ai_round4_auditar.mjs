import fs from "fs/promises";

const projectDir = "/home/ubuntu/complilink_operativo_v1";
const outputDir = `${projectDir}/tmp/tri_ai_round4`;
await fs.mkdir(outputDir, { recursive: true });

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
      temperature: 0.3,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "Eres un auditor senior de UX móvil. Devuelves únicamente JSON válido." },
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
      temperature: 0.3,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "Eres un auditor senior de UX móvil. Devuelves únicamente JSON válido." },
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
        temperature: 0.3,
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
    results[name] = { ok: false, error: error instanceof Error ? error.message : String(error) };
    await fs.writeFile(`${outputDir}/${name}.error.txt`, `${results[name].error}\n`);
  }
}

await fs.writeFile(`${outputDir}/summary.json`, JSON.stringify(results, null, 2) + "\n");
console.log(JSON.stringify(results, null, 2));
