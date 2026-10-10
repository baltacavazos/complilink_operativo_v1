import { afterEach, describe, expect, it, vi } from "vitest";

import {
  GEMINI_FALLBACK_MODELS,
  GEMINI_FLAGSHIP_MODEL,
  invokeLLM,
  isOpenAiModelUnavailableError,
  mapResponsesApiToInvokeResult,
  messagesIncludeImage,
  toResponsesInput,
  OPENAI_FALLBACK_MODELS,
  OPENAI_FLAGSHIP_MODEL,
  OPENAI_REASONING_EFFORT,
  OPENAI_RESPONSES_URL,
  resolveGeminiModelChain,
  resolveLlmTransport,
  resolveOpenAiModelChain,
  resolveOpenAiPrimaryModel,
} from "./llm";

const KEYS = [
  "OPENAI_API_KEY",
  "OPENAI_CHAT_MODEL",
  "GEMINI_API_KEY",
  "GEMINI_CHAT_MODEL",
  "BUILT_IN_FORGE_API_KEY",
  "BUILT_IN_FORGE_API_URL",
] as const;

function withEnv(values: Partial<Record<(typeof KEYS)[number], string>>) {
  const previous = Object.fromEntries(KEYS.map((key) => [key, process.env[key]]));
  for (const key of KEYS) {
    const next = values[key];
    if (next === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = next;
    }
  }
  return () => {
    for (const key of KEYS) {
      const value = previous[key];
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  };
}

function jsonResponse(body: unknown, status = 200, statusText = "OK") {
  return new Response(JSON.stringify(body), {
    status,
    statusText,
    headers: { "content-type": "application/json" },
  });
}

function errorResponse(status: number, body: string, statusText = "Error") {
  return new Response(body, {
    status,
    statusText,
    headers: { "content-type": "application/json" },
  });
}

describe("resolveLlmTransport", () => {
  afterEach(() => {
    withEnv({})();
  });

  it("prefiere OPENAI_API_KEY sobre Forge y usa gpt-6-astra por Responses API", () => {
    const restore = withEnv({
      OPENAI_API_KEY: "sk-test",
      GEMINI_API_KEY: "gemini-test",
      BUILT_IN_FORGE_API_KEY: "forge-test",
    });
    try {
      const transport = resolveLlmTransport({
        OPENAI_API_KEY: "sk-test",
        GEMINI_API_KEY: "gemini-test",
        BUILT_IN_FORGE_API_KEY: "forge-test",
      });
      expect(transport?.provider).toBe("openai");
      expect(transport?.url).toBe(OPENAI_RESPONSES_URL);
      expect(transport?.model).toBe("gpt-6-astra");
      expect(transport?.models).toEqual(["gpt-6-astra", "gpt-5.6-sol", "gpt-5.6-terra"]);
      expect(transport?.extraPayload).toMatchObject({ reasoning: { effort: "max" } });
      expect(transport?.model).not.toMatch(/mini/i);
      expect(JSON.stringify(transport)).not.toMatch(/forge-test/);
      expect(JSON.stringify(transport)).not.toMatch(/gpt-4o-mini/);
    } finally {
      restore();
    }
  });

  it("no deja que OPENAI_CHAT_MODEL baje de Astra a un modelo más débil", () => {
    const transport = resolveLlmTransport({
      OPENAI_API_KEY: "sk-test",
      OPENAI_CHAT_MODEL: "gpt-5.6-sol",
    });
    expect(transport?.model).toBe("gpt-6-astra");
    expect(transport?.models?.[0]).toBe("gpt-6-astra");
    expect(transport?.models).toEqual(["gpt-6-astra", "gpt-5.6-sol", "gpt-5.6-terra"]);
  });

  it("ignora un override mini y se queda en gpt-6-astra", () => {
    expect(resolveOpenAiPrimaryModel({ OPENAI_CHAT_MODEL: "gpt-4o-mini" })).toBe("gpt-6-astra");
    expect(resolveOpenAiModelChain({ OPENAI_CHAT_MODEL: "gpt-4o-mini" })[0]).toBe("gpt-6-astra");
    expect(resolveOpenAiModelChain({ OPENAI_CHAT_MODEL: "gpt-4o-mini" }).join(" ")).not.toMatch(/mini/i);
  });

  it("normaliza el alias gpt-5.6 pero Astra sigue primero", () => {
    expect(resolveOpenAiPrimaryModel({ OPENAI_CHAT_MODEL: "gpt-5.6" })).toBe("gpt-6-astra");
    expect(resolveOpenAiModelChain({ OPENAI_CHAT_MODEL: "gpt-5.6" })).toEqual([
      "gpt-6-astra",
      "gpt-5.6-sol",
      "gpt-5.6-terra",
    ]);
  });

  it("usa GEMINI_API_KEY si no hay OpenAI y elige Gemini 3.1 Pro, no flash/lite", () => {
    const transport = resolveLlmTransport({
      GEMINI_API_KEY: "gemini-test",
      BUILT_IN_FORGE_API_KEY: "forge-test",
    });
    expect(transport?.provider).toBe("gemini");
    expect(transport?.url).toContain("generativelanguage.googleapis.com");
    expect(transport?.model).toBe("gemini-3.1-pro-preview");
    expect(transport?.models).toEqual(["gemini-3.1-pro-preview", "gemini-2.5-pro"]);
    expect(transport?.model).not.toMatch(/flash|lite/i);
  });

  it("ignora GEMINI_CHAT_MODEL flash/lite", () => {
    const transport = resolveLlmTransport({
      GEMINI_API_KEY: "gemini-test",
      GEMINI_CHAT_MODEL: "gemini-2.0-flash",
    });
    expect(transport?.model).toBe("gemini-3.1-pro-preview");
  });

  it("cae a Forge solo si no hay OPENAI ni GEMINI", () => {
    const transport = resolveLlmTransport({
      BUILT_IN_FORGE_API_KEY: "forge-test",
      BUILT_IN_FORGE_API_URL: "https://forge.example",
    });
    expect(transport?.provider).toBe("forge");
    expect(transport?.url).toBe("https://forge.example/v1/chat/completions");
  });

  it("devuelve null y no inventa secretos si no hay llaves", () => {
    expect(resolveLlmTransport({})).toBeNull();
  });
});

describe("OpenAI flagship y fallbacks", () => {
  it("declara Astra como flagship y nunca un mini", () => {
    expect(OPENAI_FLAGSHIP_MODEL).toBe("gpt-6-astra");
    expect(OPENAI_FALLBACK_MODELS).toEqual(["gpt-5.6-sol", "gpt-5.6-terra"]);
    expect(resolveOpenAiModelChain({})).toEqual([
      "gpt-6-astra",
      "gpt-5.6-sol",
      "gpt-5.6-terra",
    ]);
    expect(resolveOpenAiModelChain({}).join(" ")).not.toMatch(/mini/i);
    expect(OPENAI_REASONING_EFFORT).toBe("max");
    expect(GEMINI_FLAGSHIP_MODEL).toBe("gemini-3.1-pro-preview");
    expect(GEMINI_FALLBACK_MODELS).toEqual(["gemini-2.5-pro"]);
    expect(resolveGeminiModelChain({})).toEqual(["gemini-3.1-pro-preview", "gemini-2.5-pro"]);
    expect(resolveGeminiModelChain({}).join(" ")).not.toMatch(/flash|lite/i);
  });

  it("reconoce 404, 403 y model_not_found como Astra no habilitado", () => {
    expect(isOpenAiModelUnavailableError(404, "missing")).toBe(true);
    expect(isOpenAiModelUnavailableError(403, "forbidden")).toBe(true);
    expect(
      isOpenAiModelUnavailableError(
        400,
        JSON.stringify({ error: { code: "model_not_found", message: "does not exist" } }),
      ),
    ).toBe(true);
    expect(isOpenAiModelUnavailableError(500, "internal")).toBe(false);
    expect(isOpenAiModelUnavailableError(429, "rate limit")).toBe(false);
  });
});

describe("mapResponsesApiToInvokeResult", () => {
  it("mapea output_text al shape InvokeResult que ya leen los callers", () => {
    const result = mapResponsesApiToInvokeResult(
      {
        id: "resp_1",
        created_at: 1_700_000_000,
        model: "gpt-6-astra",
        output_text: "Siguiente paso: compara el recibo con el CFDI.",
        usage: { input_tokens: 12, output_tokens: 8, total_tokens: 20 },
      },
      "gpt-6-astra",
    );

    expect(result).toMatchObject({
      id: "resp_1",
      created: 1_700_000_000,
      model: "gpt-6-astra",
      choices: [
        {
          index: 0,
          message: {
            role: "assistant",
            content: "Siguiente paso: compara el recibo con el CFDI.",
          },
          finish_reason: "stop",
        },
      ],
      usage: {
        prompt_tokens: 12,
        completion_tokens: 8,
        total_tokens: 20,
      },
    });
  });

  it("extrae texto y tool calls desde output[] si no hay output_text", () => {
    const result = mapResponsesApiToInvokeResult(
      {
        id: "resp_2",
        model: "gpt-6-astra",
        output: [
          { type: "reasoning", summary: [] },
          {
            type: "message",
            role: "assistant",
            content: [{ type: "output_text", text: "Listo." }],
          },
          {
            type: "function_call",
            call_id: "call_1",
            name: "lookup_imss",
            arguments: "{\"nss\":\"1\"}",
          },
        ],
      },
      "gpt-6-astra",
    );

    expect(result.choices[0]?.message.content).toBe("Listo.");
    expect(result.choices[0]?.message.tool_calls).toEqual([
      {
        id: "call_1",
        type: "function",
        function: { name: "lookup_imss", arguments: "{\"nss\":\"1\"}" },
      },
    ]);
  });
});

describe("invokeLLM OpenAI Responses", () => {
  afterEach(() => {
    withEnv({})();
  });

  it("llama Responses API con gpt-6-astra y no se queda en gpt-4o-mini", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({
        id: "resp_ok",
        model: "gpt-6-astra",
        output_text: "Confirmado: revisa el NSS visible.",
      }),
    );

    const result = await invokeLLM(
      {
        messages: [
          { role: "system", content: "Eres el asesor laboral." },
          { role: "user", content: "¿Qué hago con este recibo?" },
        ],
      },
      {
        env: { OPENAI_API_KEY: "sk-test" },
        fetchImpl: fetchImpl as unknown as typeof fetch,
      },
    );

    expect(result.choices[0]?.message.content).toBe("Confirmado: revisa el NSS visible.");
    expect(result.model).toBe("gpt-6-astra");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(String(fetchImpl.mock.calls[0]?.[0])).toBe(OPENAI_RESPONSES_URL);
    const body = JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body));
    expect(body.model).toBe("gpt-6-astra");
    expect(body.model).not.toMatch(/mini/i);
    expect(body.instructions).toContain("asesor laboral");
    expect(body.input).toBeTruthy();
    expect(body.max_output_tokens).toBe(32768);
    expect(body.temperature).toBeUndefined();
    expect(body.reasoning).toEqual({ effort: "max" });
  });

  it("cae a gpt-5.6-sol si Astra responde 404/model_not_found", async () => {
    const fetchImpl = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      if (body.model === "gpt-6-astra") {
        return errorResponse(
          404,
          JSON.stringify({ error: { code: "model_not_found", message: "does not exist" } }),
          "Not Found",
        );
      }
      return jsonResponse({
        id: "resp_sol",
        model: "gpt-5.6-sol",
        output_text: "Respuesta Sol",
      });
    });

    const result = await invokeLLM(
      { messages: [{ role: "user", content: "hola" }] },
      {
        env: { OPENAI_API_KEY: "sk-test" },
        fetchImpl: fetchImpl as unknown as typeof fetch,
      },
    );

    expect(result.model).toBe("gpt-5.6-sol");
    expect(result.choices[0]?.message.content).toBe("Respuesta Sol");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    const models = fetchImpl.mock.calls.map((call) => JSON.parse(String(call[1]?.body)).model);
    expect(models).toEqual(["gpt-6-astra", "gpt-5.6-sol"]);
    expect(models.join(" ")).not.toMatch(/gpt-4o-mini/);
  });

  it("cae a gpt-5.6-terra si Astra y Sol no están habilitados", async () => {
    const fetchImpl = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      if (body.model === "gpt-6-astra") {
        return errorResponse(403, "model not enabled", "Forbidden");
      }
      if (body.model === "gpt-5.6-sol") {
        return errorResponse(404, "model_not_found", "Not Found");
      }
      return jsonResponse({
        id: "resp_terra",
        model: "gpt-5.6-terra",
        output_text: "Respuesta Terra",
      });
    });

    const result = await invokeLLM(
      { messages: [{ role: "user", content: "hola" }] },
      {
        env: { OPENAI_API_KEY: "sk-test" },
        fetchImpl: fetchImpl as unknown as typeof fetch,
      },
    );

    expect(result.model).toBe("gpt-5.6-terra");
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    const models = fetchImpl.mock.calls.map((call) => JSON.parse(String(call[1]?.body)).model);
    expect(models).toEqual(["gpt-6-astra", "gpt-5.6-sol", "gpt-5.6-terra"]);
  });

  it("no degrada a otro modelo si el error no es de disponibilidad", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchImpl = vi.fn(async () => errorResponse(500, "internal boom", "Server Error"));

    await expect(
      invokeLLM(
        { messages: [{ role: "user", content: "hola" }] },
        {
          env: { OPENAI_API_KEY: "sk-test" },
          fetchImpl: fetchImpl as unknown as typeof fetch,
        },
      ),
    ).rejects.toThrow(/internal boom/);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(errorSpy.mock.calls.some((call) => String(call[0]).includes("[invokeLLM] OpenAI falló"))).toBe(true);
    errorSpy.mockRestore();
  });

  it("manda la foto como data URL al modelo de visión", () => {
    const input = toResponsesInput([
      {
        role: "user",
        content: [
          { type: "text", text: "Lee este recibo." },
          { type: "image_url", image_url: { url: "data:image/jpeg;base64,QUJD", detail: "high" } },
        ],
      },
    ]);
    expect(messagesIncludeImage([{ role: "user", content: [{ type: "image_url", image_url: { url: "data:image/jpeg;base64,QUJD" } }] }])).toBe(true);
    expect(JSON.stringify(input)).toContain('"type":"input_image"');
    expect(JSON.stringify(input)).toContain("data:image/jpeg;base64,QUJD");
  });

  it("si OpenAI falla y hay Gemini, Gemini lee la foto sin mostrar el fallo", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchImpl = vi.fn(async (url: string | URL | Request) => {
      const target = String(url);
      if (target.includes("api.openai.com")) {
        return errorResponse(400, "could not download image", "Bad Request");
      }
      return jsonResponse({
        candidates: [{ content: { parts: [{ text: "{\"headline\":\"Pago visible\"}" }] } }],
      });
    });

    const result = await invokeLLM(
      {
        messages: [
          { role: "system", content: "Extrae solo lo visible." },
          {
            role: "user",
            content: [
              { type: "text", text: "Lee el recibo." },
              { type: "image_url", image_url: { url: "data:image/jpeg;base64,QUJD", detail: "high" } },
            ],
          },
        ],
      },
      {
        env: { OPENAI_API_KEY: "sk-test", GEMINI_API_KEY: "gemini-test" },
        fetchImpl: fetchImpl as unknown as typeof fetch,
      },
    );

    expect(result.choices[0]?.message.content).toContain("Pago visible");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    const geminiUrl = String(fetchImpl.mock.calls[1]?.[0]);
    expect(geminiUrl).toContain("generativelanguage.googleapis.com");
    expect(geminiUrl).toContain(":generateContent");
    expect(geminiUrl).not.toContain("sk-test");
    const body = JSON.parse(String(fetchImpl.mock.calls[1]?.[1]?.body));
    expect(body.contents[0].parts).toEqual(
      expect.arrayContaining([
        { text: "Lee el recibo." },
        { inlineData: { mimeType: "image/jpeg", data: "QUJD" } },
      ]),
    );
    expect(JSON.stringify(body)).not.toContain("detail");
    expect(errorSpy.mock.calls.some((call) => String(call[0]).includes("[invokeLLM] OpenAI falló; uso Gemini"))).toBe(true);
    errorSpy.mockRestore();
  });

  it("pide el esquema a Gemini y se queda con la respuesta, no con el pensamiento", async () => {
    const fetchImpl = vi.fn(async (url: string | URL | Request) => {
      const target = String(url);
      if (target.includes("api.openai.com")) {
        return errorResponse(401, "invalid api key", "Unauthorized");
      }
      return jsonResponse({
        candidates: [
          {
            content: {
              parts: [
                { thought: true, text: "voy a pensar sin entregar el json" },
                { text: "{\"payrollNetAmount\":\"$3,519.50\",\"payrollNss\":\"84129214965\"}" },
              ],
            },
          },
        ],
      });
    });

    const result = await invokeLLM(
      {
        messages: [
          { role: "system", content: "Extrae solo lo visible." },
          {
            role: "user",
            content: [
              { type: "text", text: "payrollNetAmount es el pago neto. payrollNss es el número de seguridad social." },
              { type: "image_url", image_url: { url: "data:image/jpeg;base64,QUJD", detail: "high" } },
            ],
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "auditar_structured_extraction",
            strict: true,
            schema: {
              type: "object",
              properties: {
                payrollNetAmount: { type: "string" },
              },
              required: ["payrollNetAmount"],
              additionalProperties: false,
            },
          },
        },
      },
      {
        env: { OPENAI_API_KEY: "sk-test", GEMINI_API_KEY: "gemini-test" },
        fetchImpl: fetchImpl as unknown as typeof fetch,
      },
    );

    expect(result.choices[0]?.message.content).toBe("{\"payrollNetAmount\":\"$3,519.50\",\"payrollNss\":\"84129214965\"}");
    expect(String(result.choices[0]?.message.content)).not.toContain("pensar");
    const body = JSON.parse(String(fetchImpl.mock.calls[1]?.[1]?.body));
    expect(body.generationConfig.responseMimeType).toBe("application/json");
    expect(body.generationConfig.responseSchema.type).toBe("OBJECT");
    expect(body.generationConfig.responseSchema.properties.payrollNetAmount.type).toBe("STRING");
    expect(body.generationConfig.responseSchema.additionalProperties).toBeUndefined();
    expect(body.contents[0].parts[0]).toEqual({ inlineData: { mimeType: "image/jpeg", data: "QUJD" } });
    expect(body.contents[0].parts.some((part: { text?: string }) => part.text?.includes("Extrae solo lo visible."))).toBe(true);
  });

  it("si Gemini no trae cifras, reintenta la foto en el otro formato y luego el otro camino", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchImpl = vi.fn(async (url: string | URL | Request) => {
      const target = String(url);
      if (target.includes("api.openai.com")) {
        return errorResponse(401, "invalid api key", "Unauthorized");
      }
      if (target.includes(":generateContent")) {
        return jsonResponse({
          candidates: [{ content: { parts: [{ text: "{\"headline\":\"sin datos\",\"fields\":[]}" }] } }],
        });
      }
      return jsonResponse({
        id: "chat_gemini",
        created: 1,
        model: "gemini-3.1-pro-preview",
        choices: [
          {
            index: 0,
            message: { role: "assistant", content: "{\"payrollNetAmount\":\"$3,519.50\"}" },
            finish_reason: "stop",
          },
        ],
      });
    });

    const result = await invokeLLM(
      {
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: "payrollNetAmount es el pago neto." },
              { type: "image_url", image_url: { url: "data:image/jpeg;base64,QUJD" } },
            ],
          },
        ],
      },
      {
        env: { OPENAI_API_KEY: "sk-test", GEMINI_API_KEY: "gemini-test" },
        fetchImpl: fetchImpl as unknown as typeof fetch,
      },
    );

    expect(result.choices[0]?.message.content).toContain("$3,519.50");
    const urls = fetchImpl.mock.calls.map((call) => String(call[0]));
    expect(urls.filter((url) => url.includes(":generateContent"))).toHaveLength(2);
    const secondBody = JSON.parse(String(fetchImpl.mock.calls[2]?.[1]?.body));
    expect(secondBody.contents[0].parts).toEqual(
      expect.arrayContaining([{ inline_data: { mime_type: "image/jpeg", data: "QUJD" } }]),
    );
    expect(urls.some((url) => url.includes("/openai/chat/completions"))).toBe(true);
    expect(errorSpy.mock.calls.some((call) => String(call[0]).includes("[invokeLLM] Gemini no devolvió cifras"))).toBe(true);
    errorSpy.mockRestore();
  });

  it("mantiene Gemini Pro en chat completions si no hay OpenAI", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({
        id: "chat_gemini",
        created: 1,
        model: "gemini-3.1-pro-preview",
        choices: [{ index: 0, message: { role: "assistant", content: "ok" }, finish_reason: "stop" }],
      }),
    );

    const result = await invokeLLM(
      { messages: [{ role: "user", content: "hola" }] },
      {
        env: { GEMINI_API_KEY: "gemini-test" },
        fetchImpl: fetchImpl as unknown as typeof fetch,
      },
    );

    expect(result.choices[0]?.message.content).toBe("ok");
    expect(String(fetchImpl.mock.calls[0]?.[0])).toContain("generativelanguage.googleapis.com");
    const body = JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body));
    expect(body.messages).toBeTruthy();
    expect(body.model).toBe("gemini-3.1-pro-preview");
    expect(body.model).not.toMatch(/flash|lite/i);
  });
});
