import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = process.cwd();
const outputPath = resolve(root, "artifacts/tri_ai_prelaunch_health_audit.json");

async function safeRead(relativePath, maxChars = 18000) {
  try {
    const content = await readFile(resolve(root, relativePath), "utf8");
    return { path: relativePath, content: content.slice(0, maxChars) };
  } catch (error) {
    return { path: relativePath, content: `No disponible: ${error.message}` };
  }
}

const summary = {
  project: "AUDITAPATRON",
  objective: "Auditoría exhaustiva de salud pre-lanzamiento para apertura pública y creación de usuarios reales.",
  auditFocus: [
    "Estabilidad técnica y consistencia del entorno",
    "Cobertura y estado real de pruebas",
    "Riesgos funcionales en Home, /acceso y /auditar",
    "Bloqueadores de salida pública",
    "Preparación operativa para usuarios reales"
  ],
  collectedEvidence: [
    "webdev_check_status reportó servidor activo, TypeScript sin errores, dependencias OK y LSP sin errores.",
    "Las rutas públicas /, /auditar y /acceso responden 200.",
    "La corrida completa de Vitest reportó 10 archivos fallando y 25 pruebas fallando.",
    "El proyecto muestra avisos de baseline-browser-mapping desactualizado y un warning operativo de infraestructura faltante para CEO Bridge Schedule.",
    "Se observaron fallos de autenticación/alcance de Dropbox y desalineaciones de tests/regresiones de copy y responsive."
  ]
};

const files = await Promise.all([
  safeRead("artifacts/prelaunch_health_baseline.txt", 24000),
  safeRead("client/src/pages/Home.tsx", 18000),
  safeRead("client/src/pages/Access.tsx", 18000),
  safeRead("client/src/pages/Auditar.tsx", 24000),
  safeRead("server/routers.ts", 18000),
  safeRead("server/db.ts", 18000),
  safeRead("server/caseWorkflows.test.ts", 22000),
  safeRead("server/auditaPatronBridgeConfig.test.ts", 12000),
  safeRead("client/src/responsive-layout.test.ts", 14000)
]);

const prompt = `Actúa como auditor senior de release readiness para una plataforma web que está por abrirse al público.

Tu trabajo es revisar la evidencia técnica y funcional de AUDITAPATRON y emitir un dictamen honesto, operativo y accionable. No optimices por cortesía; optimiza por seguridad de lanzamiento.

Resumen del caso:
${JSON.stringify(summary, null, 2)}

Evidencia clave:
${files.map((file) => `\n### ${file.path}\n${file.content}`).join("\n")}

Devuélveme exclusivamente JSON válido con esta forma exacta:
{
  "launch_verdict": "ready" | "ready_with_conditions" | "not_ready",
  "executive_summary": "texto breve",
  "critical_blockers": [
    {
      "title": "texto",
      "severity": "critical",
      "why_it_matters": "texto",
      "recommended_action": "texto"
    }
  ],
  "major_risks": [
    {
      "title": "texto",
      "severity": "high" | "medium",
      "why_it_matters": "texto",
      "recommended_action": "texto"
    }
  ],
  "strengths": ["...", "...", "..."],
  "testing_assessment": {
    "score": 1,
    "summary": "texto",
    "must_fix_before_launch": ["...", "..."]
  },
  "product_assessment": {
    "score": 1,
    "summary": "texto",
    "top_user_risks": ["...", "..."]
  },
  "operations_assessment": {
    "score": 1,
    "summary": "texto",
    "top_operational_risks": ["...", "..."]
  },
  "top_5_actions_before_public_launch": [
    {
      "priority": 1,
      "action": "texto",
      "owner": "product" | "frontend" | "backend" | "infra" | "qa"
    }
  ]
}

Reglas:
- Sé específico.
- Si hay fallas de tests, trátalas como señal real de riesgo, no como ruido.
- Diferencia claramente entre bloqueadores críticos y riesgos importantes.
- No des más de 5 acciones finales.
- Responde solo con JSON válido.`;

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
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "Responde solo con JSON válido." },
        { role: "user", content: prompt },
      ],
    }),
  });

  const data = await response.json();
  if (!response.ok) return { error: data?.error?.message ?? `HTTP ${response.status}` };
  return JSON.parse(data?.choices?.[0]?.message?.content ?? "{}");
}

async function callGemini() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { error: "GEMINI_API_KEY no disponible" };

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        generationConfig: {
          temperature: 0.1,
          responseMimeType: "application/json",
        },
        contents: [{ parts: [{ text: prompt }] }],
      }),
    }
  );

  const data = await response.json();
  if (!response.ok) return { error: data?.error?.message ?? `HTTP ${response.status}` };
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
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "Responde solo con JSON válido." },
        { role: "user", content: prompt },
      ],
    }),
  });

  const data = await response.json();
  if (!response.ok) return { error: data?.error?.message ?? `HTTP ${response.status}` };
  return JSON.parse(data?.choices?.[0]?.message?.content ?? "{}");
}

function buildConsensus(results) {
  const valid = Object.entries(results).filter(([, value]) => !value?.error);
  const verdictCounts = new Map();

  for (const [, value] of valid) {
    const verdict = value.launch_verdict ?? "error";
    verdictCounts.set(verdict, (verdictCounts.get(verdict) ?? 0) + 1);
  }

  const consensusVerdict = [...verdictCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "error";

  return {
    consensus_verdict: consensusVerdict,
    model_verdicts: Object.fromEntries(valid.map(([name, value]) => [name, value.launch_verdict])),
    executive_summaries: valid.map(([name, value]) => ({ model: name, summary: value.executive_summary })),
    top_actions: valid.flatMap(([name, value]) => (value.top_5_actions_before_public_launch ?? []).map((item) => ({ model: name, ...item }))),
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
    2
  ),
  "utf8"
);

console.log(JSON.stringify({ outputPath, consensus }, null, 2));
