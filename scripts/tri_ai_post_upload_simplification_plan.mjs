import fs from "fs/promises";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const XAI_API_KEY = process.env.XAI_API_KEY;

const sourcePath = "/home/ubuntu/complilink_operativo_v1/client/src/pages/Auditar.tsx";
const notesPath = "/home/ubuntu/complilink_operativo_v1/tmp/post_upload_ui_audit_notes.md";
const reportPath = "/home/ubuntu/complilink_operativo_v1/tmp/post_upload_ui_audit_report.md";
const outputPath = "/home/ubuntu/complilink_operativo_v1/tmp/tri_ai_post_upload_simplification_plan.json";

const systemPrompt = `Eres un principal product designer y UX writer senior especializado en flujos sensibles de confianza documental. Debes simplificar una pantalla post-subida para usuarios no técnicos en México. Tu criterio principal es: menos ruido, más claridad, un solo siguiente paso dominante y detalles secundarios colapsados. Responde SOLO JSON válido.`;

function buildUserPrompt(auditarSource, notes, report) {
  return `
Contexto:
- Producto: Auditapatron.
- Pantalla a rediseñar: el estado posterior a subir un documento en /auditar.
- Problema confirmado por el usuario: la interfaz se siente sumamente complicada, llena de textos y recuadros, poco visible, poco útil y nada engaging.
- El usuario ya aprobó una simplificación agresiva.
- Restricción crítica: NO cambiar la lógica de negocio; solo simplificar jerarquía, orden, visibilidad y copy de la vista post-subida.

Diagnóstico ya levantado:
<<<AUDIT_NOTES
${notes}
AUDIT_NOTES>>>

Síntesis previa:
<<<AUDIT_REPORT
${report}
AUDIT_REPORT>>>

Código actual de /auditar:
<<<AUDITAR_TSX
${auditarSource}
AUDITAR_TSX>>>

Tarea:
Devuélveme el mejor plan visible para rediseñar la experiencia post-subida con máxima claridad. Quiero una propuesta directamente implementable en React/TSX. Prioriza solo lo que debe verse primero y manda todo lo demás a capas secundarias.

Responde SOLO un JSON con esta forma exacta:
{
  "verdict": "...",
  "top_level_layout": [
    {
      "order": 1,
      "section": "...",
      "goal": "...",
      "must_show": ["..."],
      "must_hide_initially": ["..."]
    }
  ],
  "keep_merge_collapse_remove": [
    {
      "current_block": "...",
      "action": "keep|merge|collapse|remove|demote",
      "why": "..."
    }
  ],
  "hero_result_card": {
    "title_pattern": "...",
    "supporting_text_pattern": "...",
    "badges": ["..."],
    "do_not_include": ["..."]
  },
  "key_findings_module": {
    "max_items_visible": 0,
    "recommended_format": "...",
    "items_should_answer": ["..."]
  },
  "next_step_module": {
    "title": "...",
    "body_pattern": "...",
    "primary_cta": "...",
    "secondary_cta": "..."
  },
  "details_zone": {
    "should_be_collapsed": ["..."],
    "should_move_lower": ["..."]
  },
  "copy_rules": ["..."],
  "implementation_order": ["..."],
  "test_guardrails": ["..."],
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

async function callGeminiWithModel(model, userPrompt) {
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      generationConfig: {
        temperature: 0.3,
        responseMimeType: "application/json",
      },
      contents: [{ role: "user", parts: [{ text: userPrompt }] }],
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    return { ok: false, error: JSON.stringify(data), model };
  }

  const text = data.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("") ?? "{}";
  return { ok: true, parsed: JSON.parse(text), model };
}

async function callGemini(userPrompt) {
  if (!GEMINI_API_KEY) {
    return { provider: "gemini", ok: false, error: "GEMINI_API_KEY missing" };
  }

  const candidates = ["gemini-2.5-flash-lite", "gemini-flash-lite-latest", "gemini-flash-latest"];
  for (const model of candidates) {
    const result = await callGeminiWithModel(model, userPrompt);
    if (result.ok) {
      return { provider: "gemini", ok: true, model, parsed: result.parsed };
    }
  }

  const last = await callGeminiWithModel(candidates[candidates.length - 1], userPrompt);
  return { provider: "gemini", ok: false, error: last.error, model: candidates[candidates.length - 1] };
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
  const [auditarSource, notes, report] = await Promise.all([
    fs.readFile(sourcePath, "utf8"),
    fs.readFile(notesPath, "utf8"),
    fs.readFile(reportPath, "utf8"),
  ]);

  const userPrompt = buildUserPrompt(auditarSource, notes, report);
  const [chatgpt, gemini, grok] = await Promise.all([
    callOpenAI(userPrompt),
    callGemini(userPrompt),
    callGrok(userPrompt),
  ]);

  const result = {
    generatedAt: new Date().toISOString(),
    sourcePath,
    notesPath,
    reportPath,
    providers: { chatgpt, gemini, grok },
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
