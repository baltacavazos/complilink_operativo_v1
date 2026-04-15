import fs from "node:fs/promises";
import path from "node:path";

const projectRoot = "/home/ubuntu/complilink_operativo_v1";
const outputPath = path.join(projectRoot, "tmp/tri_ai_v1_light_polish_round.json");

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

async function callOpenAI(promptText) {
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
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "Eres un director de producto, UX writer y diseñador de interfaces muy estricto. Priorizas claridad, confianza, lenguaje humano y mínima fricción. Responde solo JSON válido.",
        },
        {
          role: "user",
          content: promptText,
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

async function callGrok(promptText) {
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
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "Eres un evaluador de UX/UI, microcopy y producto extremadamente exigente. Debes proteger la lógica crítica ya estable y proponer solo ajustes ligeros de claridad y confianza. Responde solo JSON válido.",
        },
        {
          role: "user",
          content: promptText,
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

async function callGemini(promptText) {
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
          temperature: 0.1,
          responseMimeType: "application/json",
        },
        contents: [
          {
            role: "user",
            parts: [{ text: promptText }],
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

function aggregate(results) {
  const valid = results.filter((item) => item.parsed && !item.error);
  return {
    model_count: valid.length,
    home_votes: countVotes(valid.map((item) => item.parsed.home_top_change_id).filter(Boolean)),
    access_votes: countVotes(valid.map((item) => item.parsed.access_top_change_id).filter(Boolean)),
    block_message_votes: countVotes(valid.map((item) => item.parsed.block_message_top_change_id).filter(Boolean)),
    shared_non_negotiables: [...new Set(valid.flatMap((item) => item.parsed.non_negotiables || []))],
  };
}

async function main() {
  await fs.mkdir(path.dirname(outputPath), { recursive: true });

  const [homeSource, accessSource, auditarSource, v1GuardSource, homepageTestSource] = await Promise.all([
    fs.readFile(path.join(projectRoot, "client/src/pages/Home.tsx"), "utf8"),
    fs.readFile(path.join(projectRoot, "client/src/pages/Access.tsx"), "utf8"),
    fs.readFile(path.join(projectRoot, "client/src/pages/Auditar.tsx"), "utf8").catch(() => ""),
    fs.readFile(path.join(projectRoot, "server/v1.release.scope.test.ts"), "utf8").catch(() => ""),
    fs.readFile(path.join(projectRoot, "server/auditapatron.homepage.test.ts"), "utf8").catch(() => ""),
  ]);

  const blockSnippetStart = Math.max(0, auditarSource.indexOf("solo para una persona") - 1400);
  const blockSnippet = blockSnippetStart >= 0 ? auditarSource.slice(blockSnippetStart, blockSnippetStart + 3200) : auditarSource.slice(0, 3200);

  const promptText = `
Contexto: estamos cerrando la V1 de AuditaPatron, una app web para expediente digital laboral.

Restricciones críticas no negociables:
- NO tocar la lógica de negocio ya estable.
- Debe mantenerse la regla 1 usuario normal = 1 expediente/persona.
- CEO conserva bypass total para pruebas.
- La navegación pública no debe volver a exponer la consola CEO.
- Solo se permiten ajustes ligeros de claridad visual, jerarquía y microcopy.
- Debemos minimizar cambios frágiles porque hay pruebas de copy.

Tu tarea:
1. Revisar Home, /acceso y el microcopy del mensaje cordial de bloqueo en /auditar.
2. Proponer únicamente ajustes ligeros, seguros y de alto valor.
3. Elegir exactamente un cambio principal para Home, uno para /acceso y uno para el mensaje cordial de bloqueo.
4. Decir qué NO tocarías para evitar romper la V1.

IDs permitidos para home_top_change_id:
- hero_mas_directo
- reducir_ruido_secundario
- reforzar_resultado_visible
- simplificar_cta_secundario
- mejorar_confianza_sin_alargar

IDs permitidos para access_top_change_id:
- aclarar_promesa_otp
- reforzar_retorno_auditar
- compactar_ayuda_secundaria
- hacer_estado_codigo_mas_calmo
- subir_confianza_sin_meter_ruido

IDs permitidos para block_message_top_change_id:
- mas_empatico_y_directo
- mas_claro_sobre_un_solo_expediente
- mas_orientado_a_solucion
- reducir_carga_legal
- separar_limite_y_siguiente_paso

Responde SOLO JSON con esta estructura exacta:
{
  "overall_readiness": 0,
  "home_top_change_id": "",
  "home_recommendation": "",
  "access_top_change_id": "",
  "access_recommendation": "",
  "block_message_top_change_id": "",
  "block_message_recommendation": "",
  "non_negotiables": ["", ""],
  "do_not_touch": ["", ""],
  "one_sentence_plan": ""
}

Reglas:
- overall_readiness debe ser entero 1-10.
- Español claro, ejecutivo y accionable.
- No propongas rediseño completo.
- No inventes IDs fuera de las listas.

Home.tsx:
${homeSource.slice(0, 18000)}

Access.tsx:
${accessSource.slice(0, 16000)}

Auditar.tsx (fragmento del bloqueo cordial):
${blockSnippet}

server/v1.release.scope.test.ts (guardrails de copy y flujo):
${v1GuardSource.slice(0, 10000)}

server/auditapatron.homepage.test.ts (guardrails de Home):
${homepageTestSource.slice(0, 12000)}
`.trim();

  const models = [
    { name: "chatgpt", fn: () => callOpenAI(promptText) },
    { name: "grok", fn: () => callGrok(promptText) },
    { name: "gemini", fn: () => callGemini(promptText) },
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
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify(fallback, null, 2));
  console.error(error);
  process.exit(1);
});
