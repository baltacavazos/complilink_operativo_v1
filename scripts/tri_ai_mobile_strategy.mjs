import fs from "node:fs/promises";
import path from "node:path";

const OUTPUT_PATH = path.resolve("/home/ubuntu/complilink_operativo_v1/tri_ai_mobile_strategy_output.json");

const OPTION_CODES = {
  must_keep: [
    "single_column_mobile",
    "sticky_primary_upload_cta",
    "status_first_header",
    "confirmed_vs_estimated_split",
    "next_document_recommendation",
    "passive_return_tracking",
    "large_tap_targets",
    "short_plain_language",
    "camera_scan_first",
    "bottom_sheet_actions",
    "timeline_history_last",
    "thumb_reach_priority",
  ],
  add_now: [
    "mobile_step_summary",
    "sticky_bottom_continue",
    "document_preview_compact",
    "accordion_history",
    "one_hand_navigation",
    "upload_source_sheet",
    "smart_empty_states",
    "progress_microstates",
    "safe_estimation_acknowledgement",
    "mobile_first_spacing_system",
    "native_tab_pattern_ready",
    "scan_or_photo_shortcut",
  ],
  avoid: [
    "dense_desktop_grid",
    "small_secondary_text",
    "long_explanatory_paragraphs",
    "competing_ctas",
    "technical_labels",
    "horizontal_scroll",
    "modal_overload",
    "hidden_status_changes",
    "top_only_actions",
    "multi_column_result_cards",
  ],
  screen_order: [
    "status_header",
    "next_best_document",
    "primary_upload_action",
    "latest_result_summary",
    "confirmed_data_block",
    "estimated_data_block",
    "return_tracking_block",
    "recommended_next_step",
    "history_block",
  ],
  shared_patterns: [
    "tokenized_spacing",
    "tokenized_colors",
    "state_driven_cards",
    "bottom_navigation_ready",
    "camera_upload_abstraction",
    "event_timeline_model",
    "result_confidence_model",
    "offline_friendly_copy",
    "optimistic_status_updates",
    "cross_platform_iconography",
  ],
  defer_for_native: [
    "push_notifications",
    "offline_file_queue",
    "biometric_unlock",
    "background_upload_resume",
    "native_document_scanner",
    "share_sheet_ingestion",
  ],
};

const SYSTEM_PROMPT = `Eres un experto en product design, UX móvil, mobile app strategy y sistemas documentales sensibles. Responde SOLO en JSON válido, sin markdown.`;

const USER_PROMPT = `Contexto del producto:
- Producto: Auditapatron.
- Pantalla central: /auditar.
- Caso de uso principal: personas suben documentos laborales y el sistema explica qué se confirmó, qué sigue siendo estimación y qué conviene hacer después.
- Ya existe una base con: estado del expediente, recomendación de siguiente documento, carga principal de archivo, resultado reciente, separación entre datos confirmados y estimados, y seguimiento pasivo de respuesta de CompliLink.
- Nueva prioridad estratégica: debe pensarse primero para móvil y además quedar bien preparada para una futura app en Android e iOS.
- Tono deseado: claro, protector, sereno, no técnico, confiable.

Tu trabajo es recomendar la mejor estrategia mobile-first y app-ready.

Devuelve un JSON con esta forma exacta:
{
  "core_direction": "string",
  "must_keep_codes": ["code"],
  "add_now_codes": ["code"],
  "avoid_codes": ["code"],
  "screen_order_codes": ["code"],
  "native_transition": {
    "shared_patterns": ["code"],
    "defer_for_native": ["code"]
  },
  "top_recommendations": [
    {
      "title": "string",
      "why": "string",
      "how_now": "string",
      "future_app_value": "string"
    }
  ],
  "microinteractions": [
    {
      "name": "string",
      "purpose": "string",
      "implementation_hint": "string"
    }
  ],
  "mobile_risks": [
    {
      "risk": "string",
      "mitigation": "string"
    }
  ],
  "confidence": "high|medium|low"
}

Reglas:
- Debes usar solo códigos de estas listas cuando llenes arrays de códigos.
- Debes priorizar claridad en pantallas pequeñas, uso con una mano, foco en la acción principal y futura portabilidad a app nativa.
- No propongas rediseños grandiosos; propone algo implementable ya en web responsive y útil luego para Android/iOS.
- Máximo 6 elementos por array de códigos.
- Máximo 4 top_recommendations.
- Máximo 3 microinteractions.
- Máximo 4 mobile_risks.

Listas de códigos permitidos:
${JSON.stringify(OPTION_CODES, null, 2)}`;

function extractJson(text) {
  if (!text) throw new Error("Respuesta vacía");
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {}

  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) {
    return JSON.parse(trimmed.slice(start, end + 1));
  }

  throw new Error("No se pudo parsear JSON");
}

function unique(arr) {
  return [...new Set((arr || []).filter(Boolean))];
}

function countCodes(items) {
  const map = new Map();
  for (const item of items) {
    map.set(item, (map.get(item) || 0) + 1);
  }
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([code, count]) => ({ code, count }));
}

function pickConsensus(items, minCount = 2, maxItems = 6) {
  return countCodes(items)
    .filter((entry) => entry.count >= minCount)
    .slice(0, maxItems);
}

function buildConsensus(results) {
  const valid = results.filter((item) => item.ok && item.data);

  const mustKeep = pickConsensus(valid.flatMap((item) => unique(item.data.must_keep_codes)));
  const addNow = pickConsensus(valid.flatMap((item) => unique(item.data.add_now_codes)));
  const avoid = pickConsensus(valid.flatMap((item) => unique(item.data.avoid_codes)));
  const screenOrder = pickConsensus(valid.flatMap((item) => unique(item.data.screen_order_codes)), 2, 9);
  const sharedPatterns = pickConsensus(valid.flatMap((item) => unique(item.data.native_transition?.shared_patterns)), 2);
  const deferForNative = pickConsensus(valid.flatMap((item) => unique(item.data.native_transition?.defer_for_native)), 2);

  return {
    provider_count: valid.length,
    consensus_strength: valid.length === 3 ? "triangulado" : "parcial",
    must_keep: mustKeep,
    add_now: addNow,
    avoid,
    screen_order: screenOrder,
    native_transition: {
      shared_patterns: sharedPatterns,
      defer_for_native: deferForNative,
    },
    representative_recommendations: valid.map((item) => ({
      provider: item.provider,
      core_direction: item.data.core_direction,
      top_recommendations: item.data.top_recommendations || [],
      microinteractions: item.data.microinteractions || [],
      mobile_risks: item.data.mobile_risks || [],
      confidence: item.data.confidence,
    })),
  };
}

async function callOpenAI() {
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY no disponible");

  const models = ["gpt-4.1-mini", "gpt-4o-mini"];
  let lastError;

  for (const model of models) {
    try {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model,
          temperature: 0.2,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: USER_PROMPT },
          ],
          response_format: { type: "json_object" },
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`OpenAI ${model} ${response.status}: ${text}`);
      }

      const json = await response.json();
      const text = json.choices?.[0]?.message?.content;
      return { model, data: extractJson(text) };
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError;
}

async function callGemini() {
  if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY no disponible");

  const model = "gemini-2.5-flash";
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: SYSTEM_PROMPT }],
      },
      contents: [
        {
          role: "user",
          parts: [{ text: USER_PROMPT }],
        },
      ],
      generationConfig: {
        temperature: 0.2,
        responseMimeType: "application/json",
      },
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Gemini ${response.status}: ${text}`);
  }

  const json = await response.json();
  const text = json.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("\n");
  return { model, data: extractJson(text) };
}

async function callXAI() {
  if (!process.env.XAI_API_KEY) throw new Error("XAI_API_KEY no disponible");

  const models = ["grok-4", "grok-3-mini", "grok-beta"];
  let lastError;

  for (const model of models) {
    try {
      const response = await fetch("https://api.x.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.XAI_API_KEY}`,
        },
        body: JSON.stringify({
          model,
          temperature: 0.2,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: USER_PROMPT },
          ],
          response_format: { type: "json_object" },
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`xAI ${model} ${response.status}: ${text}`);
      }

      const json = await response.json();
      const text = json.choices?.[0]?.message?.content;
      return { model, data: extractJson(text) };
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError;
}

async function main() {
  const startedAt = new Date().toISOString();

  const providers = [
    {
      provider: "chatgpt",
      run: callOpenAI,
    },
    {
      provider: "gemini",
      run: callGemini,
    },
    {
      provider: "grok",
      run: callXAI,
    },
  ];

  const results = [];

  for (const provider of providers) {
    try {
      const result = await provider.run();
      results.push({
        provider: provider.provider,
        ok: true,
        model: result.model,
        data: result.data,
      });
    } catch (error) {
      results.push({
        provider: provider.provider,
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const output = {
    startedAt,
    finishedAt: new Date().toISOString(),
    context: {
      product: "Auditapatron",
      focus: "mobile_first_and_app_ready_strategy",
      screen: "/auditar",
    },
    providers: results,
    consensus: buildConsensus(results),
  };

  await fs.writeFile(OUTPUT_PATH, `${JSON.stringify(output, null, 2)}\n`, "utf8");
  console.log(`Resultado guardado en ${OUTPUT_PATH}`);
}

main().catch(async (error) => {
  const failure = {
    startedAt: new Date().toISOString(),
    finishedAt: new Date().toISOString(),
    error: error instanceof Error ? error.message : String(error),
  };
  await fs.writeFile(OUTPUT_PATH, `${JSON.stringify(failure, null, 2)}\n`, "utf8");
  console.error(error);
  process.exit(1);
});
