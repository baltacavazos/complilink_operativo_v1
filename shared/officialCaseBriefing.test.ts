import { describe, expect, it } from "vitest";

import {
  CASE_ADVISOR_FALLO_RULE,
  CASE_ADVISOR_RULE,
  WORKER_CHAT_NO_CONSULTA_EMPTY,
  buildNoLiveOfficialAnswer,
  buildOfficialCaseBriefing,
  buildOfficialChatStarterQuestions,
  buildPayWellFallback,
  formatOfficialCaseBriefingForPrompt,
  isPayWellQuestion,
  formatChatAnchorStatusLine,
  officialIdentityGapDetail,
  selectReceiptOfficialComparison,
} from "./officialCaseBriefing";
import {
  OFFICIAL_CHECK_BUTTON,
  OFFICIAL_CHECK_STATUS_DETAIL,
  OFFICIAL_CHECK_STATUS_LABEL,
  OFFICIAL_FAILED_NEXT_STEP,
  RECEIPT_OFFICIAL_COMPARISON_COPY,
  type OfficialChatAnchor,
  type OfficialCheckSummary,
} from "./officialCheckCopy";

function official(status: OfficialCheckSummary["overallStatus"], extra?: Partial<OfficialCheckSummary>): OfficialCheckSummary {
  return {
    configured: true,
    consentGranted: status !== "sin_permiso",
    overallStatus: status,
    overallLabel: OFFICIAL_CHECK_STATUS_LABEL[status],
    overallDetail: OFFICIAL_CHECK_STATUS_DETAIL[status],
    checkedAt: extra?.checkedAt ?? (status === "sin_permiso" ? null : "2026-09-21T15:30:00.000Z"),
    identity: extra?.identity ?? { nss: true, curp: false, rfc: true },
    checks: extra?.checks ?? [
      {
        source: "imss",
        sourceLabel: "IMSS",
        status,
        label: OFFICIAL_CHECK_STATUS_LABEL[status],
        detail: OFFICIAL_CHECK_STATUS_DETAIL[status],
        checkedAt: "2026-09-21T15:30:00.000Z",
        used: { nss: true, curp: false, rfc: false },
        honesty: status === "vivo" ? "live" : status === "no_se_pudo" ? "failed" : "pending",
        hechos: status === "vivo" ? ["Alta vigente: sí."] : [],
      },
      {
        source: "sat",
        sourceLabel: "SAT",
        status,
        label: OFFICIAL_CHECK_STATUS_LABEL[status],
        detail: OFFICIAL_CHECK_STATUS_DETAIL[status],
        checkedAt: "2026-09-21T15:30:00.000Z",
        used: { nss: false, curp: false, rfc: true },
        honesty: status === "vivo" ? "live" : status === "no_se_pudo" ? "failed" : "pending",
        hechos: [],
      },
    ],
    ...extra,
  };
}

const liveAnchor: OfficialChatAnchor = {
  imss: {
    fuente: "imss",
    estado: "live",
    fecha: "2026-09-21T15:30:00.000Z",
    hechos: ["Alta vigente: sí.", "Salario registrado: $450.25."],
    motivoFallo: null,
  },
  sat: {
    fuente: "sat",
    estado: "pending",
    fecha: "2026-09-21T15:30:00.000Z",
    hechos: ["Todavía no hay una respuesta oficial nueva de SAT."],
    motivoFallo: null,
  },
  infonavit: {
    fuente: "infonavit",
    estado: "failed",
    fecha: "2026-09-21T15:30:00.000Z",
    hechos: ["Infonavit no respondió en esta consulta."],
    motivoFallo: "Infonavit está en mantenimiento.",
  },
};

describe("briefing del caso para el asesor", () => {
  it("reconoce ¿me pagan bien? y ancla a recibo + consulta", () => {
    expect(isPayWellQuestion("¿me pagan bien?")).toBe(true);
    expect(isPayWellQuestion("¿Qué dice mi recibo?")).toBe(false);

    const without = buildPayWellFallback(
      buildOfficialCaseBriefing({
        officialCheck: official("sin_permiso", { checkedAt: null, checks: [] }),
        facts: { netAmount: "$8,420", imssWithheld: "$120.50", nss: "12345678901" },
      }),
    );
    expect(without.clearAnswer).toBe(WORKER_CHAT_NO_CONSULTA_EMPTY);
    expect(without.clearAnswer).toMatch(/resultado de TU consulta/);
    expect(without.nextStep).toBe(OFFICIAL_CHECK_BUTTON);
    expect(without.clearAnswer).not.toMatch(/Helios|CompliLink|HMAC|\bcumple\b/i);

    const withConsulta = buildPayWellFallback(
      buildOfficialCaseBriefing({
        officialCheck: official("vivo", {
          chatAnchor: liveAnchor,
          reciboVsOficial: { resultado: "bien", motivo: "coinciden" },
        }),
        facts: { netAmount: "$8,420", imssWithheld: "$120.50", period: "1 al 15 de mayo" },
        reciboVsOficial: { resultado: "bien", motivo: "coinciden" },
      }),
    );
    expect(withConsulta.clearAnswer).toContain(RECEIPT_OFFICIAL_COMPARISON_COPY.bien.seenLine);
    expect(withConsulta.clearAnswer).toMatch(/IMSS: Vivo · 21\/09\/2026/);
    expect(withConsulta.clearAnswer).toMatch(/\$8,420/);
    expect(withConsulta.clearAnswer).toMatch(/no significa que tu patrón esté al corriente/i);
    expect(withConsulta.clearAnswer).not.toMatch(/Helios|CompliLink|HMAC/i);
  });

  it("si faltan NSS, CURP y RFC, dice qué falta y no inventa consulta", () => {
    expect(officialIdentityGapDetail({ nss: false, curp: false, rfc: false })).toBe(
      "Falta tu NSS, CURP y RFC en el recibo para consultar.",
    );
    expect(officialIdentityGapDetail({ nss: true, curp: false, rfc: false })).toBe(
      "Falta tu CURP y RFC en el recibo para consultar.",
    );
    expect(officialIdentityGapDetail({ nss: true, curp: true, rfc: false })).toBe(
      "Falta tu RFC en el recibo para consultar.",
    );

    const pendingMissing = buildOfficialCaseBriefing({
      officialCheck: official("pendiente", {
        identity: { nss: false, curp: true, rfc: true },
        chatAnchor: {
          imss: {
            fuente: "imss",
            estado: "pending",
            fecha: "2026-09-21T15:30:00.000Z",
            hechos: ["Falta el NSS para consultar IMSS."],
            motivoFallo: null,
            missingFields: ["nss"],
          },
          sat: {
            fuente: "sat",
            estado: "pending",
            fecha: "2026-09-21T15:30:00.000Z",
            hechos: ["Todavía no hay una respuesta oficial nueva de SAT."],
            motivoFallo: null,
            missingFields: [],
          },
          infonavit: {
            fuente: "infonavit",
            estado: "pending",
            fecha: "2026-09-21T15:30:00.000Z",
            hechos: ["Falta el NSS para consultar Infonavit."],
            motivoFallo: null,
            missingFields: ["nss"],
          },
        },
      }),
      facts: { curp: "DILE970625HBCZPM01", workerRfc: "VECJ880326XXX" },
    });
    expect(pendingMissing.statusLines.some((line) => /IMSS: Faltan datos · 21\/09\/2026/.test(line))).toBe(true);
    expect(pendingMissing.missingIdentity).toEqual(["NSS"]);
    expect(pendingMissing.missingIdentityDetail).toBe("Falta tu NSS en el recibo para consultar.");
    expect(pendingMissing.comparison.seenLine).toBe("Esto vimos: no se pudo");
    expect(pendingMissing.comparison.nextStepLine).toMatch(/^Qué hacer ahora:/);

    const noResponse = formatChatAnchorStatusLine(
      {
        fuente: "imss",
        estado: "pending",
        fecha: null,
        hechos: ["IMSS no respondió en esta consulta."],
        motivoFallo: "IMSS no respondió en esta consulta.",
      },
      "2026-09-21T12:00:00.000Z",
    );
    expect(noResponse).toMatch(/IMSS: Falló · 21\/09\/2026/);
    expect(noResponse).toMatch(/no contestó/);
    expect(noResponse).toMatch(/no de AuditaPatrón/);
    expect(noResponse).not.toMatch(/respuesta usable|fallo de AuditaPatrón/i);

    const comparison = selectReceiptOfficialComparison({
      officialCheck: official("sin_datos", {
        identity: { nss: false, curp: false, rfc: false },
        checks: [],
      }),
      facts: {},
    });
    expect(comparison.hasOfficialConsulta).toBe(true);
    expect(comparison.seenLine).toBe(RECEIPT_OFFICIAL_COMPARISON_COPY.no_se_pudo.seenLine);
    expect(comparison.nextStep).toBe(RECEIPT_OFFICIAL_COMPARISON_COPY.no_se_pudo.nextStep);
  });

  it("recibo con NSS y RFC sin CURP no marca IMSS/SAT como Faltan datos", () => {
    const briefing = buildOfficialCaseBriefing({
      officialCheck: official("pendiente", {
        identity: { nss: true, curp: false, rfc: true },
        checks: [
          {
            source: "imss",
            sourceLabel: "IMSS",
            status: "pendiente",
            label: OFFICIAL_CHECK_STATUS_LABEL.pendiente,
            detail: OFFICIAL_CHECK_STATUS_DETAIL.pendiente,
            checkedAt: "2026-09-21T15:30:00.000Z",
            used: { nss: true, curp: false, rfc: false },
            honesty: "pending",
            hechos: [],
            missingFields: [],
          },
          {
            source: "sat",
            sourceLabel: "SAT",
            status: "pendiente",
            label: OFFICIAL_CHECK_STATUS_LABEL.pendiente,
            detail: OFFICIAL_CHECK_STATUS_DETAIL.pendiente,
            checkedAt: "2026-09-21T15:30:00.000Z",
            used: { nss: false, curp: false, rfc: true },
            honesty: "pending",
            hechos: [],
            missingFields: [],
          },
          {
            source: "infonavit",
            sourceLabel: "Infonavit",
            status: "sin_datos",
            label: OFFICIAL_CHECK_STATUS_LABEL.sin_datos,
            detail: "Falta tu CURP en el recibo para consultar.",
            checkedAt: "2026-09-21T15:30:00.000Z",
            used: { nss: false, curp: false, rfc: false },
            honesty: "failed",
            hechos: ["Falta el CURP para consultar Infonavit."],
            missingFields: ["curp"],
          },
        ],
        chatAnchor: {
          imss: {
            fuente: "imss",
            estado: "pending",
            fecha: "2026-09-21T15:30:00.000Z",
            hechos: ["Todavía no hay una respuesta oficial nueva de IMSS."],
            motivoFallo: null,
            missingFields: [],
          },
          sat: {
            fuente: "sat",
            estado: "pending",
            fecha: "2026-09-21T15:30:00.000Z",
            hechos: ["Todavía no hay una respuesta oficial nueva de SAT."],
            motivoFallo: null,
            missingFields: [],
          },
          infonavit: {
            fuente: "infonavit",
            estado: "pending",
            fecha: "2026-09-21T15:30:00.000Z",
            hechos: ["Falta el CURP para consultar Infonavit."],
            motivoFallo: null,
            missingFields: ["curp"],
          },
        },
        reciboVsOficial: { resultado: "no_se_pudo", motivo: "Infonavit sin CURP." },
      }),
      facts: { nss: "12345678901", workerRfc: "VECJ880326XXX", netAmount: "$12,450" },
    });

    expect(briefing.missingIdentity).toEqual(["CURP"]);
    expect(briefing.missingIdentityDetail).toBe("Falta tu CURP en el recibo para consultar.");
    expect(briefing.statusLines.some((line) => /IMSS: Pendiente/.test(line))).toBe(true);
    expect(briefing.statusLines.some((line) => /SAT: Pendiente/.test(line))).toBe(true);
    expect(briefing.statusLines.some((line) => /Infonavit: Faltan datos/.test(line))).toBe(true);
    expect(briefing.statusLines.some((line) => /IMSS: Faltan datos/.test(line))).toBe(false);
    expect(briefing.statusLines.some((line) => /SAT: Faltan datos/.test(line))).toBe(false);
    expect(briefing.hasOfficialConsulta).toBe(true);
    expect(briefing.reciboVsOficial?.resultado).toBe("no_se_pudo");
    expect(briefing.receiptLines.join(" ")).toMatch(/NSS 12345678901/);
    expect(briefing.receiptLines.join(" ")).toMatch(/VECJ880326XXX/);
    expect(JSON.stringify(briefing)).not.toMatch(/Helios|CompliLink|HMAC|\bcumple\b/i);
  });

  it("usa reciboVsOficial del puente y no inventa bien", () => {
    const bien = selectReceiptOfficialComparison({
      officialCheck: official("vivo", { chatAnchor: liveAnchor }),
      facts: {},
      reciboVsOficial: "bien",
    });
    expect(bien.seenLine).toBe("Esto vimos: bien");
    expect(bien.nextStep).toBe("Guarda este resultado con la fecha.");
    expect(bien.nextStepLine).toBe("Qué hacer ahora: Guarda este resultado con la fecha.");

    const diff = selectReceiptOfficialComparison({
      officialCheck: official("vivo", { chatAnchor: liveAnchor }),
      facts: {},
      reciboVsOficial: { resultado: "hay_diferencia", motivo: "SBC distinto" },
    });
    expect(diff.seenLine).toBe("Esto vimos: hay diferencia");
    expect(diff.nextStep).toMatch(/Anota periodo y montos/);
    expect(diff.nextStepLine).toMatch(/^Qué hacer ahora:/);

    const unknown = selectReceiptOfficialComparison({
      officialCheck: official("vivo", { chatAnchor: liveAnchor }),
      facts: {},
      reciboVsOficial: null,
    });
    expect(unknown.seenLine).toBe(RECEIPT_OFFICIAL_COMPARISON_COPY.no_se_pudo.seenLine);
    expect(unknown.seen).toBe("no_se_pudo");

    const failedInstitute = selectReceiptOfficialComparison({
      officialCheck: official("no_se_pudo"),
      facts: { nss: "12345678901" },
    });
    expect(failedInstitute.hasOfficialConsulta).toBe(true);
    expect(failedInstitute.nextStep).toBe(OFFICIAL_FAILED_NEXT_STEP);
    expect(failedInstitute.nextStepLine).toMatch(/Qué hacer ahora:/);
    expect(failedInstitute.nextStep).toMatch(/no de AuditaPatrón/);
    expect(failedInstitute.nextStep).not.toMatch(/Da permiso|cruza/i);
  });

  it("el prompt forzado cita chatAnchor y prohíbe inventar cumple", () => {
    const briefing = buildOfficialCaseBriefing({
      officialCheck: official("vivo", { chatAnchor: liveAnchor }),
      chatAnchor: liveAnchor,
      facts: { netAmount: "$4,200", nss: "12345678901" },
      reciboVsOficial: { resultado: "hay_diferencia", motivo: "SBC" },
    });
    const prompt = formatOfficialCaseBriefingForPrompt(briefing);
    expect(prompt).toContain(CASE_ADVISOR_RULE);
    expect(prompt).toMatch(/IMSS: Vivo · 21\/09\/2026/);
    expect(prompt).toMatch(/Alta vigente: sí/);
    expect(prompt).toMatch(/Esto vimos: hay diferencia/);
    expect(prompt).toMatch(/Qué hacer ahora:/);
    expect(prompt).toMatch(/neto \$4,200/);
    expect(prompt).toMatch(/Nunca inventes: cumple, alta vigente, salario oficial/);
    expect(prompt).toContain(CASE_ADVISOR_FALLO_RULE);
    expect(prompt).not.toMatch(/Helios|CompliLink|HMAC|jurisprudencia|DOF|SCJN/i);
    expect(briefing.hasLiveOfficialResult).toBe(true);
    expect(buildOfficialChatStarterQuestions(briefing)).toContain("¿Hay diferencia con mi recibo?");
  });

  it("sin resultado vivo da una frase y el CTA Consultar", () => {
    const blocked = buildNoLiveOfficialAnswer(
      buildOfficialCaseBriefing({
        officialCheck: official("sin_permiso", { checkedAt: null, checks: [] }),
        facts: {},
      }),
    );
    expect(blocked.clearAnswer).toBe(WORKER_CHAT_NO_CONSULTA_EMPTY);
    expect(blocked.nextStep).toBe(OFFICIAL_CHECK_BUTTON);
    expect(buildOfficialChatStarterQuestions(buildOfficialCaseBriefing({}))).toEqual([]);

    const failed = buildNoLiveOfficialAnswer(
      buildOfficialCaseBriefing({
        officialCheck: official("no_se_pudo", {
          identity: { nss: true, curp: true, rfc: true },
        }),
        facts: { nss: "12345678901", curp: "DILE970625HBCZPM01", workerRfc: "VECJ880326XXX" },
      }),
    );
    expect(failed.clearAnswer).toMatch(/Falló/);
    expect(failed.clearAnswer).toMatch(/instituto|IMSS|SAT|Infonavit/);
    expect(failed.clearAnswer).toMatch(/no de AuditaPatrón/);
    expect(failed.clearAnswer).not.toMatch(/respuesta usable|tip|cruza el descuento/i);
    expect(failed.nextStep).toBe(OFFICIAL_FAILED_NEXT_STEP);
    expect(failed.missing).toMatch(/no de AuditaPatrón/);
  });
});
