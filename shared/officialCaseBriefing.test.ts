import { describe, expect, it } from "vitest";

import {
  CASE_ADVISOR_FALLO_RULE,
  CASE_ADVISOR_RULE,
  WORKER_CHAT_NO_CONSULTA_EMPTY,
  alignVisibleChatWithBriefing,
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
  INSTITUTE_SILENCE_NEXT,
  OFFICIAL_CHECK_BUTTON,
  OFFICIAL_CHECK_STATUS_DETAIL,
  OFFICIAL_CHECK_STATUS_LABEL,
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

function promptWithoutForbidRule(prompt: string) {
  return prompt
    .split("\n")
    .filter((line) => !/PROHIBIDO escribir/.test(line))
    .join("\n");
}

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
      nowMs: Date.parse("2026-09-21T15:30:20.000Z"),
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
    expect(noResponse).toBe("IMSS — sin respuesta hoy");
    expect(noResponse).not.toMatch(/no de AuditaPatrón|Falló/);
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
      nowMs: Date.parse("2026-09-21T15:30:30.000Z"),
    });

    expect(briefing.missingIdentity).toEqual(["CURP"]);
    expect(briefing.missingIdentityDetail).toBe("Falta tu CURP en el recibo para consultar Infonavit.");
    expect(briefing.statusLines.some((line) => line === "IMSS — esperando hoy")).toBe(true);
    expect(briefing.statusLines.some((line) => line === "SAT — esperando hoy")).toBe(true);
    expect(briefing.statusLines.some((line) => /Infonavit: Faltan datos/.test(line))).toBe(true);
    expect(briefing.statusLines.some((line) => /IMSS: Faltan datos/.test(line))).toBe(false);
    expect(briefing.statusLines.some((line) => /SAT: Faltan datos/.test(line))).toBe(false);
    expect(briefing.hasOfficialConsulta).toBe(true);
    expect(briefing.reciboVsOficial?.resultado).toBe("no_se_pudo");
    expect(briefing.receiptLines.join(" ")).toMatch(/NSS en recibo: 12345678901/);
    expect(briefing.receiptLines.join(" ")).toMatch(/VECJ880326XXX/);
    expect(JSON.stringify(briefing)).not.toMatch(/Helios|CompliLink|HMAC|\bcumple\b/i);
  });

  it("recibo con NSS y RFC visibles nunca pinta Faltan datos mentiroso en tarjeta ni chat", () => {
    const briefing = buildOfficialCaseBriefing({
      officialCheck: official("sin_datos", {
        identity: { nss: false, curp: false, rfc: false },
        overallDetail: "Falta tu NSS, CURP o RFC en el recibo para consultar.",
        checks: [
          {
            source: "imss",
            sourceLabel: "IMSS",
            status: "sin_datos",
            label: "Faltan datos",
            detail: "Falta tu NSS, CURP o RFC en el recibo para consultar.",
            checkedAt: "2026-09-21T15:30:00.000Z",
            used: { nss: false, curp: false, rfc: false },
            honesty: "failed",
            hechos: ["Falta tu NSS, CURP o RFC en el recibo para consultar."],
            missingFields: ["nss", "curp", "rfc"],
          },
          {
            source: "sat",
            sourceLabel: "SAT",
            status: "sin_datos",
            label: "Faltan datos",
            detail: "Falta tu NSS, CURP o RFC en el recibo para consultar.",
            checkedAt: "2026-09-21T15:30:00.000Z",
            used: { nss: false, curp: false, rfc: false },
            honesty: "failed",
            hechos: ["Falta tu NSS, CURP o RFC en el recibo para consultar."],
            missingFields: ["nss", "curp", "rfc"],
          },
          {
            source: "infonavit",
            sourceLabel: "Infonavit",
            status: "sin_datos",
            label: "Faltan datos",
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
            estado: "failed",
            fecha: "2026-09-21T15:30:00.000Z",
            hechos: ["Falta tu NSS, CURP o RFC en el recibo para consultar."],
            motivoFallo: "Falta tu NSS, CURP o RFC en el recibo para consultar.",
            missingFields: ["nss", "curp", "rfc"],
          },
          sat: {
            fuente: "sat",
            estado: "failed",
            fecha: "2026-09-21T15:30:00.000Z",
            hechos: ["Falta tu NSS, CURP o RFC en el recibo para consultar."],
            motivoFallo: "Falta tu NSS, CURP o RFC en el recibo para consultar.",
            missingFields: ["nss", "curp", "rfc"],
          },
          infonavit: {
            fuente: "infonavit",
            estado: "failed",
            fecha: "2026-09-21T15:30:00.000Z",
            hechos: ["Falta el CURP para consultar Infonavit."],
            motivoFallo: "Falta el CURP para consultar Infonavit.",
            missingFields: ["curp"],
          },
        },
      }),
      facts: { nss: "12345678901", workerRfc: "XAXX010101000", netAmount: "$12,450" },
      nowMs: Date.parse("2026-09-21T15:30:30.000Z"),
    });

    expect(briefing.receiptLines.join(" ")).toMatch(/NSS en recibo: 12345678901/);
    expect(briefing.receiptLines.join(" ")).toMatch(/XAXX010101000/);
    expect(briefing.officialCheck?.overallStatus).not.toBe("sin_datos");
    expect(briefing.officialCheck?.overallLabel).not.toBe("Faltan datos");
    expect(briefing.headline).not.toMatch(/Faltan datos/i);
    expect(briefing.statusLines.some((line) => /IMSS: Faltan datos/.test(line))).toBe(false);
    expect(briefing.statusLines.some((line) => /IMSS y SAT: Faltan datos/.test(line))).toBe(false);
    expect(briefing.statusLines.some((line) => /IMSS — esperando hoy|IMSS — sin respuesta hoy|IMSS: Vivo/.test(line))).toBe(true);
    expect(briefing.statusLines.some((line) => /SAT: Faltan datos/.test(line))).toBe(true);
    expect(briefing.statusLines.some((line) => /Infonavit: Faltan datos/.test(line))).toBe(true);
    expect(briefing.missingIdentity).toEqual(["CURP", "RFC"]);
    expect(briefing.missingIdentityDetail).toMatch(/RFC(?: real)?/i);
    expect(briefing.missingIdentityDetail).not.toMatch(/Falta tu NSS/);
    const prompt = formatOfficialCaseBriefingForPrompt(briefing);
    expect(promptWithoutForbidRule(prompt)).not.toMatch(/Falta tu NSS/);
    expect(prompt).not.toMatch(/IMSS: Faltan datos/);
    expect(prompt).not.toMatch(/IMSS y SAT: Faltan datos/);
    expect(prompt).toMatch(/NSS en recibo: 12345678901/);
    expect(prompt).toMatch(/PROHIBIDO escribir «Falta tu NSS»/);
    expect(prompt).toMatch(/IMSS — esperando hoy|IMSS — sin respuesta hoy|IMSS: Vivo/);
    expect(prompt).toMatch(/SAT: Faltan datos|RFC real|RFC del recibo es genérico/);
    expect(JSON.stringify(briefing)).not.toMatch(/Helios|CompliLink|HMAC|\bcumple\b/i);
  });

  it("summary viejo sin checks no dice IMSS y SAT: Faltan datos si el recibo ya tiene NSS", () => {
    const briefing = buildOfficialCaseBriefing({
      officialCheck: official("sin_datos", {
        identity: { nss: false, curp: false, rfc: false },
        overallDetail: "Falta tu NSS, CURP y RFC en el recibo para consultar.",
        checks: [],
        chatAnchor: null,
      }),
      facts: { nss: "12345678901", workerRfc: "XAXX010101000", netAmount: "$12,450" },
      nowMs: Date.parse("2026-09-21T15:30:30.000Z"),
    });
    const prompt = formatOfficialCaseBriefingForPrompt(briefing);
    const answer = buildNoLiveOfficialAnswer(briefing);
    expect(briefing.statusLines.join(" ")).not.toMatch(/IMSS y SAT: Faltan datos/);
    expect(briefing.statusLines.some((line) => /IMSS: Faltan datos/.test(line))).toBe(false);
    expect(briefing.statusLines.some((line) => line === "IMSS — esperando hoy")).toBe(true);
    expect(promptWithoutForbidRule(prompt)).not.toMatch(/Falta tu NSS/);
    expect(prompt).toMatch(/NSS en recibo: 12345678901/);
    expect(prompt).toMatch(/PROHIBIDO escribir «Falta tu NSS»/);
    expect(answer.clearAnswer).not.toMatch(/Falta tu NSS/);
    expect(answer.missing).not.toMatch(/Falta tu NSS/);
    expect(answer.clearAnswer).not.toMatch(/IMSS y SAT: Faltan datos/);
    expect(JSON.stringify({ briefing, prompt, answer })).not.toMatch(/Helios|CompliLink|HMAC/i);
    expect(prompt).toMatch(/No inventes que el patr[oó]n cumple|Nunca inventes cumple/);
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
    expect(failedInstitute.seenLine).toMatch(/Hoy no pudimos confirmar/);
    expect(failedInstitute.seenLine).not.toMatch(/Esto vimos/);
    expect(failedInstitute.nextStep).toBe(INSTITUTE_SILENCE_NEXT);
    expect(failedInstitute.nextStepLine).toMatch(/Qué hacer ahora:/);
    expect(failedInstitute.nextStep).not.toMatch(/no de AuditaPatrón|Falló/);
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
    expect(failed.clearAnswer).toMatch(/Hoy pedimos datos a IMSS y SAT y no contestaron/);
    expect(failed.clearAnswer).not.toMatch(/Respuesta clara|Lo que sí se sabe|Falló|no de AuditaPatrón/);
    expect(failed.clearAnswer).not.toMatch(/respuesta usable|tip|cruza el descuento|cumple/i);
    expect(failed.nextStep).toBe(INSTITUTE_SILENCE_NEXT);
    expect(failed.missing).not.toMatch(/no de AuditaPatrón/);
  });

  it("NSS 12345678901 en lastUpload hace imposible «Falta tu NSS y RFC en el recibo para consultar.»", () => {
    const briefing = buildOfficialCaseBriefing({
      officialCheck: official("sin_datos", {
        identity: { nss: false, curp: false, rfc: false },
        overallDetail: "Falta tu NSS y RFC en el recibo para consultar.",
        checks: [],
        chatAnchor: null,
      }),
      facts: { nss: "12345678901", workerRfc: "XAXX010101000", netAmount: "$12,450" },
      nowMs: Date.parse("2026-09-21T15:30:30.000Z"),
    });
    const prompt = formatOfficialCaseBriefingForPrompt(briefing);
    const claims = promptWithoutForbidRule(prompt);
    expect(briefing.facts.nss).toBe("12345678901");
    expect(briefing.missingIdentity).not.toContain("NSS");
    expect(briefing.missingIdentityDetail).not.toBe("Falta tu NSS y RFC en el recibo para consultar.");
    expect(briefing.missingIdentityDetail).not.toMatch(/Falta tu NSS/);
    expect(briefing.receiptLines).toContain("NSS en recibo: 12345678901");
    expect(claims).not.toMatch(/Falta tu NSS/);
    expect(claims).not.toContain("Falta tu NSS y RFC en el recibo para consultar.");
    expect(prompt).toMatch(/Hecho fijo del recibo: NSS en recibo: 12345678901/);
    expect(prompt).toMatch(/PROHIBIDO escribir «Falta tu NSS»/);
    expect(JSON.stringify(briefing)).not.toContain("Falta tu NSS y RFC en el recibo para consultar.");
  });

  it("Pendiente sin acuse por más de 60s en el briefing pasa a Falló", () => {
    const started = "2026-09-21T15:30:00.000Z";
    const briefing = buildOfficialCaseBriefing({
      officialCheck: official("pendiente", {
        checkedAt: started,
        identity: { nss: true, curp: false, rfc: false },
        checks: [
          {
            source: "imss",
            sourceLabel: "IMSS",
            status: "pendiente",
            label: OFFICIAL_CHECK_STATUS_LABEL.pendiente,
            detail: OFFICIAL_CHECK_STATUS_DETAIL.pendiente,
            checkedAt: started,
            used: { nss: true, curp: false, rfc: false },
            honesty: "pending",
            hechos: [],
          },
        ],
        chatAnchor: {
          imss: {
            fuente: "imss",
            estado: "pending",
            fecha: started,
            hechos: ["Todavía no hay una respuesta oficial nueva de IMSS."],
            motivoFallo: null,
          },
          sat: {
            fuente: "sat",
            estado: "pending",
            fecha: started,
            hechos: ["Todavía no hay una respuesta oficial nueva de SAT."],
            motivoFallo: null,
          },
          infonavit: {
            fuente: "infonavit",
            estado: "pending",
            fecha: started,
            hechos: ["Todavía no hay una respuesta oficial nueva de Infonavit."],
            motivoFallo: null,
          },
        },
      }),
      facts: { nss: "12345678901", workerRfc: "XAXX010101000" },
      nowMs: new Date(started).getTime() + 70_000,
    });
    expect(briefing.officialCheck?.overallStatus).toBe("no_se_pudo");
    expect(briefing.statusLines.some((line) => line === "IMSS — sin respuesta hoy")).toBe(true);
    expect(briefing.statusLines.some((line) => /Pendiente|Falló|no de AuditaPatrón/.test(line))).toBe(false);
    expect(briefing.missingIdentityDetail).not.toMatch(/Falta tu NSS/);
  });

  it("el reloj de la tarjeta pasa Pendiente a Falló aunque no haya checkedAt", () => {
    const started = new Date("2026-09-21T15:30:00.000Z").getTime();
    const briefing = buildOfficialCaseBriefing({
      officialCheck: official("pendiente", {
        checkedAt: null,
        identity: { nss: true, curp: false, rfc: false },
        checks: [
          {
            source: "imss",
            sourceLabel: "IMSS",
            status: "pendiente",
            label: OFFICIAL_CHECK_STATUS_LABEL.pendiente,
            detail: OFFICIAL_CHECK_STATUS_DETAIL.pendiente,
            checkedAt: null,
            used: { nss: true, curp: false, rfc: false },
            honesty: "pending",
            hechos: [],
          },
        ],
        chatAnchor: null,
      }),
      facts: { nss: "84129214965" },
      nowMs: started + 70_000,
      pendingSinceMs: started,
    });
    expect(briefing.officialCheck?.checks.find((item) => item.source === "imss")?.status).toBe("no_se_pudo");
    expect(briefing.statusLines.some((line) => line === "IMSS — sin respuesta hoy")).toBe(true);
    expect(briefing.statusLines.some((line) => /Pendiente|Falló/.test(line))).toBe(false);
    expect(briefing.instituteSilence).toBe(true);
    expect(briefing.comparison.seenLine).toMatch(/Hoy no pudimos confirmar/);
    expect(briefing.statusLines.join(" ")).not.toMatch(/no de AuditaPatrón|Esto vimos: bien/);
    expect(briefing.statusLines.join(" ")).not.toMatch(/Falta tu NSS/);
    expect(JSON.stringify(briefing.statusLines)).not.toMatch(/Helios|CompliLink|HMAC|\bcumple\b/i);
  });

  it("fixture 53 UIPD + CURP + NSS no pide RFC real y cita el mismo Falló de la tarjeta", () => {
    const started = "2026-09-21T15:30:00.000Z";
    const facts = {
      nss: "84129214965",
      curp: "UIPD921125HYNCLD03",
      workerRfc: "UIPD9211257I0",
      employerRfc: "ECC190605VA1",
      netAmount: "$4,725.60",
    };
    const gap = "Falta un RFC real en el recibo para consultar SAT.";
    const briefing = buildOfficialCaseBriefing({
      officialCheck: official("pendiente", {
        checkedAt: started,
        identity: { nss: false, curp: false, rfc: false },
        overallDetail: gap,
        checks: [
          {
            source: "imss",
            sourceLabel: "IMSS",
            status: "pendiente",
            label: "Pendiente",
            detail: "Todavía no hay una respuesta oficial nueva.",
            checkedAt: started,
            used: { nss: false, curp: false, rfc: false },
            honesty: "pending",
            hechos: ["Todavía no hay una respuesta oficial nueva de IMSS."],
          },
          {
            source: "sat",
            sourceLabel: "SAT",
            status: "sin_datos",
            label: "Faltan datos",
            detail: gap,
            checkedAt: started,
            used: { nss: false, curp: false, rfc: false },
            honesty: "failed",
            hechos: [gap],
            motivoFallo: gap,
            missingFields: ["rfc"],
          },
          {
            source: "infonavit",
            sourceLabel: "Infonavit",
            status: "sin_datos",
            label: "Faltan datos",
            detail: "Falta tu CURP en el recibo para consultar.",
            checkedAt: started,
            used: { nss: false, curp: false, rfc: false },
            honesty: "failed",
            hechos: ["Falta tu CURP en el recibo para consultar."],
            missingFields: ["curp"],
          },
        ],
        chatAnchor: {
          imss: {
            fuente: "imss",
            estado: "pending",
            fecha: started,
            hechos: ["Todavía no hay una respuesta oficial nueva de IMSS."],
            motivoFallo: null,
          },
          sat: {
            fuente: "sat",
            estado: "failed",
            fecha: started,
            hechos: [gap],
            motivoFallo: gap,
            missingFields: ["rfc"],
          },
          infonavit: {
            fuente: "infonavit",
            estado: "failed",
            fecha: started,
            hechos: ["Falta tu CURP en el recibo para consultar."],
            motivoFallo: "Falta tu CURP en el recibo para consultar.",
            missingFields: ["curp"],
          },
        },
      }),
      facts,
      nowMs: new Date(started).getTime() + 120_000,
    });
    const prompt = formatOfficialCaseBriefingForPrompt(briefing);
    const answer = buildNoLiveOfficialAnswer(briefing);
    const staleHistory =
      "IMSS: Pendiente. SAT/Infonavit: Faltan datos. Falta un RFC real en el recibo para consultar SAT.";
    const aligned = alignVisibleChatWithBriefing(staleHistory, briefing);
    const visible = [
      JSON.stringify(briefing),
      promptWithoutForbidRule(prompt),
      answer.clearAnswer,
      answer.known,
      answer.missing,
      aligned,
    ].join("\n");

    expect(briefing.facts.workerRfc).toBe("UIPD9211257I0");
    expect(briefing.missingIdentity).not.toContain("RFC");
    expect(briefing.officialCheck?.overallStatus).toBe("no_se_pudo");
    expect(briefing.statusLines.some((line) => line.startsWith("IMSS — sin respuesta hoy"))).toBe(true);
    expect(briefing.statusLines.some((line) => line.startsWith("SAT — sin respuesta hoy"))).toBe(true);
    expect(briefing.statusLines.some((line) => line.startsWith("Infonavit — sin respuesta hoy"))).toBe(true);
    expect(briefing.statusLines.join(" ")).not.toMatch(/Pendiente|Faltan datos|Falló/);
    expect(visible).not.toMatch(/Falta un RFC/i);
    expect(visible).not.toMatch(/RFC real/i);
    expect(aligned).toMatch(/IMSS — sin respuesta hoy/);
    expect(aligned).toMatch(/SAT — sin respuesta hoy/);
    expect(aligned).not.toMatch(/Pendiente|Faltan datos|Falló/);
    expect(JSON.stringify({ briefing, answer, aligned })).not.toMatch(/\bcumple\b|\bcobro\b/i);
  });

  it("recibo UIPD muestra el SAT vivo aunque IMSS e Infonavit no contesten", () => {
    const checkedAt = "2026-09-21T12:00:00.000Z";
    const briefing = buildOfficialCaseBriefing({
      officialCheck: official("no_se_pudo", {
        checkedAt,
        identity: { nss: true, curp: true, rfc: true },
        checks: [
          {
            source: "imss",
            sourceLabel: "IMSS",
            status: "no_se_pudo",
            label: "Sin respuesta",
            detail: "503 mantenimiento",
            checkedAt,
            used: { nss: true, curp: true, rfc: true },
            honesty: "failed",
            hechos: ["IMSS en mantenimiento."],
            motivoFallo: "503 mantenimiento",
          },
          {
            source: "sat",
            sourceLabel: "SAT",
            status: "vivo",
            label: "Vivo",
            detail: "Esto respondió el instituto hoy. No significa que tu patrón cumple.",
            checkedAt,
            used: { nss: true, curp: true, rfc: true },
            honesty: "live",
            hechos: ["RFC: UIPD9211257I0", "Situación: activo"],
          },
          {
            source: "infonavit",
            sourceLabel: "Infonavit",
            status: "no_se_pudo",
            label: "Sin respuesta",
            detail: "503 mantenimiento",
            checkedAt,
            used: { nss: true, curp: true, rfc: true },
            honesty: "failed",
            hechos: ["Infonavit en mantenimiento."],
            motivoFallo: "503 mantenimiento",
          },
        ],
        chatAnchor: {
          imss: {
            fuente: "imss",
            estado: "failed",
            fecha: checkedAt,
            hechos: ["IMSS en mantenimiento."],
            motivoFallo: "503 mantenimiento",
          },
          sat: {
            fuente: "sat",
            estado: "live",
            fecha: checkedAt,
            hechos: ["RFC: UIPD9211257I0", "Situación: activo"],
            motivoFallo: null,
          },
          infonavit: {
            fuente: "infonavit",
            estado: "failed",
            fecha: checkedAt,
            hechos: ["Infonavit en mantenimiento."],
            motivoFallo: "503 mantenimiento",
          },
        },
      }),
      facts: {
        nss: "84129214965",
        curp: "UIPD921125HYNCLD03",
        workerRfc: "UIPD9211257I0",
        employerRfc: "ECC190605VA1",
        netAmount: "$4,725.60",
      },
    });
    const answer = buildPayWellFallback(briefing);
    const prompt = formatOfficialCaseBriefingForPrompt(briefing);

    expect(briefing.headline).toBe("El SAT contestó; IMSS e Infonavit aún no.");
    expect(briefing.instituteSilence).toBe(false);
    expect(briefing.verdict?.kind).toBe("mixed");
    expect(briefing.statusLines.some((line) => /SAT: Vivo/.test(line))).toBe(true);
    expect(briefing.statusLines.some((line) => line.includes("UIPD9211257I0"))).toBe(true);
    expect(briefing.statusLines.some((line) => line === "IMSS — sin respuesta hoy · en mantenimiento")).toBe(true);
    expect(briefing.statusLines.join(" ")).not.toMatch(/SAT — sin respuesta|Hoy no pudimos confirmar con IMSS, SAT e Infonavit/);
    expect(answer.clearAnswer).toMatch(/UIPD9211257I0/);
    expect(answer.clearAnswer).not.toMatch(/Hoy no pudimos confirmar con IMSS, SAT e Infonavit/);
    expect(prompt).toMatch(/SAT: Vivo/);
    expect(prompt).not.toMatch(/Hoy no pudimos confirmar con IMSS, SAT e Infonavit/);
    expect(JSON.stringify({ briefing, answer })).not.toMatch(/\bFalló\b|no de AuditaPatrón/);
    expect(briefing.comparisonLines.join(" ")).toMatch(/Tu recibo muestra el RFC UIPD9211257I0\. El SAT confirmó el mismo RFC/);
    expect(briefing.comparisonLines.join(" ")).not.toMatch(/RPCI|ApiMarket|Syntage|CompliLink/);
  });

  it("pone el salario parcial del IMSS junto al recibo sin siglas de sistema", () => {
    const checkedAt = "2026-09-21T12:00:00.000Z";
    const briefing = buildOfficialCaseBriefing({
      officialCheck: official("no_se_pudo", {
        checkedAt,
        identity: { nss: true, curp: false, rfc: true },
        checks: [
          {
            source: "imss",
            sourceLabel: "IMSS",
            status: "vivo",
            label: "Vivo",
            detail: "Esto respondió el instituto hoy. No significa que tu patrón cumple.",
            checkedAt,
            used: { nss: true, curp: false, rfc: false },
            honesty: "live",
            hechos: ["Salario RPCI: $450.25"],
          },
          {
            source: "sat",
            sourceLabel: "SAT",
            status: "no_se_pudo",
            label: "Sin respuesta",
            detail: "503 mantenimiento",
            checkedAt,
            used: { nss: false, curp: false, rfc: true },
            honesty: "failed",
            hechos: ["SAT en mantenimiento."],
            motivoFallo: "503 mantenimiento",
          },
          {
            source: "infonavit",
            sourceLabel: "Infonavit",
            status: "sin_datos",
            label: "Faltan datos",
            detail: "Falta tu CURP en el recibo para consultar.",
            checkedAt,
            used: { nss: false, curp: false, rfc: false },
            honesty: "failed",
            hechos: ["Falta el CURP para consultar Infonavit."],
            missingFields: ["curp"],
          },
        ],
        chatAnchor: {
          imss: {
            fuente: "imss",
            estado: "live",
            fecha: checkedAt,
            hechos: ["Salario RPCI: $450.25"],
            motivoFallo: null,
          },
          sat: {
            fuente: "sat",
            estado: "failed",
            fecha: checkedAt,
            hechos: ["SAT en mantenimiento."],
            motivoFallo: "503 mantenimiento",
          },
          infonavit: {
            fuente: "infonavit",
            estado: "pending",
            fecha: checkedAt,
            hechos: ["Falta el CURP para consultar Infonavit."],
            motivoFallo: null,
            missingFields: ["curp"],
          },
        },
      }),
      facts: {
        nss: "84129214965",
        workerRfc: "UIPD9211257I0",
        salary: "331.01",
        netAmount: "$4,725.60",
      },
    });
    const visible = [...briefing.comparisonLines, ...briefing.hechoLines, ...(briefing.verdict?.sourceLines ?? [])].join(" ");

    expect(briefing.comparisonLines.join(" ")).toMatch(/En tu recibo se lee \$331\.01/);
    expect(briefing.comparisonLines.join(" ")).toMatch(/El IMSS tiene registrado \$450\.25/);
    expect(visible).not.toMatch(/RPCI|ApiMarket|Syntage|CompliLink|\bcumple\b/i);
    expect(briefing.verdict?.sourceLines.join(" ")).toMatch(/salario que el IMSS tiene registrado/);
  });

  it("no inventa salario del IMSS ni Vivo si el retorno no trae ese hecho", () => {
    const checkedAt = "2026-09-21T12:00:00.000Z";
    const briefing = buildOfficialCaseBriefing({
      officialCheck: official("pendiente", {
        checkedAt,
        identity: { nss: true, curp: true, rfc: true },
        checks: [
          {
            source: "imss",
            sourceLabel: "IMSS",
            status: "pendiente",
            label: "Pendiente",
            detail: "Todavía no hay una respuesta oficial nueva.",
            checkedAt,
            used: { nss: true, curp: false, rfc: false },
            honesty: "pending",
            hechos: ["Salario registrado: $450.25"],
          },
          {
            source: "sat",
            sourceLabel: "SAT",
            status: "pendiente",
            label: "Pendiente",
            detail: "Todavía no hay una respuesta oficial nueva.",
            checkedAt,
            used: { nss: false, curp: false, rfc: true },
            honesty: "pending",
            hechos: ["Todavía no hay una respuesta oficial nueva de SAT."],
          },
          {
            source: "infonavit",
            sourceLabel: "Infonavit",
            status: "pendiente",
            label: "Pendiente",
            detail: "Todavía no hay una respuesta oficial nueva.",
            checkedAt,
            used: { nss: false, curp: true, rfc: false },
            honesty: "pending",
            hechos: ["Todavía no hay una respuesta oficial nueva de Infonavit."],
          },
        ],
      }),
      facts: {
        salary: "331.01",
        employerName: "EVOLUCION CREATIVA CAMREFLEX",
        workerRfc: "UIPD9211257I0",
      },
    });
    const visible = [
      briefing.headline,
      ...briefing.comparisonLines,
      ...briefing.statusLines,
      ...briefing.receiptLines,
    ].join(" ");

    expect(briefing.comparisonLines.join(" ")).not.toMatch(/El IMSS tiene registrado/);
    expect(briefing.officialCheck?.overallStatus).not.toBe("vivo");
    expect(briefing.officialCheck?.checks.find((item) => item.source === "imss")?.status).not.toBe("vivo");
    expect(visible).not.toMatch(/\bVivo\b|RPCI|Syntage|CompliLink|\bcumple\b/i);
    expect(briefing.receiptLines.join(" ")).toMatch(/EVOLUCION CREATIVA CAMREFLEX/);
  });

  it("pinta salario y patrón del registro solo cuando el retorno ya los trae, sin marcar Vivo", () => {
    const checkedAt = "2026-09-21T12:00:00.000Z";
    const briefing = buildOfficialCaseBriefing({
      officialCheck: official("pendiente", {
        checkedAt,
        identity: { nss: true, curp: true, rfc: true },
        checks: [
          {
            source: "imss",
            sourceLabel: "IMSS",
            status: "pendiente",
            label: "Pendiente",
            detail: "Todavía no hay una respuesta oficial nueva.",
            checkedAt,
            used: { nss: true, curp: false, rfc: false },
            honesty: "pending",
            hechos: ["Salario RPCI: $450.25", "Patrón RPCI: TALLER NORTE SA"],
          },
          {
            source: "sat",
            sourceLabel: "SAT",
            status: "no_se_pudo",
            label: "Sin respuesta",
            detail: "503 mantenimiento",
            checkedAt,
            used: { nss: false, curp: false, rfc: true },
            honesty: "failed",
            hechos: ["SAT en mantenimiento."],
            motivoFallo: "503 mantenimiento",
          },
          {
            source: "infonavit",
            sourceLabel: "Infonavit",
            status: "pendiente",
            label: "Pendiente",
            detail: "Todavía no hay una respuesta oficial nueva.",
            checkedAt,
            used: { nss: false, curp: true, rfc: false },
            honesty: "pending",
            hechos: ["Todavía no hay una respuesta oficial nueva de Infonavit."],
          },
        ],
        chatAnchor: {
          imss: {
            fuente: "imss",
            estado: "pending",
            fecha: checkedAt,
            hechos: ["Salario RPCI: $450.25", "Patrón RPCI: TALLER NORTE SA"],
            motivoFallo: null,
          },
          sat: {
            fuente: "sat",
            estado: "failed",
            fecha: checkedAt,
            hechos: ["SAT en mantenimiento."],
            motivoFallo: "503 mantenimiento",
          },
          infonavit: {
            fuente: "infonavit",
            estado: "pending",
            fecha: checkedAt,
            hechos: ["Todavía no hay una respuesta oficial nueva de Infonavit."],
            motivoFallo: null,
          },
        },
      }),
      facts: {
        salary: "331.01",
        employerName: "EVOLUCION CREATIVA CAMREFLEX",
        folio: "10963",
        uuid: "8C18C713-7AFA-5EA6-B323-FA208F8A3880",
      },
    });
    const visible = [
      briefing.headline,
      ...briefing.comparisonLines,
      ...briefing.hechoLines,
      ...briefing.receiptLines,
      ...(briefing.verdict?.sourceLines ?? []),
    ].join(" ");

    expect(briefing.comparisonLines.join(" ")).toMatch(/En tu recibo se lee \$331\.01/);
    expect(briefing.comparisonLines.join(" ")).toMatch(/El IMSS tiene registrado \$450\.25/);
    expect(briefing.comparisonLines.join(" ")).toMatch(/En tu recibo el patrón es EVOLUCION CREATIVA CAMREFLEX/);
    expect(briefing.comparisonLines.join(" ")).toMatch(/El IMSS tiene registrado a TALLER NORTE SA/);
    expect(briefing.officialCheck?.checks.find((item) => item.source === "imss")?.status).not.toBe("vivo");
    expect(briefing.headline ?? "").not.toMatch(/^Vivo\b/);
    expect(visible).not.toMatch(/RPCI|Syntage|CompliLink|\bcumple\b/i);
    expect(briefing.receiptLines.join(" ")).toMatch(/folio 10963/);
    expect(briefing.receiptLines.join(" ")).toMatch(/folio fiscal 8C18C713-7AFA-5EA6-B323-FA208F8A3880/);
    expect(briefing.receiptLines.join(" ")).not.toMatch(/\bUUID\b/);
  });

  it("compara sueldo y patrón cuando el retorno trae el contrato del registro, y dice qué hacer", () => {
    const checkedAt = "2026-09-21T12:00:00.000Z";
    const different = buildOfficialCaseBriefing({
      officialCheck: official("vivo", {
        checkedAt,
        identity: { nss: true, curp: true, rfc: true },
        checks: [
          {
            source: "imss",
            sourceLabel: "IMSS",
            status: "vivo",
            label: "Vivo",
            detail: "Esto respondió el instituto hoy. No significa que tu patrón cumple.",
            checkedAt,
            used: { nss: true, curp: false, rfc: false },
            honesty: "live",
            hechos: [
              "Salario registrado: $1,850.75.",
              "RFC del patrón: PAG850101AB1.",
              "Patrón: TECNOMEX SOLUCIONES, S.A. DE C.V.",
            ],
          },
          {
            source: "sat",
            sourceLabel: "SAT",
            status: "vivo",
            label: "Vivo",
            detail: "Esto respondió el instituto hoy. No significa que tu patrón cumple.",
            checkedAt,
            used: { nss: false, curp: false, rfc: true },
            honesty: "live",
            hechos: ["Régimen en SAT: Sueldos y Salarios e Ingresos Asimilados a Salarios."],
          },
          {
            source: "infonavit",
            sourceLabel: "Infonavit",
            status: "vivo",
            label: "Vivo",
            detail: "Esto respondió el instituto hoy. No significa que tu patrón cumple.",
            checkedAt,
            used: { nss: true, curp: false, rfc: false },
            honesty: "live",
            hechos: ["Saldo de subcuenta de vivienda: $57,727.92.", "Empresa en la subcuenta: CONSTRUCTORA DEL NORTE SA."],
          },
        ],
      }),
      facts: {
        salary: "331.01",
        employerRfc: "ECC190605VA1",
        employerName: "EVOLUCION CREATIVA CAMREFLEX",
        infonavitWithheld: "$210.00",
        workerRfc: "UIPD9211257I0",
      },
    });
    const visible = [
      different.comparison.seenLine,
      different.comparison.nextStepLine,
      ...different.comparisonLines,
    ].join(" ");

    expect(different.comparison.seen).toBe("hay_diferencia");
    expect(different.comparison.seenLine).toBe("Esto vimos: hay diferencia");
    expect(different.comparison.nextStep).toMatch(/sueldo y patrón/);
    expect(different.comparisonLines.join(" ")).toMatch(/\$331\.01/);
    expect(different.comparisonLines.join(" ")).toMatch(/\$1,850\.75/);
    expect(different.comparisonLines.join(" ")).toMatch(/TECNOMEX/);
    expect(different.comparisonLines.join(" ")).toMatch(/Sueldos y Salarios/);
    expect(different.comparisonLines.join(" ")).toMatch(/\$57,727\.92/);
    expect(different.comparisonLines.join(" ")).toMatch(/No es el descuento de tu recibo/);
    expect(visible).not.toMatch(/RPCI|Syntage|CompliLink|certificado|\bcumple\b/i);
    expect(different.comparisonLines.join(" ")).not.toMatch(/\$210\.00/);

    const same = buildOfficialCaseBriefing({
      officialCheck: official("pendiente", {
        checkedAt,
        checks: [
          {
            source: "imss",
            sourceLabel: "IMSS",
            status: "pendiente",
            label: "Pendiente",
            detail: "Todavía no hay una respuesta oficial nueva.",
            checkedAt,
            used: { nss: true, curp: false, rfc: false },
            honesty: "pending",
            hechos: [],
          },
        ],
        institutePay: {
          salary: "$331.01",
          employer: "EVOLUCION CREATIVA CAMREFLEX",
          employerRfc: "ECC190605VA1",
          days: "15",
        },
      }),
      facts: {
        salary: "331.01",
        employerName: "EVOLUCION CREATIVA CAMREFLEX S.A. DE C.V.",
        employerRfc: "ECC190605VA1",
      },
    });

    expect(same.comparison.seen).toBe("bien");
    expect(same.comparison.seenLine).toBe("Esto vimos: bien");
    expect(same.comparison.nextStep).toMatch(/Guarda este resultado/);
    expect(same.officialCheck?.checks.find((item) => item.source === "imss")?.status).not.toBe("vivo");
    expect(same.officialCheck?.overallStatus).not.toBe("vivo");
    expect(same.comparisonLines.join(" ")).toMatch(/15 días cotizados/);
    expect([same.headline, same.comparison.seenLine, ...same.statusLines].join(" ")).not.toMatch(/^Vivo\b|\bVivo ·/);
  });
});
