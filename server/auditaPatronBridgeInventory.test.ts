import { describe, expect, it } from "vitest";
import { inspectAuditaPatronBridgeInventory } from "./auditaPatronBridgeInventory";

describe("auditaPatronBridgeInventory Fase 0", () => {
  it("marca webhook completo solo con URL + HMAC, sin exigir API_KEY_HELIOS", () => {
    const inventory = inspectAuditaPatronBridgeInventory({
      AUDITAPATRON_ENGINE_WEBHOOK_URL: "https://engine.example/api/auditapatron/webhook",
      AUDITAPATRON_ENGINE_HMAC_SECRET: "bridge-secret",
      OPENAI_API_KEY: "openai-key",
      GEMINI_API_KEY: "gemini-key",
    });

    expect(inventory).toMatchObject({
      phase: "fase_0",
      mode: "remote",
      webhookComplete: true,
      extractionComplete: true,
      heliosApiKeyRequired: false,
      heliosApiKeyPresent: false,
      vars: {
        AUDITAPATRON_ENGINE_WEBHOOK_URL: true,
        AUDITAPATRON_ENGINE_HMAC_SECRET: true,
        OPENAI_API_KEY: true,
        GEMINI_API_KEY: true,
        API_KEY_HELIOS: false,
      },
    });
  });

  it("cae a mock si falta la URL aunque exista API_KEY_HELIOS", () => {
    const inventory = inspectAuditaPatronBridgeInventory({
      API_KEY_HELIOS: "should-not-switch-mode",
      AUDITAPATRON_ENGINE_HMAC_SECRET: "bridge-secret",
      OPENAI_API_KEY: "openai-key",
    });

    expect(inventory.mode).toBe("mock");
    expect(inventory.webhookComplete).toBe(false);
    expect(inventory.heliosApiKeyPresent).toBe(true);
    expect(inventory.heliosApiKeyRequired).toBe(false);
    expect(inventory.extractionComplete).toBe(false);
  });
});
