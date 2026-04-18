import { describe, expect, it } from "vitest";

describe("DROPBOX_API_KEY", () => {
  it(
    "autentica correctamente contra Dropbox",
    async () => {
      const token = process.env.DROPBOX_API_KEY;
      expect(token).toBeTruthy();

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
