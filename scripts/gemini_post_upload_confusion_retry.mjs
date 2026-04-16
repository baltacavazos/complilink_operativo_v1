import fs from "fs/promises";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const notesPath = "/home/ubuntu/complilink_operativo_v1/tmp/post_upload_ui_audit_notes.md";
const outputPath = "/home/ubuntu/complilink_operativo_v1/tmp/gemini_post_upload_confusion_retry.json";

const systemPrompt = `Eres un principal product designer y UX writer senior especializado en productos de confianza, evidencia documental y flujos asistidos por IA para personas no técnicas. Debes detectar confusión, sobrecarga visual, fricción de decisión y falta de claridad en siguientes pasos. Responde SOLO JSON válido.`;

function buildUserPrompt(notes) {
  return `
Contexto:
- Producto: AuditaPatron.
- Pantalla auditada: interfaz posterior a subir un documento dentro de /auditar.
- Reporte directo del usuario: la página sigue siendo sumamente complicada, llena de textos y recuadros, poco visible, poco útil y cero engaging.
- Objetivo ideal: un lugar no confuso, con información muy visible y útil, y con siguientes pasos o recomendaciones totalmente claras.

Evidencia:
<<<EVIDENCIA
${notes}
EVIDENCIA>>>

Devuelve SOLO JSON con esta forma exacta:
{
  "overall_verdict": "...",
  "severity": "low | medium | high | critical",
  "main_failures": [{"title": "...", "why_it_hurts": "...", "evidence_from_interface": "..."}],
  "what_is_salvageable": [{"element": "...", "why_keep_it": "..."}],
  "what_should_be_visible_first": ["..."],
  "what_should_be_hidden_or_collapsed": ["..."],
  "sections_to_merge_or_remove": [{"section": "...", "action": "merge | remove | collapse | demote", "reason": "..."}],
  "ideal_post_upload_flow": [{"step": 1, "section": "...", "goal": "...", "must_contain": ["..."]}],
  "clear_next_step_model": {"title": "...", "body": "...", "primary_cta": "...", "secondary_cta": "..."},
  "engagement_diagnosis": {"why_it_feels_flat": ["..."], "how_to_make_it_more_engaging_without_noise": ["..."]},
  "top_3_priorities": ["..."],
  "single_sentence_direction": "..."
}
`.trim();
}

async function main() {
  if (!GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY missing");
  }
  const notes = await fs.readFile(notesPath, "utf8");
  const userPrompt = buildUserPrompt(notes);

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent?key=${GEMINI_API_KEY}`, {
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
    await fs.writeFile(outputPath, JSON.stringify({ ok: false, error: data }, null, 2));
    throw new Error(JSON.stringify(data));
  }

  const text = data.candidates?.[0]?.content?.parts?.map(part => part.text || "").join("") ?? "{}";
  await fs.writeFile(outputPath, JSON.stringify({ ok: true, parsed: JSON.parse(text) }, null, 2));
  console.log(JSON.stringify({ ok: true, outputPath }, null, 2));
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
