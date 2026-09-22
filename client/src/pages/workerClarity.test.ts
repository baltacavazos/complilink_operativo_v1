import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { buildInstituteSilencePresentation, resolveOfficialCheckDisplay } from "@shared/officialCheckCopy";

const css = readFileSync(new URL("../index.css", import.meta.url), "utf8");
const result = readFileSync(new URL("../components/WorkerOfficialResult.tsx", import.meta.url), "utf8");
const auditar = readFileSync(new URL("./Auditar.tsx", import.meta.url), "utf8");
const sheet = readFileSync(new URL("../components/HeliosCopilotSheet.tsx", import.meta.url), "utf8");

describe("contraste y claridad del resultado", () => {
  it("deja tinta casi negra en superficies claras y blanco solo en botón oscuro", () => {
    expect(css).toContain("--foreground: #161616");
    expect(css).toContain("--ap-ink: #161616");
    expect(css).toContain("html:not(.dark) .audita-auditar");
    expect(css).toContain(".ap-worker-chat :is(p, li, h1, h2, h3, label, summary");
    const privacyBar = css.slice(
      css.indexOf(".audita-auditar [data-ap-privacy-bar]"),
      css.indexOf(".audita-auditar [data-ap-upload-copy]"),
    );
    expect(privacyBar).toContain("background-color: #ffffff !important");
    expect(privacyBar).toContain("color: #161616 !important");
    expect(privacyBar).not.toContain("248 250 252");
    expect(css).toContain(".ap-light-surface");
    expect(css).toContain(".ap-btn-on-dark");
    expect(css).toContain("color: #ffffff !important");
    expect(result).toContain("ap-light-surface");
    expect(result).toContain("ap-btn-on-dark");
    expect(result).toContain("text-[#111111]");
    expect(result).toContain("ap-btn-on-dark");
    expect(result).not.toContain("text-teal-");
    expect(result).not.toContain("text-emerald-");
  });

  it("pinta un veredicto, tres líneas, detalle cerrado y un solo botón", () => {
    const detailAt = result.indexOf(">Ver detalle<");
    const ctaAt = result.indexOf('data-testid="official-check-cta"');
    expect(result).toContain("Qué pasó");
    expect(result).toContain("Qué significa");
    expect(result).toContain("Qué hacer");
    expect(detailAt).toBeGreaterThan(0);
    expect(ctaAt).toBeGreaterThan(detailAt);
    expect(result).not.toMatch(/<details[^>]*\sopen/);
    const chatAt = result.indexOf('data-testid="official-check-chat-cta"');
    expect(chatAt).toBeGreaterThan(ctaAt);
    expect(result).toContain("{presentation.askLabel}");
    expect(result).toContain("underline");
    expect(result.slice(chatAt, chatAt + 280)).not.toContain("ap-btn-on-dark");
    expect(result).not.toContain("Subir otro recibo");
    expect(result.match(/text-white/g)?.length).toBe(1);
    expect(result).toContain("ap-btn-on-dark");
    expect(result.match(/data-testid="official-check-cta"/g)?.length).toBe(1);
    expect(result).not.toContain("bg-teal-700");
    expect(auditar).toContain("WorkerOfficialResult");
    expect(auditar).toContain('data-testid="worker-result-only"');
    expect(auditar).toContain("officialCheckDisplay.silence ? null");
    expect(auditar).toContain("privacySignal.ready ? null");
    expect(auditar).not.toContain("Tu empresa no ve esto.");
    expect(auditar).not.toContain("Privacidad activa mientras analizamos");
    expect(auditar).toContain("verdict?.opener");
    expect(auditar).toContain("hideCaseChips");
    expect(auditar).toContain('data-compact-official-detail="true"');
    expect(auditar).toContain("officialComparison={null}");
    const compactAt = auditar.indexOf('data-compact-official-detail="true"');
    const compactRegion = auditar.slice(compactAt - 12, auditar.indexOf("handlePrimaryVerdictCta", compactAt));
    expect(compactRegion.match(/<details/g)?.length).toBe(1);
    expect(compactRegion).toContain('data-testid="official-check-card"');
    expect(compactRegion).toContain('data-testid="official-check-hechos"');
    expect(compactRegion).toContain('data-testid="official-check-chat-cta"');
    expect(compactRegion).not.toMatch(/<details[^>]*\sopen/);
    expect(sheet).toContain("hideCaseChips || !officialComparison");
    expect(sheet).toContain("hideCaseChips || !visibleSummary");
  });

  it("el silencio total cabe en cuatro frases y no lleva fichas técnicas", () => {
    const silence = buildInstituteSilencePresentation(["imss", "sat", "infonavit"]);
    const sentences = silence.opener.split(/[.!?]/).filter((part) => part.trim());
    expect(sentences.length).toBeLessThanOrEqual(4);
    expect(sentences.length).toBeGreaterThanOrEqual(3);
    expect(silence.opener).not.toMatch(/\bVivo\b|\bFalló\b|RFC|NSS|certificado/);
    expect(silence.opener).not.toContain(silence.verdict);
    expect(silence.opener).not.toContain("Pedimos la información");
    expect(silence.opener).not.toContain("Tu recibo sí se leyó");
    expect(silence.opener).not.toContain("Vuelve a consultar");
    expect(silence.verdict).not.toMatch(/\bFalló\b|\bVivo\b/);
  });

  it("el caso mixto no pone Vivo ni la fecha en el veredicto", () => {
    const display = resolveOfficialCheckDisplay({
      consentGranted: true,
      summary: {
        configured: true,
        consentGranted: true,
        overallStatus: "no_se_pudo",
        overallLabel: "Sin respuesta",
        overallDetail: "Hoy no hubo respuesta.",
        checkedAt: "2026-09-21T12:00:00.000Z",
        identity: { nss: true, curp: true, rfc: true },
        checks: [],
        chatAnchor: {
          imss: {
            fuente: "imss",
            estado: "failed",
            fecha: "2026-09-21T12:00:00.000Z",
            hechos: ["IMSS en mantenimiento."],
            motivoFallo: "503 mantenimiento",
            missingFields: [],
          },
          sat: {
            fuente: "sat",
            estado: "live",
            fecha: "2026-09-21T12:00:00.000Z",
            hechos: ["RFC: UIPD9211257I0"],
            motivoFallo: null,
            missingFields: [],
          },
          infonavit: {
            fuente: "infonavit",
            estado: "failed",
            fecha: "2026-09-21T12:00:00.000Z",
            hechos: ["Infonavit en mantenimiento."],
            motivoFallo: "503 mantenimiento",
            missingFields: [],
          },
        },
      },
    });

    expect(display.headline).toBe("El SAT contestó; IMSS e Infonavit aún no.");
    expect(display.buttonLabel).toBe("Probar de nuevo mañana");
    expect(display.silence?.sourceLines.join(" ")).toMatch(/UIPD9211257I0/);
    expect(display.headline).not.toMatch(/UIPD|Vivo|Falló/);
  });

  it("deja «Ver detalle» en blanco con tinta oscura, por encima del remap de bg-white", () => {
    expect(result).toMatch(/<details className="ap-result-detail /);
    expect(result).not.toMatch(/<details[^>]*bg-white/);
    expect(auditar).toContain('className="ap-result-detail mt-2"');
    const compactAt = auditar.indexOf('data-compact-official-detail="true"');
    const compactDetail = auditar.slice(compactAt, compactAt + 280);
    expect(compactDetail.startsWith('data-compact-official-detail="true" className="ap-result-detail')).toBe(true);
    expect(compactDetail).not.toContain("bg-white");
    expect(auditar).toContain('className="ap-result-detail mt-3 rounded-[1rem] border border-[#e4e4e4] px-3 py-3"');

    const rule = css.slice(css.indexOf(".ap-result-detail {"));
    expect(rule).toContain("color-scheme: light");
    expect(rule).toContain("--ap-detail-bg: #ffffff");
    expect(rule).toContain("--ap-detail-ink: #161616");
    expect(rule).toContain("--ap-detail-ink-strong: #111111");
    expect(rule).toContain("html.dark .ap-result-detail");
    expect(rule).toContain("background-color: #ffffff !important");
    expect(rule).toContain("color: #161616 !important");
    expect(rule).toContain("color: #111111 !important");
    expect(rule).toContain(".ap-result-detail summary");
    expect(rule).toContain("button.ap-btn-on-dark");
    expect(rule).toContain("color: #ffffff !important");
    expect(rule).not.toMatch(/:is\([^)]*button/);

    expect(contrastRatio([0x16, 0x16, 0x16], [0xff, 0xff, 0xff])).toBeGreaterThan(12);
    expect(contrastRatio([0x11, 0x11, 0x11], [0xff, 0xff, 0xff])).toBeGreaterThan(12);
    expect(contrastRatio([0x16, 0x16, 0x16], [0xf3, 0xfa, 0xf6])).toBeGreaterThan(12);
    expect(contrastRatio([0x16, 0x16, 0x16], [0x0f, 0x17, 0x2a])).toBeLessThan(3);
  });
});

function relativeLuminance(r: number, g: number, b: number) {
  const toLinear = (channel: number) => {
    const next = channel / 255;
    return next <= 0.03928 ? next / 12.92 : ((next + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

function contrastRatio(left: [number, number, number], right: [number, number, number]) {
  const first = relativeLuminance(...left);
  const second = relativeLuminance(...right);
  const lighter = Math.max(first, second);
  const darker = Math.min(first, second);
  return (lighter + 0.05) / (darker + 0.05);
}
