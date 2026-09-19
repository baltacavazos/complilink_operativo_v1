import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const clientRoot = path.resolve(import.meta.dirname, "..");
const banned = new RegExp(`se\\u00f1al`, "i");

function walkTsFiles(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkTsFiles(fullPath));
      continue;
    }
    if (/\.(ts|tsx)$/.test(entry.name)) {
      files.push(fullPath);
    }
  }
  return files;
}

describe("hotfix claridad residual #29", () => {
  it("deja un solo CTA de carga en /auditar y quita los botones repetidos", () => {
    const auditar = fs.readFileSync(path.join(clientRoot, "pages", "Auditar.tsx"), "utf8");

    expect(auditar).toContain('const UPLOAD_PRIMARY_EMPTY_LABEL = "Sube tu documento"');
    expect(auditar).not.toContain("Subir este documento");
  });

  it("no deja jerga de lectura en el cliente visible", () => {
    const offenders: string[] = [];
    for (const filePath of walkTsFiles(clientRoot)) {
      const relative = path.relative(clientRoot, filePath);
      if (relative === path.join("pages", "clarity.hotfix.test.ts")) {
        continue;
      }
      const source = fs.readFileSync(filePath, "utf8");
      if (banned.test(source)) {
        offenders.push(relative);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("saca el Salir flotante y deja Volver en el flujo, sin tapar contenido", () => {
    const app = fs.readFileSync(path.join(clientRoot, "App.tsx"), "utf8");
    const shell = fs.readFileSync(path.join(clientRoot, "components", "MobileAppShell.tsx"), "utf8");

    expect(app).not.toContain("fixed bottom-3 right-3");
    expect(app).not.toContain(">Salir<");
    expect(app).toContain('path === "/auditar"');
    expect(app).toMatch(/>\s*Volver\s*</);
    expect(shell).toMatch(/>\s*Volver\s*</);
  });
});
