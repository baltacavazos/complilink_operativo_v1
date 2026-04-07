import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const outputDir = "/home/ubuntu/complilink_operativo_v1/research/helios_priority_round";

const systemPrompt = [
  "Eres un estratega senior de producto y UX para una plataforma legal-laboral llamada AuditaPatron.",
  "Tu trabajo es mejorar a Helios, el motor que interpreta documentos y guía a la persona usuaria dentro de /auditar.",
  "Debes proponer mejoras muy claras, muy útiles, mobile-first, sin jerga, y sin sobreprometer conclusiones jurídicas definitivas.",
  "Responde SOLO con un objeto JSON válido, sin markdown, sin comentarios y sin texto adicional.",
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

function extractJson(text) {
  const cleaned = text.trim().replace(/^```json\s*/i, "").replace(/^```/, "").replace(/```$/, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {}

  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) {
    const sliced = cleaned.slice(start, end + 1);
    return JSON.parse(sliced);
  }

  throw new Error("No se pudo extraer JSON válido de la respuesta de Grok.");
}

async function main() {
  await mkdir(outputDir, { recursive: true });

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
      temperature: 0.2,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  });

  const raw = await response.text();
  await writeFile(path.join(outputDir, "grok_retry_http_raw.txt"), raw + "\n", "utf8");

  if (!response.ok) {
    throw new Error(`Grok devolvió ${response.status}: ${raw}`);
  }

  const json = JSON.parse(raw);
  const content = json?.choices?.[0]?.message?.content ?? "";
  await writeFile(path.join(outputDir, "grok_retry_content.txt"), String(content) + "\n", "utf8");

  const parsed = extractJson(String(content));
  await writeFile(path.join(outputDir, "grok.json"), JSON.stringify(parsed, null, 2) + "\n", "utf8");
  await writeFile(path.join(outputDir, "grok_raw.json"), JSON.stringify(json, null, 2) + "\n", "utf8");

  console.log(JSON.stringify({ grok: "ok" }, null, 2));
}

main().catch(async (error) => {
  await mkdir(outputDir, { recursive: true });
  await writeFile(
    path.join(outputDir, "grok_error.json"),
    JSON.stringify({ error: error instanceof Error ? error.message : String(error) }, null, 2) + "\n",
    "utf8",
  );
  console.error(error);
  process.exit(1);
});
