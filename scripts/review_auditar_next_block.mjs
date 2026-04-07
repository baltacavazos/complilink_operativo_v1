import fs from "node:fs/promises";
import path from "node:path";

const projectRoot = "/home/ubuntu/complilink_operativo_v1";
const outputDir = path.join(projectRoot, "research", "auditar_next_block_review");
await fs.mkdir(outputDir, { recursive: true });

const auditarSource = await fs.readFile(path.join(projectRoot, "client/src/pages/Auditar.tsx"), "utf8");
const testSource = await fs.readFile(path.join(projectRoot, "server/auditapatron.homepage.test.ts"), "utf8");

const prompt = `
Contexto:
- Producto: AuditaPatron.
- Idioma visible: español.
- Público: trabajadores no técnicos que están armando un expediente laboral.
- Helios debe sentirse como el cerebro central del expediente.
- La integración remota de Helios sigue en modo mock.
- Ya se implementó en /auditar una tarjeta de siguiente documento recomendado y una línea de tiempo simple del expediente.
- También ya se actualizaron pruebas Vitest.

Tu tarea:
Haz una revisión crítica de este bloque ya implementado. Evalúa si la UX es clara, simple, mobile-first, confiable y coherente con Helios como cerebro central. No propongas reescrituras completas ni features enormes; prioriza ajustes concretos de alto impacto y bajo riesgo.

Responde SOLO en JSON válido con esta estructura exacta:
{
  "verdict": "approve" | "approve_with_adjustments" | "needs_changes",
  "strengths": ["string"],
  "issues": ["string"],
  "quick_wins": ["string"],
  "copy_risks": ["string"],
  "test_gaps": ["string"],
  "recommended_next_step": "string"
}

Código relevante de Auditar.tsx:
<source_auditar>
${auditarSource}
</source_auditar>

Prueba relevante:
<source_test>
${testSource}
</source_test>
`;

async function callOpenAI() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY no está disponible");

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
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
          content:
            "Eres un revisor senior de UX legal-tech en español. Evalúas claridad, confianza, simplicidad y riesgo de sobrepromesa. Tus recomendaciones deben ser concretas, pequeñas y ejecutables.",
        },
        { role: "user", content: prompt },
      ],
    }),
  });

  if (!response.ok) throw new Error(`OpenAI error ${response.status}: ${await response.text()}`);
  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("OpenAI no devolvió contenido");
  return JSON.parse(content);
}

async function callGemini() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY no está disponible");

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: {
        parts: [
          {
            text: "Eres un revisor senior de UX legal-tech en español. Evalúas claridad, confianza, simplicidad y riesgo de sobrepromesa. Tus recomendaciones deben ser concretas, pequeñas y ejecutables.",
          },
        ],
      },
      generationConfig: {
        temperature: 0.2,
        responseMimeType: "application/json",
      },
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    }),
  });

  if (!response.ok) throw new Error(`Gemini error ${response.status}: ${await response.text()}`);
  const data = await response.json();
  const content = data.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("");
  if (!content) throw new Error("Gemini no devolvió contenido");
  return JSON.parse(content);
}

async function callGrok() {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) throw new Error("XAI_API_KEY no está disponible");

  const response = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "grok-4",
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "Eres un revisor senior de UX legal-tech en español. Evalúas claridad, confianza, simplicidad y riesgo de sobrepromesa. Tus recomendaciones deben ser concretas, pequeñas y ejecutables.",
        },
        { role: "user", content: prompt },
      ],
    }),
  });

  if (!response.ok) throw new Error(`Grok error ${response.status}: ${await response.text()}`);
  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("Grok no devolvió contenido");
  return JSON.parse(content);
}

const results = {};
const failures = {};
for (const [name, fn] of [["openai", callOpenAI], ["gemini", callGemini], ["grok", callGrok]]) {
  try {
    const result = await fn();
    results[name] = result;
    await fs.writeFile(path.join(outputDir, `${name}_review.json`), JSON.stringify(result, null, 2));
  } catch (error) {
    failures[name] = String(error);
    await fs.writeFile(path.join(outputDir, `${name}_review_error.txt`), `${String(error)}\n`);
  }
}

const summary = {
  generatedAt: new Date().toISOString(),
  availableResults: Object.keys(results),
  failedResults: failures,
};

await fs.writeFile(path.join(outputDir, "summary.json"), JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
