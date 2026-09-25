import { describe, expect, it } from "vitest";
import {
  INFONAVIT_DOCUMENT_CTA,
  INFONAVIT_DOCUMENT_ORIGIN_LINE,
  INFONAVIT_DOCUMENT_STEPS,
  INFONAVIT_DOCUMENT_UNREADABLE,
  INFONAVIT_DOCUMENT_UPLOAD_LABEL,
  INFONAVIT_MICUENTA_URL,
  infonavitDocumentCopyIsHonest,
  readInfonavitMiCuentaText,
  shouldOfferInfonavitDocumentUpload,
} from "./infonavitMiCuentaDocument";
import { OFFICIAL_CHECK_STATUS_LABEL, type OfficialCheckSummary, type OfficialSourceCheck } from "./officialCheckCopy";

const FIXTURE_TEXT = [
  "INFONAVIT - Mi Cuenta - Resumen de movimientos",
  "DOCUMENTO DE PRUEBA SINTETICO - NO OFICIAL",
  "Nombre: TRABAJADOR PRUEBA AUDITAPATRON",
  "NSS: 00000000000",
  "Numero de credito: 1234567890",
  "Saldo insoluto: $125000.00",
  "Saldo subcuenta vivienda: $18450.50",
  "2026-08-15 Aportacion patronal $1250.00",
  "2026-07-15 Aportacion patronal $1250.00",
  "Fixture AuditaPatron. No prueba que el patron cumpla.",
].join(" ");

function check(partial: Partial<OfficialSourceCheck> & Pick<OfficialSourceCheck, "source" | "status">): OfficialSourceCheck {
  return {
    sourceLabel: partial.source === "sat" ? "SAT" : partial.source === "imss" ? "IMSS" : "Infonavit",
    label: OFFICIAL_CHECK_STATUS_LABEL[partial.status],
    detail: "",
    checkedAt: "2026-09-23T18:00:00.000Z",
    used: { nss: partial.source === "imss", curp: partial.source === "infonavit", rfc: partial.source === "sat" },
    honesty: partial.status === "vivo" ? "live" : partial.status === "no_se_pudo" ? "failed" : "pending",
    hechos: [],
    ...partial,
  };
}

function summary(partial: Partial<OfficialCheckSummary>): OfficialCheckSummary {
  return {
    configured: true,
    consentGranted: true,
    overallStatus: "no_se_pudo",
    overallLabel: OFFICIAL_CHECK_STATUS_LABEL.no_se_pudo,
    overallDetail: "Hoy no pudimos consultar Infonavit.",
    checkedAt: "2026-09-23T18:00:00.000Z",
    identity: { nss: true, curp: true, rfc: true },
    checks: [],
    ...partial,
  };
}

function publicCopy(text: string) {
  const reading = readInfonavitMiCuentaText(text);
  return [reading.notice, reading.originLine, reading.shield ?? "", ...reading.lines].join("\n");
}

describe("Infonavit Mi Cuenta — copy y CTA", () => {
  it("cita crédito, saldos y aportaciones con origen de documento", () => {
    const reading = readInfonavitMiCuentaText(FIXTURE_TEXT);

    expect(reading.origin).toBe("document");
    expect(reading.source).toBe("user_upload");
    expect(reading.readable).toBe(true);
    expect(reading.facts.every((fact) => fact.origin === "document" && fact.source === "user_upload")).toBe(true);
    expect(reading.lines.join(" ")).toContain("En el documento que subiste aparece el crédito 1234567890.");
    expect(reading.lines.join(" ")).toContain("saldo insoluto $125000.00");
    expect(reading.lines.join(" ")).toContain("saldo subcuenta vivienda $18450.50");
    expect(reading.lines.join(" ")).toContain("aportación patronal $1250.00 · fecha 2026-08-15");
    expect(reading.lines.join(" ")).toContain("aportación patronal $1250.00 · fecha 2026-07-15");
    expect(reading.lines.join(" ")).not.toContain("00000000000");
    expect(reading.originLine).toBe(INFONAVIT_DOCUMENT_ORIGIN_LINE);
    expect(reading.notice).toBe(INFONAVIT_DOCUMENT_ORIGIN_LINE);
  });

  it("el copy del documento no dice cumple, Bien, al corriente ni consulta en vivo", () => {
    const copy = [
      INFONAVIT_DOCUMENT_CTA,
      INFONAVIT_DOCUMENT_STEPS,
      INFONAVIT_DOCUMENT_UPLOAD_LABEL,
      publicCopy(FIXTURE_TEXT),
      INFONAVIT_DOCUMENT_UNREADABLE,
    ].join("\n");
    expect(INFONAVIT_DOCUMENT_UPLOAD_LABEL).toBe("Subir PDF de Mi Cuenta");
    expect(INFONAVIT_DOCUMENT_STEPS).toBe("(1) Baja el PDF en Mi Cuenta (2) Súbelo aquí.");

    expect(infonavitDocumentCopyIsHonest(copy)).toBe(true);
    expect(copy).not.toMatch(/consulta en vivo/i);
    expect(copy).not.toMatch(/al corriente/i);
    expect(copy).not.toMatch(/\bBien\b/);
    expect(copy).not.toMatch(/tu patr[oó]n cumple\b/i);
    expect(copy).not.toMatch(/ApiMarket|Nufi|Syntage/i);
    expect(copy).toMatch(/documento que subiste/);
    expect(INFONAVIT_MICUENTA_URL).toBe("https://micuenta.infonavit.org.mx");
  });

  it("si el PDF no se lee, hay silencio y cero cifras", () => {
    const reading = readInfonavitMiCuentaText("   ");

    expect(reading.readable).toBe(false);
    expect(reading.origin).toBe("document");
    expect(reading.facts).toEqual([]);
    expect(reading.lines).toEqual([]);
    expect(reading.notice).toBe(INFONAVIT_DOCUMENT_UNREADABLE);
    expect(reading.notice).not.toMatch(/\$\d/);
    expect(reading.shield).toBeNull();
  });

  it("ofrece el PDF solo cuando Infonavit quedó sin hecho usable", () => {
    expect(shouldOfferInfonavitDocumentUpload(null)).toBe(false);
    expect(
      shouldOfferInfonavitDocumentUpload(
        summary({
          checks: [check({ source: "infonavit", status: "no_se_pudo", honesty: "failed", hechos: [] })],
        }),
      ),
    ).toBe(true);
    expect(
      shouldOfferInfonavitDocumentUpload(
        summary({
          overallStatus: "vivo",
          checks: [
            check({ source: "sat", status: "vivo", honesty: "live", hechos: ["Nombre en el SAT: EJEMPLO SA"] }),
            check({ source: "infonavit", status: "no_se_pudo", honesty: "failed", hechos: [] }),
          ],
        }),
      ),
    ).toBe(true);
    expect(
      shouldOfferInfonavitDocumentUpload(
        summary({
          overallStatus: "vivo",
          checks: [
            check({
              source: "infonavit",
              status: "vivo",
              honesty: "live",
              hechos: ["Crédito 1234567890"],
            }),
          ],
        }),
      ),
    ).toBe(false);
    expect(
      shouldOfferInfonavitDocumentUpload(
        summary({
          overallStatus: "pendiente",
          checks: [check({ source: "infonavit", status: "pendiente", honesty: "pending", hechos: [] })],
        }),
      ),
    ).toBe(false);
  });
});
