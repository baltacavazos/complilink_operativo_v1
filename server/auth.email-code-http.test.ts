import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import express from "express";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getFriendlyAuthMessage, parseStructuredAuthMessage } from "@/pages/accessAuthMessage";
import { appRouter } from "./routers";

const previousSmokeAuth = process.env.SMOKE_AUTH;
const expiredMessage =
  "El código ya expiró o esta solicitud ya no es válida. Solicita uno nuevo para continuar.";

describe("verifyEmailCode with smoke auth off", () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    process.env.SMOKE_AUTH = "0";
    const app = express();
    app.use(express.json());
    app.use(
      "/api/trpc",
      createExpressMiddleware({
        router: appRouter,
        createContext: ({ req, res }) => ({ req, res, user: null }),
      }),
    );
    server = createServer(app);
    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", () => resolve());
    });
    const address = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    if (previousSmokeAuth === undefined) delete process.env.SMOKE_AUTH;
    else process.env.SMOKE_AUTH = previousSmokeAuth;
    if (!server) return;
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });

  it("returns 400 and the expired-code copy for a smoke address with code 000000", async () => {
    process.env.SMOKE_AUTH = "0";
    const response = await fetch(`${baseUrl}/api/trpc/auth.verifyEmailCode`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        json: {
          email: "smoke-off@auditapatron-smoke.test",
          code: "000000",
        },
      }),
    });
    const body = (await response.json()) as {
      error?: { json?: { message?: string; data?: { code?: string; httpStatus?: number } } };
    };
    const error = body.error?.json;

    expect(response.status).toBe(400);
    expect(error?.data?.httpStatus).toBe(400);
    expect(error?.data?.code).toBe("BAD_REQUEST");
    expect(error?.message).toBe(`${expiredMessage}||code=EMAIL_CODE_EXPIRED`);
    expect(getFriendlyAuthMessage(parseStructuredAuthMessage(error?.message ?? ""))).toBe(
      "Ese código ya venció. Pide uno nuevo.",
    );
  });
});
