import { describe, expect, it } from "vitest";
import { ENV } from "./_core/env";

describe("AUDITAPATRON_ENGINE_WEBHOOK_URL", () => {
  it("apunta a un webhook contractual sano del proyecto", async () => {
    const webhookUrl = ENV.auditapatronEngineWebhookUrl;

    expect(webhookUrl).toBeTruthy();
    expect(webhookUrl).toBe("https://auditapatron.com/api/auditapatron/webhook");

    const parsed = new URL(webhookUrl);
    parsed.pathname = "/api/auditapatron/health";
    parsed.search = "";

    const response = await fetch(parsed.toString(), {
      headers: {
        Accept: "application/json",
      },
    });

    expect(response.status).toBe(200);
    expect((response.headers.get("content-type") ?? "").toLowerCase()).toContain("application/json");

    const payload = await response.json();
    expect(payload).toMatchObject({
      status: "ok",
      bridge: "auditapatron",
      webhookPath: "/api/auditapatron/webhook",
      responseContract: "auditapatron.bridge.ack.v1",
    });
  });
});
