export type Role = "system" | "user" | "assistant" | "tool" | "function";

export type TextContent = {
  type: "text";
  text: string;
};

export type ImageContent = {
  type: "image_url";
  image_url: {
    url: string;
    detail?: "auto" | "low" | "high";
  };
};

export type FileContent = {
  type: "file_url";
  file_url: {
    url: string;
    mime_type?: "audio/mpeg" | "audio/wav" | "application/pdf" | "audio/mp4" | "video/mp4" ;
  };
};

export type MessageContent = string | TextContent | ImageContent | FileContent;

export type Message = {
  role: Role;
  content: MessageContent | MessageContent[];
  name?: string;
  tool_call_id?: string;
};

export type Tool = {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  };
};

export type ToolChoicePrimitive = "none" | "auto" | "required";
export type ToolChoiceByName = { name: string };
export type ToolChoiceExplicit = {
  type: "function";
  function: {
    name: string;
  };
};

export type ToolChoice =
  | ToolChoicePrimitive
  | ToolChoiceByName
  | ToolChoiceExplicit;

export type InvokeParams = {
  messages: Message[];
  tools?: Tool[];
  toolChoice?: ToolChoice;
  tool_choice?: ToolChoice;
  maxTokens?: number;
  max_tokens?: number;
  outputSchema?: OutputSchema;
  output_schema?: OutputSchema;
  responseFormat?: ResponseFormat;
  response_format?: ResponseFormat;
};

export type ToolCall = {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
};

export type InvokeResult = {
  id: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: Role;
      content: string | Array<TextContent | ImageContent | FileContent>;
      tool_calls?: ToolCall[];
    };
    finish_reason: string | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
};

export type JsonSchema = {
  name: string;
  schema: Record<string, unknown>;
  strict?: boolean;
};

export type OutputSchema = JsonSchema;

export type ResponseFormat =
  | { type: "text" }
  | { type: "json_object" }
  | { type: "json_schema"; json_schema: JsonSchema };

const ensureArray = (
  value: MessageContent | MessageContent[]
): MessageContent[] => (Array.isArray(value) ? value : [value]);

const normalizeContentPart = (
  part: MessageContent
): TextContent | ImageContent | FileContent => {
  if (typeof part === "string") {
    return { type: "text", text: part };
  }

  if (part.type === "text") {
    return part;
  }

  if (part.type === "image_url") {
    return part;
  }

  if (part.type === "file_url") {
    return part;
  }

  throw new Error("Unsupported message content part");
};

const normalizeMessage = (message: Message) => {
  const { role, name, tool_call_id } = message;

  if (role === "tool" || role === "function") {
    const content = ensureArray(message.content)
      .map(part => (typeof part === "string" ? part : JSON.stringify(part)))
      .join("\n");

    return {
      role,
      name,
      tool_call_id,
      content,
    };
  }

  const contentParts = ensureArray(message.content).map(normalizeContentPart);

  // If there's only text content, collapse to a single string for compatibility
  if (contentParts.length === 1 && contentParts[0].type === "text") {
    return {
      role,
      name,
      content: contentParts[0].text,
    };
  }

  return {
    role,
    name,
    content: contentParts,
  };
};

const normalizeToolChoice = (
  toolChoice: ToolChoice | undefined,
  tools: Tool[] | undefined
): "none" | "auto" | ToolChoiceExplicit | undefined => {
  if (!toolChoice) return undefined;

  if (toolChoice === "none" || toolChoice === "auto") {
    return toolChoice;
  }

  if (toolChoice === "required") {
    if (!tools || tools.length === 0) {
      throw new Error(
        "tool_choice 'required' was provided but no tools were configured"
      );
    }

    if (tools.length > 1) {
      throw new Error(
        "tool_choice 'required' needs a single tool or specify the tool name explicitly"
      );
    }

    return {
      type: "function",
      function: { name: tools[0].function.name },
    };
  }

  if ("name" in toolChoice) {
    return {
      type: "function",
      function: { name: toolChoice.name },
    };
  }

  return toolChoice;
};

const resolveForgeApiUrl = (forgeApiUrl?: string) =>
  forgeApiUrl && forgeApiUrl.trim().length > 0
    ? `${forgeApiUrl.replace(/\/$/, "")}/v1/chat/completions`
    : "https://forge.manus.im/v1/chat/completions";

/**
 * REGLA PERMANENTE DEL DUEÑO (AuditaPatrón = CompliLink):
 * siempre los modelos más potentes. No se prioriza costo.
 * OpenAI hoy: gpt-6-astra. Nunca mini por defecto.
 * Gemini (secundario): Gemini 3.1 Pro. Nunca flash/lite por defecto.
 */
export const OPENAI_FLAGSHIP_MODEL = "gpt-6-astra";
export const OPENAI_FALLBACK_MODELS = ["gpt-5.6-sol", "gpt-5.6-terra"] as const;
export const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
export const GEMINI_FLAGSHIP_MODEL = "gemini-3.1-pro-preview";
export const GEMINI_FALLBACK_MODELS = ["gemini-2.5-pro"] as const;
export const GEMINI_OPENAI_COMPAT_URL =
  "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";

export type LlmTransport = {
  provider: "openai" | "gemini" | "forge";
  apiKey: string;
  url: string;
  model: string;
  models?: string[];
  extraPayload: Record<string, unknown>;
};

export type InvokeLlmOptions = {
  fetchImpl?: typeof fetch;
  env?: NodeJS.ProcessEnv;
};

export function normalizeOpenAiModelId(model: string): string {
  const trimmed = model.trim();
  if (trimmed === "gpt-5.6") return "gpt-5.6-sol";
  return trimmed;
}

export function resolveOpenAiPrimaryModel(env: NodeJS.ProcessEnv = process.env): string {
  const override = env.OPENAI_CHAT_MODEL?.trim();
  if (override) return normalizeOpenAiModelId(override);
  return OPENAI_FLAGSHIP_MODEL;
}

export function resolveOpenAiModelChain(env: NodeJS.ProcessEnv = process.env): string[] {
  const primary = resolveOpenAiPrimaryModel(env);
  const chain = [primary, ...OPENAI_FALLBACK_MODELS];
  return Array.from(new Set(chain.map(normalizeOpenAiModelId).filter(Boolean)));
}

export function resolveGeminiPrimaryModel(env: NodeJS.ProcessEnv = process.env): string {
  const override = env.GEMINI_CHAT_MODEL?.trim();
  if (override) return override;
  return GEMINI_FLAGSHIP_MODEL;
}

export function resolveGeminiModelChain(env: NodeJS.ProcessEnv = process.env): string[] {
  const primary = resolveGeminiPrimaryModel(env);
  const chain = [primary, ...GEMINI_FALLBACK_MODELS];
  return Array.from(new Set(chain.filter(Boolean)));
}

export function geminiGenerateContentUrl(model: string, apiKey: string): string {
  return `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
}

export function resolveLlmTransport(env: NodeJS.ProcessEnv = process.env): LlmTransport | null {
  const openai = env.OPENAI_API_KEY?.trim() ?? "";
  const gemini = env.GEMINI_API_KEY?.trim() ?? "";
  const forge = env.BUILT_IN_FORGE_API_KEY?.trim() ?? "";
  const forgeUrl = env.BUILT_IN_FORGE_API_URL?.trim() ?? "";

  if (openai) {
    const models = resolveOpenAiModelChain(env);
    return {
      provider: "openai",
      apiKey: openai,
      url: OPENAI_RESPONSES_URL,
      model: models[0] ?? OPENAI_FLAGSHIP_MODEL,
      models,
      extraPayload: {
        store: false,
        reasoning: { effort: "high" },
      },
    };
  }
  if (gemini) {
    const models = resolveGeminiModelChain(env);
    return {
      provider: "gemini",
      apiKey: gemini,
      url: GEMINI_OPENAI_COMPAT_URL,
      model: models[0] ?? GEMINI_FLAGSHIP_MODEL,
      models,
      extraPayload: {},
    };
  }
  if (forge) {
    return {
      provider: "forge",
      apiKey: forge,
      url: resolveForgeApiUrl(forgeUrl),
      model: "gemini-2.5-flash",
      extraPayload: { thinking: { budget_tokens: 128 } },
    };
  }
  return null;
}

const assertApiKey = (transport: LlmTransport | null): LlmTransport => {
  if (!transport) {
    console.error(
      "[invokeLLM] Falta una llave de modelo. Configura OPENAI_API_KEY o GEMINI_API_KEY en este servicio.",
    );
    throw new Error("No hay un modelo configurado para el asesor laboral.");
  }
  return transport;
};

const flattenMessageText = (content: MessageContent | MessageContent[]): string =>
  ensureArray(content)
    .map((part) => (typeof part === "string" ? part : part.type === "text" ? part.text : JSON.stringify(part)))
    .join("\n");

const toResponsesContent = (content: MessageContent | MessageContent[]): unknown => {
  const parts = ensureArray(content).map(normalizeContentPart);
  if (parts.length === 1 && parts[0].type === "text") {
    return parts[0].text;
  }
  return parts.map((part) => {
    if (part.type === "text") {
      return { type: "input_text", text: part.text };
    }
    if (part.type === "image_url") {
      return { type: "input_image", image_url: part.image_url.url };
    }
    return {
      type: "input_file",
      file_url: part.file_url.url,
      ...(part.file_url.mime_type ? { mime_type: part.file_url.mime_type } : {}),
    };
  });
};

export function toResponsesInput(messages: Message[]): {
  instructions?: string;
  input: unknown[];
} {
  const instructions: string[] = [];
  const input: unknown[] = [];

  for (const message of messages) {
    if (message.role === "system") {
      const text = flattenMessageText(message.content);
      if (text) instructions.push(text);
      continue;
    }

    if (message.role === "tool" || message.role === "function") {
      input.push({
        type: "function_call_output",
        call_id: message.tool_call_id || message.name || "",
        output: flattenMessageText(message.content),
      });
      continue;
    }

    input.push({
      role: message.role,
      content: toResponsesContent(message.content),
    });
  }

  if (input.length === 0) {
    input.push({
      role: "user",
      content: instructions.join("\n\n") || "Responde.",
    });
  }

  return {
    ...(instructions.length ? { instructions: instructions.join("\n\n") } : {}),
    input,
  };
}

const toResponsesTools = (tools: Tool[]): unknown[] =>
  tools.map((tool) => ({
    type: "function",
    name: tool.function.name,
    ...(tool.function.description ? { description: tool.function.description } : {}),
    ...(tool.function.parameters ? { parameters: tool.function.parameters } : {}),
  }));

const toResponsesToolChoice = (
  toolChoice: ReturnType<typeof normalizeToolChoice>,
): unknown => {
  if (!toolChoice) return undefined;
  if (toolChoice === "none" || toolChoice === "auto") return toolChoice;
  return {
    type: "function",
    name: toolChoice.function.name,
  };
};

const toResponsesTextFormat = (
  format: ReturnType<typeof normalizeResponseFormat>,
): Record<string, unknown> | undefined => {
  if (!format) return undefined;
  if (format.type === "text" || format.type === "json_object") {
    return { format: { type: format.type } };
  }
  return {
    format: {
      type: "json_schema",
      name: format.json_schema.name,
      schema: format.json_schema.schema,
      ...(typeof format.json_schema.strict === "boolean"
        ? { strict: format.json_schema.strict }
        : {}),
    },
  };
};

export function isOpenAiModelUnavailableError(status: number, body: string): boolean {
  if (status === 404 || status === 403) return true;
  const haystack = body.toLowerCase();
  return (
    haystack.includes("model_not_found") ||
    haystack.includes("does not exist") ||
    haystack.includes("not have access") ||
    haystack.includes("model not found")
  );
}

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const extractResponsesText = (payload: Record<string, unknown>): string => {
  if (typeof payload.output_text === "string" && payload.output_text.trim()) {
    return payload.output_text;
  }
  const texts: string[] = [];
  const output = Array.isArray(payload.output) ? payload.output : [];
  for (const item of output) {
    const rec = asRecord(item);
    if (!rec || rec.type !== "message") continue;
    const content = Array.isArray(rec.content) ? rec.content : [];
    for (const part of content) {
      const piece = asRecord(part);
      if (!piece) continue;
      if (
        (piece.type === "output_text" || piece.type === "text") &&
        typeof piece.text === "string"
      ) {
        texts.push(piece.text);
      }
    }
  }
  return texts.join("\n");
};

const extractResponsesToolCalls = (payload: Record<string, unknown>): ToolCall[] => {
  const output = Array.isArray(payload.output) ? payload.output : [];
  return output.flatMap((item) => {
    const rec = asRecord(item);
    if (!rec || rec.type !== "function_call") return [];
    return [
      {
        id: String(rec.call_id || rec.id || ""),
        type: "function" as const,
        function: {
          name: String(rec.name || ""),
          arguments: typeof rec.arguments === "string" ? rec.arguments : JSON.stringify(rec.arguments ?? {}),
        },
      },
    ];
  });
};

export function mapResponsesApiToInvokeResult(
  payload: unknown,
  fallbackModel: string,
): InvokeResult {
  const rec = asRecord(payload);
  if (!rec) {
    return {
      id: `resp-${Date.now()}`,
      created: Math.floor(Date.now() / 1000),
      model: fallbackModel,
      choices: [
        {
          index: 0,
          message: { role: "assistant", content: "" },
          finish_reason: "stop",
        },
      ],
    };
  }

  if (Array.isArray(rec.choices)) {
    return rec as unknown as InvokeResult;
  }

  const toolCalls = extractResponsesToolCalls(rec);
  const status = typeof rec.status === "string" ? rec.status : "";
  const finishReason =
    status === "incomplete" ? "length" : status === "failed" ? "error" : "stop";
  const usage = asRecord(rec.usage);

  return {
    id: typeof rec.id === "string" ? rec.id : `resp-${Date.now()}`,
    created:
      typeof rec.created_at === "number"
        ? rec.created_at
        : typeof rec.created === "number"
          ? rec.created
          : Math.floor(Date.now() / 1000),
    model: typeof rec.model === "string" ? rec.model : fallbackModel,
    choices: [
      {
        index: 0,
        message: {
          role: "assistant",
          content: extractResponsesText(rec),
          ...(toolCalls.length ? { tool_calls: toolCalls } : {}),
        },
        finish_reason: finishReason,
      },
    ],
    ...(usage
      ? {
          usage: {
            prompt_tokens: Number(usage.input_tokens ?? usage.prompt_tokens ?? 0),
            completion_tokens: Number(usage.output_tokens ?? usage.completion_tokens ?? 0),
            total_tokens: Number(usage.total_tokens ?? 0),
          },
        }
      : {}),
  };
}

const normalizeResponseFormat = ({
  responseFormat,
  response_format,
  outputSchema,
  output_schema,
}: {
  responseFormat?: ResponseFormat;
  response_format?: ResponseFormat;
  outputSchema?: OutputSchema;
  output_schema?: OutputSchema;
}):
  | { type: "json_schema"; json_schema: JsonSchema }
  | { type: "text" }
  | { type: "json_object" }
  | undefined => {
  const explicitFormat = responseFormat || response_format;
  if (explicitFormat) {
    if (
      explicitFormat.type === "json_schema" &&
      !explicitFormat.json_schema?.schema
    ) {
      throw new Error(
        "responseFormat json_schema requires a defined schema object"
      );
    }
    return explicitFormat;
  }

  const schema = outputSchema || output_schema;
  if (!schema) return undefined;

  if (!schema.name || !schema.schema) {
    throw new Error("outputSchema requires both name and schema");
  }

  return {
    type: "json_schema",
    json_schema: {
      name: schema.name,
      schema: schema.schema,
      ...(typeof schema.strict === "boolean" ? { strict: schema.strict } : {}),
    },
  };
};

const buildChatCompletionsPayload = (
  transport: LlmTransport,
  params: InvokeParams,
): Record<string, unknown> => {
  const {
    messages,
    tools,
    toolChoice,
    tool_choice,
    outputSchema,
    output_schema,
    responseFormat,
    response_format,
    maxTokens,
    max_tokens,
  } = params;

  const payload: Record<string, unknown> = {
    model: transport.model,
    messages: messages.map(normalizeMessage),
    ...transport.extraPayload,
    max_tokens: maxTokens ?? max_tokens ?? 32768,
  };

  if (tools && tools.length > 0) {
    payload.tools = tools;
  }

  const normalizedToolChoice = normalizeToolChoice(toolChoice || tool_choice, tools);
  if (normalizedToolChoice) {
    payload.tool_choice = normalizedToolChoice;
  }

  const normalizedResponseFormat = normalizeResponseFormat({
    responseFormat,
    response_format,
    outputSchema,
    output_schema,
  });
  if (normalizedResponseFormat) {
    payload.response_format = normalizedResponseFormat;
  }

  return payload;
};

const buildOpenAiResponsesPayload = (
  model: string,
  transport: LlmTransport,
  params: InvokeParams,
): Record<string, unknown> => {
  const {
    messages,
    tools,
    toolChoice,
    tool_choice,
    outputSchema,
    output_schema,
    responseFormat,
    response_format,
    maxTokens,
    max_tokens,
  } = params;

  const payload: Record<string, unknown> = {
    model,
    ...toResponsesInput(messages),
    ...transport.extraPayload,
    max_output_tokens: maxTokens ?? max_tokens ?? 32768,
  };

  if (tools && tools.length > 0) {
    payload.tools = toResponsesTools(tools);
  }

  const responsesToolChoice = toResponsesToolChoice(
    normalizeToolChoice(toolChoice || tool_choice, tools),
  );
  if (responsesToolChoice) {
    payload.tool_choice = responsesToolChoice;
  }

  const textFormat = toResponsesTextFormat(
    normalizeResponseFormat({
      responseFormat,
      response_format,
      outputSchema,
      output_schema,
    }),
  );
  if (textFormat) {
    payload.text = textFormat;
  }

  return payload;
};

async function invokeOpenAiResponses(
  transport: LlmTransport,
  params: InvokeParams,
  fetchImpl: typeof fetch,
): Promise<InvokeResult> {
  const models = transport.models?.length ? transport.models : [transport.model];
  let lastError: Error | null = null;

  for (let index = 0; index < models.length; index += 1) {
    const model = models[index];
    const response = await fetchImpl(transport.url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${transport.apiKey}`,
      },
      body: JSON.stringify(buildOpenAiResponsesPayload(model, transport, params)),
    });

    if (response.ok) {
      return mapResponsesApiToInvokeResult(await response.json(), model);
    }

    const errorText = await response.text();
    lastError = new Error(
      `LLM invoke failed: ${response.status} ${response.statusText} – ${errorText}`,
    );

    const canFallback =
      index < models.length - 1 &&
      isOpenAiModelUnavailableError(response.status, errorText);
    if (!canFallback) {
      throw lastError;
    }
  }

  throw lastError ?? new Error("LLM invoke failed: OpenAI no devolvió un modelo usable.");
}

async function invokeChatCompletions(
  transport: LlmTransport,
  params: InvokeParams,
  fetchImpl: typeof fetch,
): Promise<InvokeResult> {
  const models = transport.models?.length ? transport.models : [transport.model];
  let lastError: Error | null = null;

  for (let index = 0; index < models.length; index += 1) {
    const payload = {
      ...buildChatCompletionsPayload(transport, params),
      model: models[index],
    };
    const response = await fetchImpl(transport.url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${transport.apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      return (await response.json()) as InvokeResult;
    }

    const errorText = await response.text();
    lastError = new Error(
      `LLM invoke failed: ${response.status} ${response.statusText} – ${errorText}`,
    );

    const canFallback =
      index < models.length - 1 &&
      isOpenAiModelUnavailableError(response.status, errorText);
    if (!canFallback) {
      throw lastError;
    }
  }

  throw lastError ?? new Error("LLM invoke failed: no hay un modelo usable en este proveedor.");
}

export async function invokeLLM(
  params: InvokeParams,
  options: InvokeLlmOptions = {},
): Promise<InvokeResult> {
  const env = options.env ?? process.env;
  const fetchImpl = options.fetchImpl ?? fetch;
  const transport = assertApiKey(resolveLlmTransport(env));

  if (transport.provider === "openai") {
    return invokeOpenAiResponses(transport, params, fetchImpl);
  }

  return invokeChatCompletions(transport, params, fetchImpl);
}
