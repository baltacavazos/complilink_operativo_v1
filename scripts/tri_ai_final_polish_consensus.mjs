import fs from "node:fs/promises";
import path from "node:path";

const projectRoot = "/home/ubuntu/complilink_operativo_v1";
const screenshotPath = "/home/ubuntu/screenshots/webdev-preview-1775537898.png";
const outputPath = path.join(projectRoot, "tri_ai_final_polish_consensus_output.json");

const CANONICAL_STRENGTHS = [
  "hero_claro",
  "lenguaje_humano",
  "cta_visible",
  "confianza_visual",
  "propuesta_facil",
  "progreso_entendible",
  "mobile_direction",
  "identidad_amable",
];

const CANONICAL_ISSUES = [
  "header_saturado",
  "hero_desbalanceado",
  "cta_duplicado_o_confuso",
  "progreso_compite_con_hero",
  "tarjetas_densas",
  "contraste_suave",
  "scroll_extenso",
  "prueba_social_ausente",
  "jerarquia_irregular",
  "microcopy_extenso",
  "mobile_no_suficientemente_puro",
  "falta_microinteracciones",
];

const CANONICAL_CHANGES = [
  "simplificar_header",
  "reforzar_cta_principal",
  "compactar_tarjetas_laterales",
  "mejorar_ritmo_tipografico",
  "suavizar_texto_secundario",
  "dar_mas_aire_al_hero",
  "fortalecer_prueba_social_o_confianza",
  "hacer_mobile_mas_pulgar_amigable",
  "reducir_ruido_visual",
  "mejorar_estados_y_microfeedback",
];

function extractJson(text) {
  if (!text) return null;
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {}
  const match = trimmed.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

function countVotes(items = []) {
  const counts = new Map();
  for (const item of items) {
    counts.set(item, (counts.get(item) || 0) + 1);
  }
  return Object.fromEntries([...counts.entries()].sort((a, b) => b[1] - a[1]));
}

function aggregate(results) {
  const valid = results.filter((item) => item && !item.error && item.parsed);
  const strengths = valid.flatMap((item) => item.parsed.strength_ids || []);
  const issues = valid.flatMap((item) => item.parsed.issue_ids || []);
  const changes = valid.flatMap((item) => item.parsed.priority_change_ids || []);

  return {
    model_count: valid.length,
    strengths_vote_count: countVotes(strengths),
    issues_vote_count: countVotes(issues),
    priority_changes_vote_count: countVotes(changes),
    strong_consensus_strengths: Object.entries(countVotes(strengths))
      .filter(([, count]) => count >= 2)
      .map(([id, count]) => ({ id, count })),
    strong_consensus_issues: Object.entries(countVotes(issues))
      .filter(([, count]) => count >= 2)
      .map(([id, count]) => ({ id, count })),
    strong_consensus_changes: Object.entries(countVotes(changes))
      .filter(([, count]) => count >= 2)
      .map(([id, count]) => ({ id, count })),
  };
}

async function callOpenAI(promptText, imageDataUrl) {
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
            "Eres un director de producto y diseño muy exigente. Evalúas interfaces como cliente duro pero justo. Priorizas claridad, simplicidad, confianza, mobile-first y preparación futura para app móvil. Responde únicamente JSON válido.",
        },
        {
          role: "user",
          content: [
            { type: "text", text: promptText },
            { type: "image_url", image_url: { url: imageDataUrl } },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI ${response.status}: ${await response.text()}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content ?? "";
}

async function callGrok(promptText, imageDataUrl) {
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
            "Eres un evaluador de UX/UI y estrategia de producto extremadamente exigente. Prioriza claridad, simplicidad, confianza, mobile-first y preparación para app. Responde únicamente JSON válido.",
        },
        {
          role: "user",
          content: [
            { type: "text", text: promptText },
            { type: "image_url", image_url: { url: imageDataUrl } },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`Grok ${response.status}: ${await response.text()}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content ?? "";
}

async function callGemini(promptText, imageBase64, mimeType) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY no está disponible");

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        generationConfig: {
          temperature: 0.2,
          responseMimeType: "application/json",
        },
        contents: [
          {
            role: "user",
            parts: [
              { text: promptText },
              {
                inline_data: {
                  mime_type: mimeType,
                  data: imageBase64,
                },
              },
            ],
          },
        ],
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`Gemini ${response.status}: ${await response.text()}`);
  }

  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("\n") ?? "";
}

async function main() {
  const [homeSource, auditSource, screenshotBuffer] = await Promise.all([
    fs.readFile(path.join(projectRoot, "client/src/pages/Home.tsx"), "utf8").catch(() => ""),
    fs.readFile(path.join(projectRoot, "client/src/pages/Auditar.tsx"), "utf8").catch(() => ""),
    fs.readFile(screenshotPath),
  ]);

  const imageBase64 = screenshotBuffer.toString("base64");
  const imageDataUrl = `data:image/png;base64,${imageBase64}`;

  const promptText = `
Producto: Auditapatron.
Meta: claridad laboral para trabajadores, con lenguaje no técnico, alta confianza, experiencia amable y enfoque mobile-first. También debe quedar bien preparado para futura app Android/iOS.

Tu tarea: evalúa la captura actual y el estado real de la interfaz.

Contexto de la pantalla actual:
- Hay una captura reciente de la interfaz visible.
- También se incluyen fragmentos reales de Home.tsx y Auditar.tsx para entender intención, copy y estructura.
- Queremos una última ronda de pulido final antes del cierre.

Home.tsx (extracto):
${homeSource.slice(0, 14000)}

Auditar.tsx (extracto):
${auditSource.slice(0, 14000)}

Evalúa como cliente exigente. No seas complaciente. Di claramente qué está muy bien, qué está mal y qué debería pulirse todavía.

Debes elegir ids únicamente de estas listas canónicas para hacer comparable tu respuesta.

strength_ids permitidos:
${JSON.stringify(CANONICAL_STRENGTHS)}

issue_ids permitidos:
${JSON.stringify(CANONICAL_ISSUES)}

priority_change_ids permitidos:
${JSON.stringify(CANONICAL_CHANGES)}

Responde SOLO en JSON con esta estructura exacta:
{
  "overall_score": 0,
  "strength_ids": ["..."],
  "strength_notes": [{"id":"...","why":"..."}],
  "issue_ids": ["..."],
  "issue_notes": [{"id":"...","why":"..."}],
  "priority_change_ids": ["..."],
  "priority_change_notes": [{"id":"...","why":"...","implementation_hint":"..."}],
  "mobile_readiness_score": 0,
  "app_readiness_score": 0,
  "final_verdict": "...",
  "one_sentence_consensus_proposal": "..."
}

Reglas:
- overall_score, mobile_readiness_score y app_readiness_score deben ser enteros de 1 a 10.
- No inventes ids fuera de las listas.
- Elige entre 3 y 5 fortalezas, entre 3 y 5 problemas y entre 3 y 5 cambios prioritarios.
- Habla en español claro.
`.trim();

  const models = [
    { name: "chatgpt", fn: () => callOpenAI(promptText, imageDataUrl) },
    { name: "grok", fn: () => callGrok(promptText, imageDataUrl) },
    { name: "gemini", fn: () => callGemini(promptText, imageBase64, "image/png") },
  ];

  const results = [];
  for (const model of models) {
    try {
      const raw = await model.fn();
      const parsed = extractJson(raw);
      if (!parsed) {
        results.push({ model: model.name, error: "No se pudo parsear JSON", raw });
      } else {
        results.push({ model: model.name, raw, parsed });
      }
    } catch (error) {
      results.push({ model: model.name, error: error instanceof Error ? error.message : String(error) });
    }
  }

  const output = {
    generated_at: new Date().toISOString(),
    screenshot_path: screenshotPath,
    canonical_strengths: CANONICAL_STRENGTHS,
    canonical_issues: CANONICAL_ISSUES,
    canonical_changes: CANONICAL_CHANGES,
    results,
    consensus: aggregate(results),
  };

  await fs.writeFile(outputPath, JSON.stringify(output, null, 2));
  console.log(`Resultado guardado en ${outputPath}`);
}

main().catch(async (error) => {
  const fallback = {
    generated_at: new Date().toISOString(),
    fatal_error: error instanceof Error ? error.message : String(error),
  };
  await fs.writeFile(outputPath, JSON.stringify(fallback, null, 2));
  console.error(error);
  process.exit(1);
});
