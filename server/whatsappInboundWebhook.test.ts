import { createHmac } from "node:crypto";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { readFileSync } from "node:fs";
import express from "express";
import { afterEach, describe, expect, it, vi } from "vitest";
import { serveStatic } from "./_core/vite";
import { registerWhatsappInboundWebhook } from "./whatsappInboundWebhook";

const servers: Array<ReturnType<typeof createServer>> = [];

afterEach(async () => {
  delete process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;
  delete process.env.WHATSAPP_APP_SECRET;
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise<void>((resolve, reject) => {
          server.close((error) => (error ? reject(error) : resolve()));
        }),
    ),
  );
});

async function startApp(options?: { withSpa?: boolean }) {
  const app = express();
  app.use(
    express.json({
      verify: (req, _res, buffer) => {
        (req as typeof req & { rawBody?: string }).rawBody = buffer.toString("utf8");
      },
    }),
  );
  registerWhatsappInboundWebhook(app);
  if (options?.withSpa) serveStatic(app);
  const server = createServer(app);
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const { port } = server.address() as AddressInfo;
  return `http://127.0.0.1:${port}`;
}

describe("whatsapp inbound webhook", () => {
  it("is registered before the SPA fallback", () => {
    const source = readFileSync(new URL("./_core/index.ts", import.meta.url), "utf8");
    const route = source.indexOf("registerWhatsappInboundWebhook(app)");
    const spa = source.indexOf("serveStatic(app)");
    expect(route).toBeGreaterThan(-1);
    expect(spa).toBeGreaterThan(route);
  });

  it("rejects a wrong verify token with 403 instead of the HTML page", async () => {
    process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN = "correct-token";
    const base = await startApp({ withSpa: true });
    const response = await fetch(
      `${base}/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=WRONG&hub.challenge=ok`,
    );
    const body = await response.text();
    expect(response.status).toBe(403);
    expect(body).toBe("Forbidden");
    expect(body).not.toContain("<html");
  });

  it("returns the challenge when the verify token matches", async () => {
    process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN = "correct-token";
    const base = await startApp();
    const response = await fetch(
      `${base}/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=correct-token&hub.challenge=ok-123`,
    );
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("ok-123");
  });

  it("rejects the handshake when the verify token is unset", async () => {
    const base = await startApp();
    const response = await fetch(
      `${base}/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=anything&hub.challenge=ok`,
    );
    expect(response.status).toBe(403);
  });

  it("logs only counts and the last 4 digits, and does not send a message", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const realFetch = globalThis.fetch.bind(globalThis);
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation((input, init) => realFetch(input, init));
    const base = await startApp();
    const response = await fetch(`${base}/api/whatsapp/webhook`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        object: "whatsapp_business_account",
        entry: [
          {
            changes: [
              {
                value: {
                  messages: [
                    {
                      from: "5215512345678",
                      text: { body: "hola secreto del recibo" },
                    },
                  ],
                  statuses: [{ recipient_id: "521559998877", status: "delivered" }],
                },
              },
            ],
          },
        ],
      }),
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ received: true });
    const logged = JSON.stringify(info.mock.calls);
    expect(logged).toContain('"messages":1');
    expect(logged).toContain('"statuses":1');
    expect(logged).toContain("5678");
    expect(logged).toContain("8877");
    expect(logged).not.toContain("5215512345678");
    expect(logged).not.toContain("hola secreto");
    const outbound = fetchSpy.mock.calls.map((call) => String(call[0]));
    expect(outbound.some((url) => url.includes("graph.facebook.com"))).toBe(false);
    expect(readFileSync(new URL("./whatsappInboundWebhook.ts", import.meta.url), "utf8")).not.toContain(
      "WHATSAPP_NOTIFY_ENABLED",
    );
    info.mockRestore();
    fetchSpy.mockRestore();
  });

  it("checks X-Hub-Signature-256 when the app secret is set", async () => {
    process.env.WHATSAPP_APP_SECRET = "app-secret";
    const base = await startApp();
    const payload = JSON.stringify({
      entry: [{ changes: [{ value: { messages: [{ from: "5215511112222" }] } }] }],
    });
    const signature = createHmac("sha256", "app-secret").update(payload).digest("hex");
    const rejected = await fetch(`${base}/api/whatsapp/webhook`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-hub-signature-256": "sha256=deadbeef",
      },
      body: payload,
    });
    expect(rejected.status).toBe(403);

    const accepted = await fetch(`${base}/api/whatsapp/webhook`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-hub-signature-256": `sha256=${signature}`,
      },
      body: payload,
    });
    expect(accepted.status).toBe(200);
  });
});
