import { describe, expect, it } from "vitest";

describe("Google OAuth credentials", () => {
  it("authenticates the configured client before rejecting a deliberately invalid authorization code", async () => {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    expect(clientId).toBeTruthy();
    expect(clientSecret).toBeTruthy();

    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId!,
        client_secret: clientSecret!,
        code: "auditapatron-live-credential-probe",
        grant_type: "authorization_code",
        redirect_uri: "https://auditapatron.com/api/auth/google/callback",
      }),
    });

    const payload = await response.json() as { error?: string };

    // A valid client reaches grant validation; invalid client credentials return invalid_client.
    expect(payload.error).not.toBe("invalid_client");
    expect(payload.error).toBe("invalid_grant");
  }, 15_000);
});
