import fs from "node:fs/promises";
import path from "node:path";

const projectRoot = "/home/ubuntu/complilink_operativo_v1";
const outputPath = path.join(projectRoot, "tmp/tri_ai_post_v1_extra_round.json");

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
    if (!item) continue;
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
            "Eres un director de producto, UX writer y QA de front-end muy estricto. Proteges la lógica crítica ya estable, propones mejoras pequeñas y verificables, y respondes solo JSON válido.",
        },
        { role: "user", content: promptText },
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
            "Eres un evaluador de UX/UI, microcopy y pruebas de interfaz extremadamente exigente. Debes mantener la V1 estable y recomendar solo cambios ligeros, claros y fáciles de validar. Responde solo JSON válido.",
        },
        { role: "user", content: promptText },
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
      headers: { "Content-Type": "application/json" },
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
    access_votes: countVotes(valid.map((item) => item.parsed.access_top_change_id)),
    single_case_ui_votes: countVotes(valid.map((item) => item.parsed.single_case_ui_test_id)),
    home_mobile_votes: countVotes(valid.map((item) => item.parsed.home_mobile_top_change_id)),
    shared_non_negotiables: [...new Set(valid.flatMap((item) => item.parsed.non_negotiables || []))],
  };
}

async function main() {
  await fs.mkdir(path.dirname(outputPath), { recursive: true });

  const [accessSource, homeSource, auditarSource, uxCopyTest, homepageTest, auditarAlertsTest] = await Promise.all([
    fs.readFile(path.join(projectRoot, "client/src/pages/Access.tsx"), "utf8"),
    fs.readFile(path.join(projectRoot, "client/src/pages/Home.tsx"), "utf8"),
    fs.readFile(path.join(projectRoot, "client/src/pages/Auditar.tsx"), "utf8"),
    fs.readFile(path.join(projectRoot, "client/src/pages/ux.copy.test.ts"), "utf8"),
    fs.readFile(path.join(projectRoot, "server/auditapatron.homepage.test.ts"), "utf8"),
    fs.readFile(path.join(projectRoot, "client/src/pages/Auditar.alerts.test.ts"), "utf8"),
  ]);

  const accessSnippetStart = Math.max(0, accessSource.indexOf("Luego vuelves a") - 700);
  const accessSnippet = accessSource.slice(accessSnippetStart, accessSnippetStart + 2600);
  const homeSnippetStart = Math.max(0, homeSource.indexOf("Lo que hace simple esta experiencia") - 1100);
  const homeSnippet = homeSource.slice(homeSnippetStart, homeSnippetStart + 3400);
  const singleCaseSnippetStart = Math.max(0, auditarSource.indexOf("solo para una persona") - 1500);
  const singleCaseSnippet = auditarSource.slice(singleCaseSnippetStart, singleCaseSnippetStart + 3400);

  const promptText = `
Contexto: estamos en una micro-ronda post-V1 de AuditaPatron, ya estable y con checkpoint previo.

Objetivo de esta ronda:
1. Hacer más visual el destino de retorno en /acceso, sin romper el flujo OTP.
2. Reforzar la validación visible/técnica del bloqueo por expediente único cuando un documento parece pertenecer a otra persona.
3. Compactar también el segundo bloque móvil de Home para acelerar la lectura en celular.

Restricciones no negociables:
- No tocar lógica crítica de negocio.
- Debe mantenerse la regla 1 usuario normal = 1 expediente/persona.
- CEO conserva bypass total.
- No rediseñar la página completa.
- Cambios pequeños, seguros y fáciles de cubrir con pruebas.
- Deben sobrevivir las pruebas de copy existentes o ajustarse con mínimo cambio justificado.

Elige exactamente una recomendación principal para cada frente.

IDs permitidos para access_top_change_id:
- chip_retorno_visual
- tarjeta_retorno_con_icono
- label_mas_humano_sin_tarjeta
- reforzar_contexto_despues_de_entrar
- no_cambiar_mas

IDs permitidos para single_case_ui_test_id:
- extender_auditar_alerts_test
- agregar_expectativa_en_ux_copy
- agregar_test_helper_visible
- reforzar_caseworkflows_y_ui
- no_cambiar_mas

IDs permitidos para home_mobile_top_change_id:
- compactar_bloque_pasos
- compactar_tarjetas_simple_experiencia
- fusionar_microcopy_secundario
- reducir_margen_antes_de_ejemplo
- no_cambiar_mas

Responde SOLO JSON con esta estructura exacta:
{
  "overall_readiness": 0,
  "access_top_change_id": "",
  "access_recommendation": "",
  "single_case_ui_test_id": "",
  "single_case_ui_test_recommendation": "",
  "home_mobile_top_change_id": "",
  "home_mobile_recommendation": "",
  "non_negotiables": ["", ""],
  "do_not_touch": ["", ""],
  "one_sentence_plan": ""
}

Reglas:
- overall_readiness debe ser entero 1-10.
- Español claro, ejecutivo y accionable.
- No inventes IDs fuera de las listas.
- Si propones prueba UI, favorece el archivo ya existente más natural para ello.

Access.tsx (fragmento):
${accessSnippet}

Home.tsx (fragmento del segundo bloque móvil bajo el hero):
${homeSnippet}

Auditar.tsx (fragmento del bloqueo/alerta relevante):
${singleCaseSnippet}

client/src/pages/ux.copy.test.ts:
${uxCopyTest.slice(0, 9000)}

client/src/pages/Auditar.alerts.test.ts:
${auditarAlertsTest.slice(0, 11000)}

server/auditapatron.homepage.test.ts:
${homepageTest.slice(0, 7000)}
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
