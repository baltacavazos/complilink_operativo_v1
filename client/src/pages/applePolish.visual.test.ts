import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const currentDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(currentDir, "../../..");

function readRepoFile(...segments: string[]) {
  return readFileSync(resolve(repoRoot, ...segments), "utf8");
}

const forbiddenClientStrings = ["CompliLink", "Helios", "Webhook"];

describe("Apple tip #3 — pulido visual", () => {
  it("mejora el contraste de los paneles de resultado en /auditar", () => {
    const css = readRepoFile("client", "src", "index.css");

    expect(css).toContain('[data-testid="auditar-verdict-panel"] [class*="text-slate-400"]');
    expect(css).toContain('[data-testid="auditar-result-reveal"] [class*="text-slate-400"]');
    expect(css).toContain("background-color: var(--ap-panel-bg-strong) !important");
    expect(css).toContain("--ap-text-muted: rgb(203 213 225)");
    expect(css).toContain("color: rgb(51 65 85)");
    expect(css).toContain(".ap-legal-confirmation");
    expect(css).toContain(".dark .audita-auditar section.ap-legal-confirmation");
    expect(css).toContain("color: rgb(226 232 240) !important");
  });

  it("pasa las pastillas uppercase tracking a minúsculas de oración", () => {
    const css = readRepoFile("client", "src", "index.css");

    expect(css).toContain('.uppercase[class*="tracking-"]');
    expect(css).toContain("text-transform: none !important");
    expect(css).toContain("letter-spacing: 0.01em !important");
    expect(css).toContain(".audita-home");
    expect(css).toContain(".audita-access");
    expect(css).toContain(".audita-auditar");
  });

  it("deja un solo peso visual primario en los CTA del hero de Home", () => {
    const home = readRepoFile("client", "src", "pages", "Home.tsx");

    expect(home).toContain("ap-hero-cta-row");
    expect(home).toContain(
      "h-12 w-full rounded-full bg-teal-600 px-6 text-white hover:bg-teal-700 sm:w-auto",
    );
    expect(home).toContain(
      "motion-hover-lift h-11 w-full rounded-full border-slate-200 bg-transparent px-5 text-sm font-medium text-slate-600 hover:bg-white sm:w-auto",
    );
    expect(home).not.toContain(
      "motion-hover-lift h-12 w-full rounded-full border-slate-200 bg-white px-7 text-base text-slate-700 hover:bg-slate-50 sm:w-auto",
    );
  });

  it("usa copy calmado en la bóveda vacía y oculta ids de depuración", () => {
    const auditar = readRepoFile("client", "src", "pages", "Auditar.tsx");

    expect(auditar).toContain("Todavía no hay documentos resguardados. Cuando guardes el");
    expect(auditar).toContain("primero, quedará aquí para consultarlo con calma.");
    expect(auditar).toContain("stripWorkerDebugIds");
    expect(auditar).toContain("\\bap\\.pol");
    expect(auditar).not.toContain("Aún no tienes documentos en tu bóveda laboral. Puedes");

    const vaultCopy = auditar.slice(
      auditar.indexOf("Todavía no hay documentos resguardados"),
      auditar.indexOf("Todavía no hay documentos resguardados") + 280,
    );
    for (const forbidden of forbiddenClientStrings) {
      expect(vaultCopy).not.toContain(forbidden);
    }
  });

  it("expone favicon local de AuditaPatrón además de las rutas de almacenamiento", () => {
    const html = readRepoFile("client", "index.html");
    const manifest = readRepoFile("client", "public", "site.webmanifest");
    const favicon = readRepoFile("client", "public", "favicon.svg");

    expect(html).toContain('href="/favicon.svg"');
    expect(manifest).toContain('"/favicon.svg"');
    expect(favicon).toContain("AuditaPatron");
    expect(favicon).toContain("#143c86");
  });
});

describe("Apple extraordinary #4 — experiencia visual", () => {
  it("refina el ritmo del hero: pastilla, titular, cuerpo y un CTA dominante", () => {
    const home = readRepoFile("client", "src", "pages", "Home.tsx");
    const css = readRepoFile("client", "src", "index.css");

    expect(home).toContain("ap-hero ");
    expect(home).toContain("ap-hero-copy");
    expect(home).toContain("ap-hero-headline");
    expect(home).toContain("ap-hero-support");
    expect(home).toContain("ap-hero-cta-row");
    expect(home).toContain("items-start gap-5 sm:gap-6 lg:grid-cols-[1.02fr_0.98fr]");
    expect(css).toContain(".audita-home .ap-hero");
    expect(css).toContain("padding-top: clamp(1.15rem, 3.2vw, 3.15rem)");
    expect(css).toContain(".audita-home .ap-hero-headline");
    expect(css).toContain(".audita-home .ap-hero-cta-row > :last-child");
    expect(home).not.toContain("CompliLink");
    expect(home).not.toMatch(/\bHelios\b/);
    expect(home).not.toMatch(/\bWebhook\b/);
  });

  it("sube el contraste de la barra de privacidad y calma los campos del trabajador", () => {
    const auditar = readRepoFile("client", "src", "pages", "Auditar.tsx");
    const css = readRepoFile("client", "src", "index.css");

    expect(auditar).toContain("data-ap-privacy-bar");
    expect(auditar).toContain("data-ap-upload-copy");
    expect(auditar).toContain("data-ap-status-cluster");
    expect(auditar).toContain("data-ap-review-panel");
    expect(auditar).toContain("ap-worker-field");
    expect(auditar).toContain("ap-status-chip");
    expect(auditar).toContain("isHumanMeaningfulAnalysisKey");
    expect(auditar).toContain("!/^sin dato visible$/i.test(value)");
    expect(auditar).toContain("filename|mimetype|internaldocumenttype");
    expect(auditar).toContain("Tu documento, en palabras simples");
    expect(auditar).toContain('data-ap-status-cluster');
    expect(auditar).toContain('cardClass: "border-teal-200 bg-teal-50/90"');
    expect(css).toContain('.audita-auditar [data-ap-privacy-bar]');
    expect(css).toContain("background-color: rgb(15 23 42) !important");
    expect(css).toContain(".audita-auditar .ap-worker-field");
    expect(css).toContain(".dark .audita-auditar .ap-worker-field");
    expect(css).toContain("background-color: rgba(30, 41, 59, 0.46) !important");
    expect(auditar).not.toMatch(/["'`][^"'`]*\bWebhook\b[^"'`]*["'`]/);
    expect(auditar).not.toContain("CompliLink");
  });

  it("deja un solo CTA primario «Sube tu documento» en /auditar sin archivo", () => {
    const auditar = readRepoFile("client", "src", "pages", "Auditar.tsx");

    expect(auditar).toContain('{(selectedFile || pendingDraft) ? (');
    expect(auditar).toContain("hidden gap-2.5 sm:grid");
    expect(auditar).toContain('const UPLOAD_PRIMARY_EMPTY_LABEL = "Sube tu documento"');
    expect(auditar).toContain("UPLOAD_ACCEPTED_DOCUMENTS_HINT");
    expect(auditar).toContain("Recibo, CFDI o PDF del IMSS");
    expect(auditar).toContain("Tu recibo o comprobante");
    expect(auditar).toContain("Revisa lo importante");
    expect(auditar).toContain("Foto o archivo para empezar");
    expect(auditar).not.toContain("Sube tu recibo o comprobante");
    expect(auditar).not.toContain("Sube tu recibo y revisa lo importante");
    expect(auditar).not.toContain(": \"Elegir documento\"");
    expect(auditar).not.toContain("Subir este documento");
    expect(auditar).toContain(
      'className="mt-5 hidden flex-col gap-3 sm:flex lg:flex-row lg:items-start"',
    );
  });

  it("deja /acceso sin caja redundante, con marca limpia y formulario Apple", () => {
    const gate = readRepoFile("client", "src", "pages", "AccessGate.tsx");
    const form = readRepoFile("client", "src", "pages", "LocalPasswordForm.tsx");
    const access = readRepoFile("client", "src", "pages", "Access.tsx");
    const css = readRepoFile("client", "src", "index.css");

    expect(gate).toContain("audita-access");
    expect(gate).toContain("ap-access-surface");
    expect(gate).toContain("ap-access-mark");
    expect(gate).not.toContain("rounded-[2rem] border border-slate-200 bg-white/95 px-6 py-8 shadow-[0_28px_80px_-42px_rgba(15,23,42,0.34)]");
    expect(gate).not.toContain("Entra con tu correo y contraseña. La revisión pública por RFC sigue disponible sin cuenta.");
    expect(form).toContain("ap-access-note");
    expect(form).toContain("Entras con correo y contraseña para volver a tu revisión.");
    expect(form).toContain("recibo, CFDI o PDF del IMSS");
    expect(form).not.toContain("La revisión pública por RFC sigue igual, sin cuenta.");
    expect(form).toContain("h-12 w-full rounded-full bg-slate-950");
    expect(form).toContain("border-0 bg-transparent text-base font-medium text-slate-600");
    expect(access).toContain("audita-access");
    expect(css).toContain(".audita-access .ap-access-surface");
    expect(css).toContain("border-color: transparent");
    expect(css).toContain(".audita-access .ap-access-mark img");
    expect(gate).not.toContain("CompliLink");
    expect(form).not.toContain("Helios");
    expect(access).not.toMatch(/\bWebhook\b/);
  });

  it("HOTFIX LIVE: hace legible «Qué sigue ahora» y oculta MIME/enums del trabajador", () => {
    const auditar = readRepoFile("client", "src", "pages", "Auditar.tsx");
    const css = readRepoFile("client", "src", "index.css");

    expect(auditar).toContain('data-ap-next-step');
    expect(auditar).toContain("ap-next-step-card");
    expect(auditar).toContain("isWorkerVisibleAnalysisField");
    expect(auditar).toContain("isWorkerInternalFieldValue");
    expect(auditar).toContain(': UPLOAD_PRIMARY_EMPTY_LABEL,');
    expect(css).toContain(".audita-auditar [data-ap-next-step]");
    expect(css).toContain(".dark .audita-auditar article[data-ap-next-step]:not(.ap-theme-toggle-track):not(.ap-theme-toggle-thumb)");
    expect(css).toContain(".dark .audita-auditar [data-ap-status-cluster] article:not(.ap-theme-toggle-track):not(.ap-theme-toggle-thumb)");
    expect(css).toContain("background-color: rgb(255 255 255) !important");
    expect(css).toContain("color: rgb(51 65 85) !important");
    expect(css).toContain("color: rgb(15 23 42) !important");
    expect(auditar).not.toContain("CompliLink");
    expect(auditar).not.toMatch(/["'`][^"'`]*\bHelios\b[^"'`]*["'`]/);

    const relativeLuminance = (r: number, g: number, b: number) => {
      const toLinear = (channel: number) => {
        const next = channel / 255;
        return next <= 0.03928 ? next / 12.92 : ((next + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
    };
    const contrastRatio = (left: [number, number, number], right: [number, number, number]) => {
      const first = relativeLuminance(...left);
      const second = relativeLuminance(...right);
      const lighter = Math.max(first, second);
      const darker = Math.min(first, second);
      return (lighter + 0.05) / (darker + 0.05);
    };

    expect(contrastRatio([255, 255, 255], [15, 23, 42])).toBeGreaterThan(12);
    expect(contrastRatio([255, 255, 255], [51, 65, 85])).toBeGreaterThan(7);
  });

  it("unifica radios, sombras suaves y evita texto recortado", () => {
    const css = readRepoFile("client", "src", "index.css");

    expect(css).toContain("--ap-radius-chip: 999px");
    expect(css).toContain("--ap-radius-card: 1.5rem");
    expect(css).toContain("--ap-shadow-soft:");
    expect(css).toContain("overflow: visible");
    expect(css).toContain("text-wrap: balance");
    expect(css).toContain(".audita-home .ap-status-chip");
    expect(css).toContain("text-transform: none");
    expect(css).toContain(".audita-pagos");
    expect(css).toContain(".audita-historial");
    expect(css).toContain("@media (max-width: 390px)");
  });
});
