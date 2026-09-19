export const FASE_0_BRIDGE_ENV = {
  requiredForRemoteWebhook: ["AUDITAPATRON_ENGINE_WEBHOOK_URL", "AUDITAPATRON_ENGINE_HMAC_SECRET"] as const,
  requiredForExtraction: ["OPENAI_API_KEY", "GEMINI_API_KEY"] as const,
  notRequiredForBridge: ["API_KEY_HELIOS"] as const,
};

function present(value?: string | null) {
  return typeof value === "string" && value.trim().length > 0;
}

export function inspectAuditaPatronBridgeInventory(env: NodeJS.ProcessEnv = process.env) {
  const webhookUrl = present(env.AUDITAPATRON_ENGINE_WEBHOOK_URL);
  const hmacSecret = present(env.AUDITAPATRON_ENGINE_HMAC_SECRET);
  const openaiApiKey = present(env.OPENAI_API_KEY);
  const geminiApiKey = present(env.GEMINI_API_KEY);
  const heliosApiKey = present(env.API_KEY_HELIOS);

  const webhookComplete = webhookUrl && hmacSecret;
  const extractionComplete = openaiApiKey && geminiApiKey;

  return {
    phase: "fase_0" as const,
    mode: webhookUrl ? ("remote" as const) : ("mock" as const),
    webhookComplete,
    remoteBridgeReady: webhookComplete,
    extractionComplete,
    heliosApiKeyRequired: false,
    heliosApiKeyPresent: heliosApiKey,
    vars: {
      AUDITAPATRON_ENGINE_WEBHOOK_URL: webhookUrl,
      AUDITAPATRON_ENGINE_HMAC_SECRET: hmacSecret,
      OPENAI_API_KEY: openaiApiKey,
      GEMINI_API_KEY: geminiApiKey,
      API_KEY_HELIOS: heliosApiKey,
    },
    notes: [
      "El modo remoto se activa solo con AUDITAPATRON_ENGINE_WEBHOOK_URL.",
      "La firma HMAC exige AUDITAPATRON_ENGINE_HMAC_SECRET.",
      "OPENAI_API_KEY y GEMINI_API_KEY sirven a la extracción y, si no hay cerebro remoto, a una narrativa local breve del recibo o CFDI.",
      "API_KEY_HELIOS no forma parte del puente y no se usa para decidir mock vs remoto.",
      "Sin URL de webhook el sistema usa plantilla local mock, no el cerebro en vivo.",
    ],
  };
}
