import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { AUDITAPATRON_LOGO_ASSETS } from "./components/AuditaPatronLogo";

const currentDir = dirname(fileURLToPath(import.meta.url));
const clientRoot = resolve(currentDir, "..");

function readClientFile(relativePath: string) {
  return readFileSync(resolve(clientRoot, relativePath), "utf8");
}

describe("brand metadata", () => {
  it("expone metadatos sociales y mobile web app alineados con el logo definitivo", () => {
    const indexHtml = readClientFile("index.html");

    expect(indexHtml).toContain('<html lang="es">');
    expect(indexHtml).toContain('<meta name="application-name" content="AuditaPatrón" />');
    expect(indexHtml).toContain('<meta name="apple-mobile-web-app-capable" content="yes" />');
    expect(indexHtml).toContain('<meta name="apple-mobile-web-app-title" content="AuditaPatrón" />');
    expect(indexHtml).toContain('<meta property="og:site_name" content="AuditaPatrón" />');
    expect(indexHtml).toContain('<meta property="og:title" content="AuditaPatrón · Conoce tus derechos" />');
    expect(indexHtml).toContain(`<meta property="og:image" content="${AUDITAPATRON_LOGO_ASSETS.full}" />`);
    expect(indexHtml).toContain(`<meta name="twitter:image" content="${AUDITAPATRON_LOGO_ASSETS.full}" />`);
    expect(indexHtml).toContain('<link rel="manifest" href="/site.webmanifest" />');
    expect(indexHtml).toContain('href="/favicon.svg"');
    expect(indexHtml).toContain('apple-touch-icon');
    expect(indexHtml).toContain('href="/favicon.svg"');
    expect(indexHtml).toContain('href="/favicon-32.png"');
    expect(indexHtml).toContain('href="/apple-touch-icon.png"');
  });

  it("mantiene un manifest preparado para instalación móvil con iconos de app", () => {
    const manifest = JSON.parse(readClientFile("public/site.webmanifest")) as {
      name: string;
      short_name: string;
      theme_color: string;
      background_color: string;
      display: string;
      icons: Array<{ src: string; sizes: string; type: string; purpose?: string }>;
    };

    expect(manifest.name).toBe("AuditaPatrón");
    expect(manifest.short_name).toBe("AuditaPatrón");
    expect(manifest.theme_color).toBe("#143c86");
    expect(manifest.background_color).toBe("#142c52");
    expect(manifest.display).toBe("standalone");
    expect(manifest.icons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ src: "/favicon.svg", type: "image/svg+xml" }),
        expect.objectContaining({ sizes: "32x32", type: "image/png", src: "/favicon-32.png" }),
        expect.objectContaining({ sizes: "192x192", type: "image/png", purpose: "any maskable", src: "/favicon-192.png" }),
        expect.objectContaining({ sizes: "180x180", type: "image/png", purpose: "any maskable", src: "/apple-touch-icon.png" }),
      ]),
    );
    expect(manifest.icons.some((icon) => icon.src === "/favicon.svg")).toBe(true);
    expect(manifest.icons.every((icon) => icon.src.startsWith("/") && !icon.src.includes("manus-storage"))).toBe(true);
  });
});
