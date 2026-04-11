import { describe, expect, it } from "vitest";

const DROPBOX_API = "https://api.dropboxapi.com/2";

async function postDropbox(token: string, endpoint: string, body: unknown) {
  const response = await fetch(`${DROPBOX_API}${endpoint}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const raw = await response.text();
  let payload: unknown = null;

  try {
    payload = raw ? JSON.parse(raw) : null;
  } catch {
    payload = raw;
  }

  return { response, raw, payload };
}

describe("DROPBOX_API_KEY", () => {
  it("permite consultar la cuenta actual y operar en la API de archivos", async () => {
    const token = process.env.DROPBOX_API_KEY;

    expect(token, "DROPBOX_API_KEY debe existir en el entorno").toBeTruthy();

    const account = await postDropbox(token!, "/users/get_current_account", null);
    expect(
      account.response.ok,
      `Dropbox rechazó la consulta de cuenta con status ${account.response.status}: ${account.raw}`,
    ).toBe(true);
    expect(account.payload).toMatchObject({
      account_id: expect.any(String),
      name: expect.objectContaining({
        display_name: expect.any(String),
      }),
    });

    const list = await postDropbox(token!, "/files/list_folder", { path: "" });
    expect(
      list.response.ok,
      `Dropbox rechazó el acceso a archivos con status ${list.response.status}: ${list.raw}`,
    ).toBe(true);

    const tmpPath = `/Backups/AuditaPatron/.manus_dropbox_probe_${Date.now()}`;
    const createFolder = await postDropbox(token!, "/files/create_folder_v2", {
      path: tmpPath,
      autorename: false,
    });

    expect(
      createFolder.response.ok,
      `Dropbox permitió la cuenta, pero no crear carpeta en archivos. Status ${createFolder.response.status}: ${createFolder.raw}`,
    ).toBe(true);

    const removeFolder = await postDropbox(token!, "/files/delete_v2", { path: tmpPath });
    expect(
      removeFolder.response.ok,
      `Dropbox creó la carpeta temporal pero no permitió borrarla. Status ${removeFolder.response.status}: ${removeFolder.raw}`,
    ).toBe(true);
  }, 30_000);
});
