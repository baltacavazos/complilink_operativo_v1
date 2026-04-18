import { describe, expect, it } from "vitest";

const REMOTE_MANIFEST_PATH =
  "/AuditaPatron/backups/complilink_operativo_v1/2026-04-18_full/complilink_operativo_v1_full_backup_20260418_025522_manifest.txt";

describe("DROPBOX_API_KEY restore scope", () => {
  it(
    "permite descargar el manifiesto del respaldo desde Dropbox",
    async () => {
      const token = process.env.DROPBOX_API_KEY;
      expect(token).toBeTruthy();

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
      expect(response.status).toBe(200);
      expect(body).toContain("Included paths:");
      expect(body).toContain("complilink_operativo_v1_full_backup_20260418_025522.tar.gz");
    },
    20000,
  );
});
