import { describe, expect, it } from "vitest";
import { hasForbiddenWorkerChatClaim } from "./workerChatUx";
import {
  OFFICIAL_FALLBACK_LABEL,
  OFFICIAL_UPLOAD_LABEL,
  OFFICIAL_WORKER_PAGES,
  buildOfficialWorkerAdvisorAnswer,
  decideOfficialVerdict,
  officialVerificationHostAllowed,
  readOfficialWorkerDocumentText,
  selectWorkerDataPath,
  shouldCallThirdPartyFallback,
  shouldOfferOfficialDocumentFallback,
  tagOfficialCheckFuente,
} from "./officialWorkerDocument";

const IMSS_TEXT = [
  "Instituto Mexicano del Seguro Social",
  "Constancia de Semanas Cotizadas",
  "NSS: 12345678901",
  "CURP: GOML800101MDFRRR09",
  "Total de semanas cotizadas: 520",
  "Salario base de cotización: $350.12",
  "Patrón: TALLER NORTE SA DE CV",
  "Registro patronal: Y1234567890",
  "Fecha de alta: 15/01/2018",
  "Fecha de baja: Vigente",
  "https://serviciosdigitales.imss.gob.mx/constancia?nss=12345678901",
].join(" ");

const SAT_TEXT = [
  "CONSTANCIA DE SITUACIÓN FISCAL",
  "SAT",
  "RFC: GOML800101AB1",
  "CURP: GOML800101MDFRRR09",
  "Denominación o razón social: MARIA LOPEZ GARCIA",
  "Estatus en el padrón: ACTIVO",
  "https://siat.sat.gob.mx/app/qr/faces/pages/mobile/validadorqr.jsf?D1=10&D3=GOML800101AB1",
].join(" ");

const INFONAVIT_TEXT = [
  "INFONAVIT - Mi Cuenta - Resumen de movimientos",
  "NSS: 12345678901",
  "Numero de credito: 1234567890",
  "Saldo insoluto: $125000.00",
  "2026-08-15 Aportacion patronal $1250.00",
].join(" ");

describe("consulta instantánea primero", () => {
  it("consulta al momento y solo pide el papel si esa consulta falló", () => {
    expect(selectWorkerDataPath({ hasOfficialDocument: true, instantSourcesFailed: true })).toBe(
      "fuente oficial",
    );
    expect(selectWorkerDataPath({ hasOfficialDocument: false })).toBe("consulta");
    expect(selectWorkerDataPath({ hasOfficialDocument: false, instantSourcesFailed: true })).toBe(
      "pedir_papel",
    );
    expect(shouldCallThirdPartyFallback({ hasOfficialDocument: false, workerCannotProvideDocument: false })).toBe(
      true,
    );
    expect(shouldCallThirdPartyFallback({ hasOfficialDocument: true, workerCannotProvideDocument: true })).toBe(
      false,
    );
    expect(tagOfficialCheckFuente({ sourceRole: null }, true).sourceRole).toBe("respaldo");
    expect(tagOfficialCheckFuente({ sourceRole: null }, false).sourceRole).toBeNull();
  });

  it("lee la constancia del IMSS y solo dice Cumple si la página oficial coincide", () => {
    const pending = readOfficialWorkerDocumentText({ kind: "imss", text: IMSS_TEXT });
    expect(pending.fuente).toBe("fuente oficial");
    expect(pending.nss).toBe("12345678901");
    expect(pending.curp).toBe("GOML800101MDFRRR09");
    expect(pending.semanas).toBe("520");
    expect(pending.salario).toBe("$350.12");
    expect(pending.patrones[0]).toMatchObject({
      nombre: "TALLER NORTE SA DE CV",
      registro: "Y1234567890",
      alta: "15/01/2018",
      baja: "Vigente",
    });
    expect(pending.verdict).toBe("no_pudimos_confirmar");
    expect(pending.verdictLabel).toBe("No pudimos confirmar");
    expect(pending.verificationUrl).toMatch(/imss\.gob\.mx/);

    const verified = readOfficialWorkerDocumentText({ kind: "imss", text: IMSS_TEXT, online: "matched" });
    expect(verified.verdict).toBe("cumple");
    expect(verified.verdictLabel).toBe("Verificado con documento oficial");
    expect(buildOfficialWorkerAdvisorAnswer(verified)).toMatch(/^Verificado con documento oficial\./);
    expect(buildOfficialWorkerAdvisorAnswer(verified)).not.toMatch(/\bCumple\./);
    expect(hasForbiddenWorkerChatClaim(buildOfficialWorkerAdvisorAnswer(verified))).toBe(false);
  });

  it("no inventa Cumple si falta un dato, hay captcha o el PDF no cuadra", () => {
    const thin = readOfficialWorkerDocumentText({
      kind: "imss",
      text: "IMSS constancia de semanas cotizadas",
      online: "matched",
    });
    expect(thin.verdict).toBe("falta_un_dato");
    expect(thin.verdictLabel).toBe("Falta un dato");

    const captcha = readOfficialWorkerDocumentText({ kind: "sat", text: SAT_TEXT, online: "captcha" });
    expect(captcha.rfc).toBe("GOML800101AB1");
    expect(captcha.satNombre).toMatch(/MARIA LOPEZ/);
    expect(captcha.verdict).toBe("no_pudimos_confirmar");

    const edited = readOfficialWorkerDocumentText({
      kind: "sat",
      text: SAT_TEXT,
      online: "matched",
      editSuspicious: true,
    });
    expect(edited.verdict).toBe("no_pudimos_confirmar");

    const otherPerson = readOfficialWorkerDocumentText({
      kind: "sat",
      text: SAT_TEXT,
      online: "matched",
      expected: { rfc: "XAXX010101000" },
    });
    expect(otherPerson.identityMismatch).toBe(false);
    const mismatch = readOfficialWorkerDocumentText({
      kind: "sat",
      text: SAT_TEXT,
      online: "matched",
      expected: { rfc: "LOPM900101AB2" },
    });
    expect(mismatch.identityMismatch).toBe(true);
    expect(mismatch.verdict).toBe("no_pudimos_confirmar");
    expect(buildOfficialWorkerAdvisorAnswer(mismatch)).not.toMatch(/\bCumple\./);
  });

  it("lee Infonavit sin decir que el patrón cumple", () => {
    const reading = readOfficialWorkerDocumentText({ kind: "infonavit", text: INFONAVIT_TEXT });
    expect(reading.fuente).toBe("fuente oficial");
    expect(reading.lines.join(" ")).toContain("1234567890");
    expect(reading.nss).toBe("12345678901");
    expect(reading.verdict).toBe("no_pudimos_confirmar");
    const answer = buildOfficialWorkerAdvisorAnswer(reading, "¿mi pago está bien?");
    expect(answer).toMatch(/Fuente oficial\. No pudimos confirmar\./);
    expect(answer).toMatch(/no digo que tu patrón cumpla/i);
    expect(hasForbiddenWorkerChatClaim(answer)).toBe(false);
  });

  it("un respaldo nunca se presenta como Cumple", () => {
    const reading = readOfficialWorkerDocumentText({ kind: "sat", text: SAT_TEXT, online: "matched" });
    const answer = buildOfficialWorkerAdvisorAnswer({ ...reading, fuente: "respaldo", verdict: "cumple" });
    expect(answer.startsWith("Respaldo.")).toBe(true);
    expect(answer).not.toMatch(/\bCumple\./);
    expect(answer).toMatch(/No pudimos confirmar/);
  });

  it("solo abre páginas https del instituto", () => {
    expect(officialVerificationHostAllowed("https://siat.sat.gob.mx/qr", "sat")).toBe(true);
    expect(officialVerificationHostAllowed("http://siat.sat.gob.mx/qr", "sat")).toBe(false);
    expect(officialVerificationHostAllowed("https://evil-sat.gob.mx.attacker.com/qr", "sat")).toBe(false);
    expect(officialVerificationHostAllowed("https://micuenta.infonavit.org.mx/estado", "infonavit")).toBe(true);
    expect(OFFICIAL_WORKER_PAGES.imss.title).toBe("Pide tu constancia del IMSS");
    expect(OFFICIAL_WORKER_PAGES.infonavit.title).toBe("Descarga tu estado de cuenta de Mi Cuenta Infonavit");
    expect(OFFICIAL_WORKER_PAGES.sat.title).toBe("Tu constancia del SAT (CSF)");
    expect(OFFICIAL_UPLOAD_LABEL).toBe("¿Ya te llegó? Súbela");
    expect(OFFICIAL_FALLBACK_LABEL).toBe("Pide tu constancia aquí (te llega en un minuto), súbela y te la reviso");
    expect(decideOfficialVerdict({
      readable: true,
      missingCore: false,
      identityMismatch: false,
      editSuspicious: false,
      online: "unavailable",
    })).toBe("no_pudimos_confirmar");
    expect(shouldOfferOfficialDocumentFallback({ silence: false, status: "vivo" })).toBe(false);
    expect(shouldOfferOfficialDocumentFallback({ silence: true, status: "vivo" })).toBe(true);
    expect(shouldOfferOfficialDocumentFallback({ status: "no_se_pudo" })).toBe(true);
    expect(shouldOfferOfficialDocumentFallback({ status: "listo" })).toBe(false);
  });
});
