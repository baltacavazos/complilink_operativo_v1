import { describe, expect, it } from "vitest";

const resendApiKey = process.env.RESEND_API_KEY;
const resendFromEmail = process.env.RESEND_FROM_EMAIL;
const ownerBackupEmail = process.env.OWNER_BACKUP_EMAIL;

describe("resend secret wiring", () => {
  it("authenticates against the Resend API and keeps a valid temporary owner fallback while no domains are verified", async () => {
    expect(resendApiKey).toBeTruthy();
    expect(resendFromEmail).toBe("onboarding@resend.dev");
    expect(ownerBackupEmail).toBeTruthy();

    const response = await fetch("https://api.resend.com/domains", {
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
      },
    });

    const bodyText = await response.text();
    expect(response.ok, bodyText).toBe(true);

    const payload = JSON.parse(bodyText) as { data?: Array<{ id: string }> };
    const verifiedDomainsCount = Array.isArray(payload.data) ? payload.data.length : 0;

    if (verifiedDomainsCount === 0) {
      expect(ownerBackupEmail).toBe("baltacavazos85@gmail.com");
    }
  }, 20000);
});
