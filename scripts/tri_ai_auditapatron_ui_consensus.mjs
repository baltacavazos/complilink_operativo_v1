import fs from "node:fs/promises";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const XAI_API_KEY = process.env.XAI_API_KEY;

const sourcePath = "/home/ubuntu/complilink_operativo_v1/client/src/pages/Auditar.tsx";
const outputPath = "/home/ubuntu/complilink_operativo_v1/tri_ai_auditapatron_ui_consensus_output.json";

const systemPrompt = `Eres un principal product designer y UX writer senior especializado en productos sensibles de confianza, evidencia documental y flujos de análisis asistido por IA. Debes proponer mejoras de interfaz muy claras para personas no técnicas en México. Debes minimizar ansiedad, explicar resultados con honestidad, separar con claridad lo confirmado de lo estimado y hacer que el producto se sienta seguro, útil y simple. Responde SOLO JSON válido.`;

function buildUserPrompt(auditarSource) {
  return `
Contexto del producto:
- Producto: Auditapatron.
- Pantalla central y crítica: /auditar.
- Objetivo: que cualquier trabajador entienda qué documento subió, qué aportó, qué ya está confirmado, qué todavía es estimación y cuál es el siguiente mejor paso.
- Estilo deseado: muy simple, confiable, claro, nada técnico, cero jerga innecesaria.
- Restricción: no sonar a asesoría legal definitiva ni a promesa exagerada.

Cambios de backend ya disponibles:
- El sistema ya clasifica más tipos de documentos laborales.
- Ya separa datos confirmados y datos estimados preliminarmente.
- Ya puede recibir resultados de vuelta desde CompliLink MX.
- Ya existen estados de procesamiento y trazabilidad.

Tarea:
Analiza esta pantalla actual de React/TSX y propón la mejor arquitectura visible posible para la interfaz central. Quiero una recomendación de importancia máxima, lista para convertir en diseño y luego en implementación.

Código actual de la pantalla /auditar:
<<<AUDITAR_TSX
${auditarSource}
AUDITAR_TSX>>>

Devuélveme SOLO un JSON con esta forma exacta:
{
  "diagnosis": {
    "what_is_working": ["..."],
    "what_is_confusing": ["..."],
    "highest_risk_for_user_trust": ["..."]
  },
  "recommended_information_hierarchy": [
    {
      "order": 1,
      "section": "...",
      "why": "..."
    }
  ],
  "recommended_core_cards": [
    {
      "name": "...",
      "purpose": "...",
      "must_show": ["..."],
      "must_not_show": ["..."]
    }
  ],
  "copy_principles": ["..."],
  "microcopy_examples": {
    "confirmed_data_title": "...",
    "estimated_data_title": "...",
    "next_step_title": "...",
    "processing_state_sent": "...",
    "processing_state_pending": "...",
    "empty_state": "..."
  },
  "interaction_recommendations": ["..."],
  "visual_tone": {
    "overall": "...",
    "avoid": ["..."],
    "emphasis": ["..."]
  },
  "one_sentence_direction": "..."
}
`.trim();
}

async function callOpenAI(userPrompt) {
  if (!OPENAI_API_KEY) {
    return { provider: "chatgpt", ok: false, error: "OPENAI_API_KEY missing" };
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4.1-mini",
      temperature: 0.4,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    return { provider: "chatgpt", ok: false, error: JSON.stringify(data) };
  }

  return {
    provider: "chatgpt",
    ok: true,
    raw: data,
    parsed: JSON.parse(data.choices?.[0]?.message?.content ?? "{}"),
  };
}

async function callGemini(userPrompt) {
  if (!GEMINI_API_KEY) {
    return { provider: "gemini", ok: false, error: "GEMINI_API_KEY missing" };
  }

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: systemPrompt }],
      },
      generationConfig: {
        temperature: 0.4,
        responseMimeType: "application/json",
      },
      contents: [
        {
          role: "user",
          parts: [{ text: userPrompt }],
        },
      ],
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    return { provider: "gemini", ok: false, error: JSON.stringify(data) };
  }

  const text = data.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("") ?? "{}";
  return {
    provider: "gemini",
    ok: true,
    raw: data,
    parsed: JSON.parse(text),
  };
}

async function callGrok(userPrompt) {
  if (!XAI_API_KEY) {
    return { provider: "grok", ok: false, error: "XAI_API_KEY missing" };
  }

  const response = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${XAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "grok-4-0709",
      temperature: 0.4,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    return { provider: "grok", ok: false, error: JSON.stringify(data) };
  }

  return {
    provider: "grok",
    ok: true,
    raw: data,
    parsed: JSON.parse(data.choices?.[0]?.message?.content ?? "{}"),
  };
}

async function main() {
  const auditarSource = await fs.readFile(sourcePath, "utf8");
  const userPrompt = buildUserPrompt(auditarSource);

  const [chatgpt, gemini, grok] = await Promise.all([
    callOpenAI(userPrompt),
    callGemini(userPrompt),
    callGrok(userPrompt),
  ]);

  const result = {
    generatedAt: new Date().toISOString(),
    sourcePath,
    providers: {
      chatgpt,
      gemini,
      grok,
    },
  };

  await fs.writeFile(outputPath, JSON.stringify(result, null, 2));
  console.log(JSON.stringify({ ok: true, outputPath }, null, 2));
}

main().catch(async (error) => {
  const failure = {
    generatedAt: new Date().toISOString(),
    sourcePath,
    error: error instanceof Error ? { message: error.message, stack: error.stack } : String(error),
  };
  await fs.writeFile(outputPath, JSON.stringify(failure, null, 2));
  console.error(error);
  process.exit(1);
});
