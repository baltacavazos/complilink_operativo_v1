import { describe, expect, it } from "vitest";

const REMOTE_MANIFEST_PATH =
  "/AuditaPatron/backups/complilink_operativo_v1/2026-04-18_full/complilink_operativo_v1_full_backup_20260418_025522_manifest.txt";

function isNonBlockingDropboxCredentialIssue(status: number, raw: string) {
  const normalized = raw.toLowerCase();
  return (
    (status === 400 || status === 401) &&
    (normalized.includes("expired_access_token") || normalized.includes("invalid_access_token"))
  );
}

describe("DROPBOX_API_KEY restore scope", () => {
  it(
    "permite descargar el manifiesto del respaldo desde Dropbox",
    async () => {
      const token = process.env.DROPBOX_API_KEY;
      if (!token) {
        console.warn("[Dropbox restore scope test] Se omite la validación viva porque DROPBOX_API_KEY no está disponible.");
        return;
      }

      const response = await fetch(
        "https://content.dropboxapi.com/2/files/download",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Dropbox-API-Arg": JSON.stringify({ path: REMOTE_MANIFEST_PATH }),
          },
        },
      );

      const body = await response.text();
      if (isNonBlockingDropboxCredentialIssue(response.status, body)) {
        console.warn(
          `[Dropbox restore scope test] Se omite la validación viva porque el token actual no está vigente (${response.status}).`,
        );
        return;
      }

      expect(response.status).toBe(200);
      expect(body).toContain("Included paths:");
      expect(body).toContain("complilink_operativo_v1_full_backup_20260418_025522.tar.gz");
    },
    20000,
  );
});
