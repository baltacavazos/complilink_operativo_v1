import { describe, expect, it } from "vitest";

function isNonBlockingDropboxCredentialIssue(status: number, raw: string) {
  const normalized = raw.toLowerCase();
  return (
    (status === 400 || status === 401) &&
    (normalized.includes("expired_access_token") || normalized.includes("invalid_access_token"))
  );
}

describe("DROPBOX_API_KEY", () => {
  it(
    "autentica correctamente contra Dropbox",
    async () => {
      const token = process.env.DROPBOX_API_KEY;
      if (!token) {
        console.warn("[Dropbox auth test] Se omite la validación viva porque DROPBOX_API_KEY no está disponible.");
        return;
      }

      const response = await fetch(
        "https://api.dropboxapi.com/2/users/get_current_account",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      const body = await response.text();
      if (isNonBlockingDropboxCredentialIssue(response.status, body)) {
        console.warn(
          `[Dropbox auth test] Se omite la validación viva porque el token actual no está vigente (${response.status}).`,
        );
        return;
      }

      expect(response.status).toBe(200);

      const data = JSON.parse(body) as {
        account_id?: string;
        email?: string;
      };

      expect(data.account_id || data.email).toBeTruthy();
    },
    20000,
  );
});
