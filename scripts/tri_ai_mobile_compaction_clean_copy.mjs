import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const homePath = resolve(process.cwd(), "client/src/pages/Home.tsx");
const homeSource = readFileSync(homePath, "utf8");

const targetHint = "La persona debe entender rápido qué hace la herramienta, cómo la protege y por qué sí vale la pena seguir reuniendo documentos útiles para su respaldo.";

function sliceAround(text, needle, radius = 900) {
  const idx = text.indexOf(needle);
  if (idx === -1) return "NO_ENCONTRADO";
  const start = Math.max(0, idx - radius);
  const end = Math.min(text.length, idx + needle.length + radius);
  return text.slice(start, end);
}

function buildPrompt() {
  const excerpt = sliceAround(homeSource, targetHint, 1200);

  return `
Eres un especialista senior en UX writing, mobile-first landing pages y conversión ética para trabajadores en México.

Estoy afinando la página principal de Auditapatron, una herramienta que ayuda a trabajadores a entender sus documentos laborales, fortalecer su expediente y proteger sus derechos laborales. La página ya mejoró bastante, pero detectamos dos problemas críticos:

1. En celular sigue siendo demasiado larga y exige demasiado scroll para entender lo importante.
2. Hay textos visibles que suenan a instrucciones internas de diseño en vez de mensajes reales para usuarios.

Quiero que evalúes la página con enfoque estricto en móvil y me ayudes a definir una versión más corta, más clara y más humana.

Necesito que respondas SOLO en JSON válido con esta estructura exacta:
{
  "modelo": "nombre del modelo",
  "que_esta_bien": ["3 a 5 hallazgos breves"],
  "que_esta_mal": ["3 a 7 hallazgos breves"],
  "textos_internos_o_problematicos": [
    {
      "texto": "texto detectado o aproximado",
      "problema": "por qué suena interno, técnico o largo",
      "reemplazo_sugerido": "versión corta y humana"
    }
  ],
  "recorte_mobile_prioritario": ["5 acciones concretas para reducir scroll sin perder claridad"],
  "hero_recomendado": {
    "headline": "máximo 8 palabras",
    "subheadline": "máximo 18 palabras",
    "cta": "máximo 4 palabras"
  },
  "estructura_ideal_mobile": ["lista ordenada de 4 a 6 bloques en el orden exacto recomendado"],
  "secciones_a_eliminar_o_fusionar": ["bloques que sobran, deben resumirse o fusionarse"],
  "veredicto_final": "resumen muy breve de la mejor dirección"
}

Reglas:
- Prioriza claridad emocional y lectura rápida en móvil.
- No uses lenguaje técnico ni legalista.
- No propongas una página larga.
- Si ves textos que parecen notas internas o instrucciones para el equipo, señálalos.
- El mensaje debe hacer sentir a la persona trabajadora que entiende mejor su situación y que subir documentos sí vale la pena.

Contexto visible relevante de la página:
---INICIO_EXTRACTO---
${excerpt}
---FIN_EXTRACTO---
`;
}

async function callOpenAI(prompt) {
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
      temperature: 0.4,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "Responde solo con JSON válido." },
        { role: "user", content: prompt },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI error ${response.status}: ${await response.text()}`);
  }

  const data = await response.json();
  return JSON.parse(data.choices[0].message.content);
}

async function callGemini(prompt) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY no está disponible");

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.4,
        responseMimeType: "application/json",
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Gemini error ${response.status}: ${await response.text()}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini no devolvió contenido");
  return JSON.parse(text);
}

async function callGrok(prompt) {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) throw new Error("XAI_API_KEY no está disponible");

  const response = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "grok-4-0709",
      temperature: 0.4,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "Responde solo con JSON válido." },
        { role: "user", content: prompt },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`Grok error ${response.status}: ${await response.text()}`);
  }

  const data = await response.json();
  return JSON.parse(data.choices[0].message.content);
}

async function main() {
  const prompt = buildPrompt();
  const results = {};

  const tasks = [
    ["chatgpt", () => callOpenAI(prompt)],
    ["gemini", () => callGemini(prompt)],
    ["grok", () => callGrok(prompt)],
  ];

  for (const [key, fn] of tasks) {
    try {
      results[key] = await fn();
    } catch (error) {
      results[key] = {
        modelo: key,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  const output = {
    generatedAt: new Date().toISOString(),
    target: "Auditapatron mobile compaction and clean copy consensus",
    sourceFile: homePath,
    detectedHint: targetHint,
    results,
  };

  writeFileSync(
    resolve(process.cwd(), "tri_ai_mobile_compaction_clean_copy_output.json"),
    JSON.stringify(output, null, 2),
    "utf8",
  );

  console.log("OK tri_ai_mobile_compaction_clean_copy_output.json");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
