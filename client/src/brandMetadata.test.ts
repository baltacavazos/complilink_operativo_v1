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

    expect(indexHtml).toContain('<meta name="application-name" content="AuditaPatron" />');
    expect(indexHtml).toContain('<meta name="apple-mobile-web-app-capable" content="yes" />');
    expect(indexHtml).toContain('<meta name="apple-mobile-web-app-title" content="AuditaPatron" />');
    expect(indexHtml).toContain('<meta property="og:site_name" content="AuditaPatron" />');
    expect(indexHtml).toContain('<meta property="og:title" content="AuditaPatron · Conoce tus derechos" />');
    expect(indexHtml).toContain(`<meta property="og:image" content="${AUDITAPATRON_LOGO_ASSETS.full}" />`);
    expect(indexHtml).toContain(`<meta name="twitter:image" content="${AUDITAPATRON_LOGO_ASSETS.full}" />`);
    expect(indexHtml).toContain('<link rel="manifest" href="/site.webmanifest" />');
    expect(indexHtml).toContain('apple-touch-icon');
  });

  it("mantiene un manifest preparado para instalación móvil con iconos de app", () => {
    const manifest = JSON.parse(readClientFile("public/site.webmanifest")) as {
      name: string;
      short_name: string;
      theme_color: string;
      background_color: string;
      display: string;
      icons: Array<{ src: string; sizes: string; type: string }>;
    };

    expect(manifest.name).toBe("AuditaPatron");
    expect(manifest.short_name).toBe("AuditaPatron");
    expect(manifest.theme_color).toBe("#143c86");
    expect(manifest.background_color).toBe("#ffffff");
    expect(manifest.display).toBe("standalone");
    expect(manifest.icons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ sizes: "32x32", type: "image/png" }),
        expect.objectContaining({ sizes: "192x192", type: "image/png" }),
        expect.objectContaining({ sizes: "512x512", type: "image/png" }),
      ]),
    );
    expect(manifest.icons.every((icon) => icon.src.includes("cloudfront.net"))).toBe(true);
  });
});
