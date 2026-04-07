import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";

const webhookUrl = process.env.AUDITAPATRON_ENGINE_WEBHOOK_URL ?? "";
const hmacSecret = process.env.AUDITAPATRON_ENGINE_HMAC_SECRET ?? "";
const healthUrl = "https://complilink.mx/api/auditapatron/health";

describe("CompliLink MX bridge credentials", () => {
  it("reaches the published health endpoint", async () => {
    const response = await fetch(healthUrl, {
      method: "GET",
      headers: { Accept: "application/json" },
    });

    expect(response.ok).toBe(true);

    const body = await response.json();
    expect(body).toMatchObject({
      status: "ok",
      service: "complilink-auditapatron-bridge",
    });
  });

  it("accepts a signed test webhook with the configured secret", async () => {
    expect(webhookUrl).toBe("https://complilink.mx/api/auditapatron/webhook");
    expect(hmacSecret.length).toBeGreaterThanOrEqual(32);

    const payload = {
      event: "document.uploaded",
      documentId: `test_secret_validation_${Date.now()}`,
      sourceUserId: "test_user",
      docType: "recibo_nomina",
      fileUrl: "https://example.com/test.pdf",
      sha256: "0000000000000000000000000000000000000000000000000000000000000000",
      mimeType: "application/pdf",
      uploadedAt: "2026-04-07T00:00:00.000Z",
    };

    const timestamp = Math.floor(Date.now() / 1000).toString();
    const body = JSON.stringify(payload);
    const signature = createHmac("sha256", hmacSecret)
      .update(`${timestamp}.${body}`)
      .digest("hex");

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-AuditaPatron-Timestamp": timestamp,
        "X-AuditaPatron-Signature": signature,
      },
      body,
    });

    const responseText = await response.text();
    expect(response.status).toBe(200);

    const responseBody = JSON.parse(responseText);
    expect(responseBody).toMatchObject({
      verified: true,
      event: "document.uploaded",
      documentId: payload.documentId,
    });
  });
});
