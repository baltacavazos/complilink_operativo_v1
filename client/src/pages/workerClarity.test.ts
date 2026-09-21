import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { buildInstituteSilencePresentation, resolveOfficialCheckDisplay } from "@shared/officialCheckCopy";

const css = readFileSync(new URL("../index.css", import.meta.url), "utf8");
const result = readFileSync(new URL("../components/WorkerOfficialResult.tsx", import.meta.url), "utf8");
const auditar = readFileSync(new URL("./Auditar.tsx", import.meta.url), "utf8");
const sheet = readFileSync(new URL("../components/HeliosCopilotSheet.tsx", import.meta.url), "utf8");

describe("contraste y claridad del resultado", () => {
  it("deja tinta casi negra en superficies claras y blanco solo en botón oscuro", () => {
    expect(css).toContain("--ap-ink: #161616");
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
    expect(result).not.toContain('data-testid="official-check-chat-cta"');
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
    expect(sheet).toContain("hideCaseChips");
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
});
