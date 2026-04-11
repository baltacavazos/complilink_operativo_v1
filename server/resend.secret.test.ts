import { describe, expect, it } from "vitest";

const resendApiKey = process.env.RESEND_API_KEY;
const resendFromEmail = process.env.RESEND_FROM_EMAIL;

describe("resend secret wiring", () => {
  it("authenticates against the Resend API and keeps the configured sender", async () => {
    expect(resendApiKey).toBeTruthy();
    expect(resendFromEmail).toBe("onboarding@resend.dev");

    const response = await fetch("https://api.resend.com/domains", {
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
      },
    });

    const bodyText = await response.text();

    expect(response.ok, bodyText).toBe(true);
  }, 20000);
});
