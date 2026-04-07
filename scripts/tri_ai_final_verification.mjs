import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = process.cwd();
const outputPath = resolve(root, "tri_ai_final_verification_output.json");

const summary = {
  project: "Auditapatron / CompliLink Operativo",
  implementedChanges: [
    "Integración bidireccional entre Auditapatron y CompliLink con contrato saliente document.uploaded.",
    "Firma HMAC sobre timestamp.body y recepción de eventos de retorno para sincronización operativa.",
    "Clasificación documental ampliada y análisis preliminar con separación de datos confirmados y estimados.",
    "Rediseño de la pantalla /auditar en lenguaje muy simple, con jerarquía tranquila, progreso del expediente, siguiente documento sugerido y resultado humano del último archivo.",
    "Pruebas locales del proyecto en verde: 28 de 28."
  ],
  reviewGoals: [
    "Detectar riesgos funcionales o de confianza antes del cierre.",
    "Evaluar si la interfaz central transmite claridad, calma y utilidad a personas no técnicas.",
    "Confirmar si la separación entre datos confirmados y estimados está bien comunicada.",
    "Sugerir ajustes mínimos de alto impacto antes de dar por bueno este bloque."
  ]
};

async function safeRead(relativePath, maxChars = 18000) {
  try {
    const content = await readFile(resolve(root, relativePath), "utf8");
    return { path: relativePath, content: content.slice(0, maxChars) };
  } catch (error) {
    return { path: relativePath, content: `No disponible: ${error.message}` };
  }
}

const files = await Promise.all([
  safeRead("client/src/pages/Auditar.tsx", 22000),
  safeRead("server/auditaPatronIntegrationService.ts", 18000),
  safeRead("server/auditaPatronReturnWebhook.ts", 18000),
  safeRead("server/caseContracts.ts", 18000),
  safeRead("server/routers.ts", 18000),
  safeRead("server/auditapatron.homepage.test.ts", 12000),
]);

const prompt = `Actúa como un revisor senior de producto y confiabilidad. Evalúa este bloque final de Auditapatron con un enfoque práctico y no teórico.

Proyecto:
${JSON.stringify(summary, null, 2)}

Archivos clave:
${files.map((file) => `\n### ${file.path}\n${file.content}`).join("\n")}

Devuélveme exclusivamente JSON válido con esta forma exacta:
{
  "overall_verdict": "go" | "go_with_minor_adjustments" | "needs_changes",
  "top_strengths": ["...", "...", "..."],
  "top_risks": ["...", "...", "..."],
  "ui_clarity_review": {
    "score": 1-10,
    "what_works": ["...", "..."],
    "what_to_improve": ["...", "..."]
  },
  "trust_review": {
    "score": 1-10,
    "what_builds_trust": ["...", "..."],
    "what_could_confuse": ["...", "..."]
  },
  "release_recommendation": "texto breve",
  "one_high_impact_adjustment": "texto breve"
}

Sé concreto, honesto y breve.`;

async function callOpenAI() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return { error: "OPENAI_API_KEY no disponible" };

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
        { role: "system", content: "Responde solo con JSON válido." },
        { role: "user", content: prompt },
      ],
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    return { error: data?.error?.message ?? `HTTP ${response.status}` };
  }

  const content = data?.choices?.[0]?.message?.content;
  return JSON.parse(content);
}

async function callGemini() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { error: "GEMINI_API_KEY no disponible" };

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
        contents: [{ parts: [{ text: prompt }] }],
      }),
    },
  );

  const data = await response.json();
  if (!response.ok) {
    return { error: data?.error?.message ?? `HTTP ${response.status}` };
  }

  const text = data?.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("") ?? "{}";
  return JSON.parse(text);
}

async function callGrok() {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) return { error: "XAI_API_KEY no disponible" };

  const response = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "grok-3-mini",
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "Responde solo con JSON válido." },
        { role: "user", content: prompt },
      ],
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    return { error: data?.error?.message ?? `HTTP ${response.status}` };
  }

  const content = data?.choices?.[0]?.message?.content;
  return JSON.parse(content);
}

function buildConsensus(results) {
  const verdicts = Object.entries(results).map(([model, value]) => ({ model, verdict: value?.overall_verdict ?? "error" }));
  const valid = Object.values(results).filter((value) => !value?.error);

  const countMap = new Map();
  for (const item of valid) {
    const current = countMap.get(item.overall_verdict) ?? 0;
    countMap.set(item.overall_verdict, current + 1);
  }

  const consensusVerdict = [...countMap.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "error";
  const releaseNotes = valid.map((item) => item.release_recommendation).filter(Boolean);
  const adjustments = valid.map((item) => item.one_high_impact_adjustment).filter(Boolean);

  return {
    verdicts,
    consensus_verdict: consensusVerdict,
    common_release_direction: releaseNotes,
    suggested_adjustments: adjustments,
  };
}

const [chatgpt, gemini, grok] = await Promise.all([callOpenAI(), callGemini(), callGrok()]);
const results = { chatgpt, gemini, grok };
const consensus = buildConsensus(results);

await writeFile(
  outputPath,
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      summary,
      results,
      consensus,
    },
    null,
    2,
  ),
  "utf8",
);

console.log(JSON.stringify({ outputPath, consensus }, null, 2));
