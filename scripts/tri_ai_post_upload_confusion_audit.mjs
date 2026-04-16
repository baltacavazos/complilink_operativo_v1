import fs from "fs/promises";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const XAI_API_KEY = process.env.XAI_API_KEY;

const notesPath = "/home/ubuntu/complilink_operativo_v1/tmp/post_upload_ui_audit_notes.md";
const outputPath = "/home/ubuntu/complilink_operativo_v1/tmp/tri_ai_post_upload_confusion_audit.json";

const systemPrompt = `Eres un principal product designer y UX writer senior especializado en productos de confianza, evidencia documental y flujos asistidos por IA para personas no técnicas. Debes detectar confusión, sobrecarga visual, fricción de decisión y falta de claridad en siguientes pasos. Tu criterio principal es: la interfaz debe sentirse clara, útil, visible y engaging sin ocultar información importante. Responde SOLO JSON válido.`;

function buildUserPrompt(notes) {
  return `
Contexto:
- Producto: AuditaPatron.
- Pantalla auditada: interfaz posterior a subir un documento dentro de /auditar.
- Reporte directo del usuario: "sigue siendo sumamente complicada y llena de textos y recuadros... la información no es visible ni útil... los siguientes pasos o recomendaciones no son claras... es demasiado confuso y cero engaging".
- Objetivo ideal: un lugar no confuso, con información muy visible y útil, y con siguientes pasos o recomendaciones totalmente claras.
- Restricción: no pidas rediseños vagos. Prioriza decisiones concretas de jerarquía, simplificación y reducción de ruido.

Evidencia común recopilada por Manus desde código y pantalla real:
<<<EVIDENCIA
${notes}
EVIDENCIA>>>

Tarea:
Haz una auditoría UX brutalmente honesta de esta pantalla post-subida. Necesito saber por qué hoy se siente pesada, qué información sí vale la pena conservar, qué sobra, qué está mal jerarquizado y cómo debería verse la experiencia ideal inmediatamente después de subir un documento.

Devuélveme SOLO JSON con esta estructura exacta:
{
  "overall_verdict": "...",
  "severity": "low | medium | high | critical",
  "main_failures": [
    {
      "title": "...",
      "why_it_hurts": "...",
      "evidence_from_interface": "..."
    }
  ],
  "what_is_salvageable": [
    {
      "element": "...",
      "why_keep_it": "..."
    }
  ],
  "what_should_be_visible_first": ["..."],
  "what_should_be_hidden_or_collapsed": ["..."],
  "sections_to_merge_or_remove": [
    {
      "section": "...",
      "action": "merge | remove | collapse | demote",
      "reason": "..."
    }
  ],
  "ideal_post_upload_flow": [
    {
      "step": 1,
      "section": "...",
      "goal": "...",
      "must_contain": ["..."]
    }
  ],
  "clear_next_step_model": {
    "title": "...",
    "body": "...",
    "primary_cta": "...",
    "secondary_cta": "..."
  },
  "engagement_diagnosis": {
    "why_it_feels_flat": ["..."],
    "how_to_make_it_more_engaging_without_noise": ["..."]
  },
  "top_3_priorities": ["..."],
  "single_sentence_direction": "..."
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
      temperature: 0.3,
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
        temperature: 0.3,
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

  const text = data.candidates?.[0]?.content?.parts?.map(part => part.text || "").join("") ?? "{}";
  return {
    provider: "gemini",
    ok: true,
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
      temperature: 0.3,
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
    parsed: JSON.parse(data.choices?.[0]?.message?.content ?? "{}"),
  };
}

async function main() {
  const notes = await fs.readFile(notesPath, "utf8");
  const userPrompt = buildUserPrompt(notes);

  const [chatgpt, gemini, grok] = await Promise.all([
    callOpenAI(userPrompt),
    callGemini(userPrompt),
    callGrok(userPrompt),
  ]);

  const result = {
    generatedAt: new Date().toISOString(),
    notesPath,
    providers: { chatgpt, gemini, grok },
  };

  await fs.writeFile(outputPath, JSON.stringify(result, null, 2));
  console.log(JSON.stringify({ ok: true, outputPath }, null, 2));
}

main().catch(async error => {
  const failure = {
    generatedAt: new Date().toISOString(),
    notesPath,
    error: error instanceof Error ? { message: error.message, stack: error.stack } : String(error),
  };
  await fs.writeFile(outputPath, JSON.stringify(failure, null, 2));
  console.error(error);
  process.exit(1);
});
