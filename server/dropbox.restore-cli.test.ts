import { execFileSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import { describe, expect, it } from "vitest";

const DROPBOX_API_KEY = process.env.DROPBOX_API_KEY;
const BACKUP_NAME = "2026-04-18_full";
const DESTINATION_DIR = "/tmp/dropbox_restore_cli_dry_run";

function isNonBlockingDropboxCredentialIssue(status: number, raw: string) {
  const normalized = raw.toLowerCase();
  return (
    (status === 400 || status === 401) &&
    (normalized.includes("expired_access_token") || normalized.includes("invalid_access_token"))
  );
}

describe("dropbox_full_backup_restore.py", () => {
  it.runIf(Boolean(DROPBOX_API_KEY))(
    "permite previsualizar la restauración guiada con backup-name y destination-dir explícito",
    async () => {
      const preflight = await fetch("https://api.dropboxapi.com/2/users/get_current_account", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${DROPBOX_API_KEY}`,
        },
      });
      const preflightBody = await preflight.text();

      if (isNonBlockingDropboxCredentialIssue(preflight.status, preflightBody)) {
        console.warn(
          `[Dropbox restore CLI test] Se omite la validación viva porque el token actual no está vigente (${preflight.status}).`,
        );
        return;
      }

      if (existsSync(DESTINATION_DIR)) {
        rmSync(DESTINATION_DIR, { recursive: true, force: true });
      }

      const stdout = execFileSync(
        "python3",
        [
          "scripts/dropbox_full_backup_restore.py",
          "--backup-name",
          BACKUP_NAME,
          "--pattern",
          "manifest",
          "--destination-dir",
          DESTINATION_DIR,
          "--dry-run",
        ],
        {
          cwd: "/home/ubuntu/complilink_operativo_v1",
          encoding: "utf8",
          env: process.env,
        },
      );

      const result = JSON.parse(stdout) as {
        dry_run: boolean;
        remote_folder: string;
        destination_dir: string;
        pattern: string | null;
        planned_count: number;
        planned_files: Array<{ remote_path: string; relative_path: string; size: number }>;
      };

      expect(result.dry_run).toBe(true);
      expect(result.remote_folder).toContain(BACKUP_NAME);
      expect(result.destination_dir).toBe(DESTINATION_DIR);
      expect(result.pattern).toBe("manifest");
      expect(result.planned_count).toBeGreaterThan(0);
      expect(result.planned_files[0]?.remote_path).toContain("manifest");
    },
  );
});
