import { describe, expect, it } from "vitest";
import { resolveResendFromEmail } from "./authService";

const apiKey = process.env.RESEND_API_KEY;
const fromEmail = process.env.RESEND_FROM_EMAIL;

describe.skipIf(!apiKey || !fromEmail)("Resend public auth sender", () => {
  it("uses a verified domain with sending enabled", async () => {
    expect(resolveResendFromEmail(fromEmail ?? "")).toMatch(/^Auditapatron <[^>]+>$/i);

    const response = await fetch("https://api.resend.com/domains", {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    expect(response.ok).toBe(true);

    const payload = (await response.json()) as {
      data?: Array<{
        name?: string;
        status?: string;
        capabilities?: { sending?: string };
      }>;
    };
    const domain = payload.data?.find((item) => item.name === "complilink.mx");

    expect(domain).toMatchObject({
      name: "complilink.mx",
      status: "verified",
      capabilities: { sending: "enabled" },
    });
  });
});
