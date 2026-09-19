import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const currentDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(currentDir, "../../..");

function readRepoFile(...segments: string[]) {
  return readFileSync(resolve(repoRoot, ...segments), "utf8");
}

function relativeLuminance(r: number, g: number, b: number) {
  const toLinear = (channel: number) => {
    const next = channel / 255;
    return next <= 0.03928 ? next / 12.92 : ((next + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

function contrastRatio(
  left: [number, number, number],
  right: [number, number, number],
) {
  const first = relativeLuminance(...left);
  const second = relativeLuminance(...right);
  const lighter = Math.max(first, second);
  const darker = Math.min(first, second);
  return (lighter + 0.05) / (darker + 0.05);
}

describe("MICRO residual clarity — /auditar", () => {
  it("hace legible el tip Documento sugerido: blanco sobre pizarra, no azul sobre azul", () => {
    const auditar = readRepoFile("client", "src", "pages", "Auditar.tsx");
    const css = readRepoFile("client", "src", "index.css");
    const tipAnchor = auditar.indexOf('data-testid="auditar-suggested-tip"');
    const tipBlock = auditar.slice(tipAnchor - 80, tipAnchor + 900);

    expect(tipBlock).toContain("data-ap-suggested-tip");
    expect(tipBlock).toContain('data-testid="auditar-suggested-tip"');
    expect(tipBlock).toContain("border-slate-800 bg-white");
    expect(tipBlock).toContain("text-slate-950");
    expect(tipBlock).toContain("text-slate-800");
    expect(tipBlock).not.toContain("bg-sky-50");
    expect(tipBlock).not.toContain("text-sky-950");
    expect(tipBlock).not.toContain("text-sky-700");

    expect(css).toContain(".audita-auditar [data-ap-suggested-tip]");
    expect(css).toContain("background-color: #ffffff !important");
    expect(css).toContain("border-color: rgb(15 23 42) !important");
    expect(css).toContain("color: rgb(15 23 42) !important");
    expect(css).toContain(
      ".dark .audita-auditar [data-ap-suggested-tip][class*=\"bg-white\"]",
    );

    expect(contrastRatio([255, 255, 255], [15, 23, 42])).toBeGreaterThan(12);
    expect(contrastRatio([248, 250, 252], [15, 23, 42])).toBeGreaterThan(12);
  });

  it("dice «ves el resultado» una sola vez por vista, no 2–3 veces", () => {
    const auditar = readRepoFile("client", "src", "pages", "Auditar.tsx");
    const guestStart = auditar.indexOf(
      'if (!auth.isAuthenticated && !auditarHarnessBypass) {',
    );
    const guestEnd = auditar.indexOf("const setPersistedCeoPanelOpen");
    const guestView = auditar.slice(guestStart, guestEnd);
    const guestMatches = guestView.match(/ves el resultado/gi) ?? [];

    expect(guestView).toContain("Primero revisas. Guardas solo si te sirve.");
    expect(guestView).not.toContain("Primero ves el resultado.");
    expect(guestView).toContain(
      "Después decides si lo guardas o sigues con otro documento.",
    );
    expect(guestMatches).toHaveLength(1);
    expect(guestMatches[0]).toBe("Ves el resultado");

    const authHero = auditar.slice(
      auditar.indexOf('title={shouldCompactPostUploadExperience ? "Tu auditoría"'),
      auditar.indexOf("Tu recibo está seguro y solo tú lo ves") + 80,
    );
    const authMatches = authHero.match(/ves el resultado/gi) ?? [];

    expect(authHero).toContain("Primero revisas. Guardas solo si te sirve.");
    expect(authHero).not.toContain("Primero ves el resultado.");
    expect(authMatches).toHaveLength(2);
    expect(auditar).toContain(
      "Sube foto o archivo. Ves el resultado y decides si lo guardas.",
    );
    expect(auditar).toContain(
      "Sube foto, PDF, XML o DOCX. Ves el resultado y decides si lo guardas.",
    );
    expect(auditar).toContain(
      "Empieza con una foto o PDF. Luego decides si sigues.",
    );
    expect(auditar).not.toContain(
      "Empieza con una foto o PDF. Subes, ves el resultado y luego decides si sigues.",
    );
  });

  it("no regressa Volver único, CTA de carga ni pagos demo", () => {
    const auditar = readRepoFile("client", "src", "pages", "Auditar.tsx");
    const app = readRepoFile("client", "src", "App.tsx");
    const shell = readRepoFile("client", "src", "components", "MobileAppShell.tsx");
    const payments = readRepoFile("client", "src", "pages", "Payments.tsx");

    expect(app).not.toContain("fixed bottom-3 right-3");
    expect(app).toContain('path === "/auditar"');
    expect(app).toMatch(/>\s*Volver\s*</);
    expect(shell).toMatch(/>\s*Volver\s*</);
    expect(auditar).toContain('const UPLOAD_PRIMARY_EMPTY_LABEL = "Sube tu documento"');
    expect(auditar).toContain("Esto es una demostración. No se cobra nada.");
    expect(payments).toContain("Esto es una demostración. No se cobra nada.");
    expect(auditar).not.toMatch(/se\u00f1al/i);
    expect(payments).not.toMatch(/se\u00f1al/i);
  });
});
