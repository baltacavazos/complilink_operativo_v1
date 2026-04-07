import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const outputDir = "/home/ubuntu/complilink_operativo_v1/research/helios_priority_round";

const systemPrompt = [
  "Eres un estratega senior de producto y UX para una plataforma legal-laboral llamada AuditaPatron.",
  "Tu trabajo es mejorar a Helios, el motor que interpreta documentos y guía a la persona usuaria dentro de /auditar.",
  "Debes proponer mejoras muy claras, muy útiles, mobile-first, sin jerga, y sin sobreprometer conclusiones jurídicas definitivas.",
  "Responde SOLO JSON válido.",
].join(" ");

const userPrompt = `
Contexto actual del producto:
- AuditaPatron ayuda a trabajadores a subir documentos laborales y entender su expediente.
- Helios es el cerebro central: interpreta documentos, explica hallazgos en lenguaje simple y sugiere el siguiente paso útil.
- Ya existen en /auditar estas piezas visibles:
  1. una tarjeta de siguiente documento recomendado por Helios,
  2. una línea de tiempo del expediente,
  3. una versión expandible/colapsable de la línea de tiempo en móvil,
  4. mensajes más humanos en el bloque de seguimiento automático,
  5. recomendación del siguiente documento más personalizada según señales visibles del expediente.

Nueva prioridad:
- volver a Helios todavía más user friendly e inteligente;
- priorizar un bloque de comparación guiada entre documentos;
- mejorar la claridad de los hallazgos y las diferencias detectadas;
- hacer que el siguiente paso recomendado sea más accionable y útil;
- incentivar la carga de más documentos de forma ética, clara y no manipuladora.

Restricciones de implementación:
- Se busca una primera ronda de bajo riesgo y alto impacto.
- Idealmente debe poder implementarse con la data visible actual del expediente y la UI existente en /auditar.
- No inventes promesas jurídicas definitivas.
- El tono debe ser protector, humano, simple y orientado a trabajadores, no a expertos.
- Prioriza móvil y poco scroll.

Quiero que propongas la mejor siguiente ronda de mejoras para Helios.

Devuelve este JSON exacto:
{
  "product_principles": ["..."],
  "top_priorities": [
    {
      "name": "",
      "why_it_matters": "",
      "implementation_risk": "low|medium|high",
      "expected_user_value": ""
    }
  ],
  "document_comparison_block": {
    "recommended_name": "",
    "purpose": "",
    "minimum_viable_inputs": ["..."],
    "comparison_pairs": ["..."],
    "output_cards": ["..."],
    "sample_copy": {
      "headline": "",
      "summary": "",
      "key_change_label": "",
      "next_step": ""
    }
  },
  "friendlier_helios": {
    "microcopy_rules": ["..."],
    "states_to_add_or_refine": ["..."],
    "trust_guardrails": ["..."]
  },
  "implementation_order": ["..."],
  "do_not_do_yet": ["..."],
  "final_recommendation": ""
}
`;

async function saveJson(fileName, value) {
  const target = path.join(outputDir, fileName);
  await writeFile(target, JSON.stringify(value, null, 2) + "\n", "utf8");
}

async function callOpenAI() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY no está disponible en el entorno.");
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
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
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  });

  const json = await response.json();
  if (!response.ok) {
    throw new Error(`OpenAI devolvió ${response.status}: ${JSON.stringify(json)}`);
  }

  const content = json?.choices?.[0]?.message?.content;
  return {
    raw: json,
    parsed: typeof content === "string" ? JSON.parse(content) : content,
  };
}

async function callGemini() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY no está disponible en el entorno.");
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: systemPrompt }],
        },
        contents: [
          {
            role: "user",
            parts: [{ text: userPrompt }],
          },
        ],
        generationConfig: {
          temperature: 0.3,
          responseMimeType: "application/json",
        },
      }),
    },
  );

  const json = await response.json();
  if (!response.ok) {
    throw new Error(`Gemini devolvió ${response.status}: ${JSON.stringify(json)}`);
  }

  const text = json?.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("") || "";
  return {
    raw: json,
    parsed: JSON.parse(text),
  };
}

async function callGrok() {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) {
    throw new Error("XAI_API_KEY no está disponible en el entorno.");
  }

  const response = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "grok-4",
      temperature: 0.3,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  });

  const json = await response.json();
  if (!response.ok) {
    throw new Error(`Grok devolvió ${response.status}: ${JSON.stringify(json)}`);
  }

  const content = json?.choices?.[0]?.message?.content;
  return {
    raw: json,
    parsed: typeof content === "string" ? JSON.parse(content) : content,
  };
}

async function main() {
  await mkdir(outputDir, { recursive: true });

  await saveJson("meta.json", {
    createdAt: new Date().toISOString(),
    purpose: "Consulta multi-IA para priorizar la siguiente ronda de mejoras de Helios en /auditar.",
    models: {
      openai: "gpt-4.1-mini",
      gemini: "gemini-2.5-flash",
      grok: "grok-4",
    },
  });

  const [openai, gemini, grok] = await Promise.allSettled([
    callOpenAI(),
    callGemini(),
    callGrok(),
  ]);

  const results = {
    openai,
    gemini,
    grok,
  };

  for (const [provider, result] of Object.entries(results)) {
    if (result.status === "fulfilled") {
      await saveJson(`${provider}.json`, result.value.parsed);
      await saveJson(`${provider}_raw.json`, result.value.raw);
    } else {
      await saveJson(`${provider}_error.json`, {
        error: result.reason instanceof Error ? result.reason.message : String(result.reason),
      });
    }
  }

  const summary = Object.fromEntries(
    Object.entries(results).map(([provider, result]) => [
      provider,
      result.status === "fulfilled" ? "ok" : "error",
    ]),
  );

  await saveJson("status.json", summary);
  console.log(JSON.stringify(summary, null, 2));
}

main().catch(async (error) => {
  await mkdir(outputDir, { recursive: true });
  await saveJson("fatal_error.json", {
    error: error instanceof Error ? error.message : String(error),
  });
  console.error(error);
  process.exit(1);
});
