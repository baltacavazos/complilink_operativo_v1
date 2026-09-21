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
      nowMs: Date.parse("2026-09-21T15:30:30.000Z"),
    });

    expect(briefing.missingIdentity).toEqual(["CURP"]);
    expect(briefing.missingIdentityDetail).toBe("Falta tu CURP en el recibo para consultar Infonavit.");
    expect(briefing.statusLines.some((line) => /IMSS: Pendiente/.test(line))).toBe(true);
    expect(briefing.statusLines.some((line) => /SAT: Pendiente/.test(line))).toBe(true);
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
    expect(briefing.statusLines.some((line) => /IMSS: (Pendiente|Vivo|Falló)/.test(line))).toBe(true);
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
    expect(prompt).toMatch(/IMSS: (Pendiente|Vivo|Falló)/);
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
    expect(briefing.statusLines.some((line) => /IMSS: Pendiente/.test(line))).toBe(true);
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
    expect(briefing.statusLines.some((line) => /IMSS: Falló/.test(line))).toBe(true);
    expect(briefing.statusLines.some((line) => /IMSS: Pendiente/.test(line))).toBe(false);
    expect(briefing.statusLines.find((line) => /IMSS: Falló/.test(line))).toMatch(/no de AuditaPatrón/);
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
    expect(briefing.statusLines.some((line) => /IMSS: Falló/.test(line))).toBe(true);
    expect(briefing.statusLines.some((line) => /IMSS: Pendiente/.test(line))).toBe(false);
    expect(briefing.statusLines.join(" ")).toMatch(/instituto/);
    expect(briefing.statusLines.join(" ")).toMatch(/no de AuditaPatrón/);
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
    expect(briefing.statusLines.some((line) => /IMSS: Falló/.test(line))).toBe(true);
    expect(briefing.statusLines.some((line) => /SAT: Falló/.test(line))).toBe(true);
    expect(briefing.statusLines.some((line) => /Infonavit: Falló/.test(line))).toBe(true);
    expect(briefing.statusLines.join(" ")).not.toMatch(/Pendiente|Faltan datos/);
    expect(visible).not.toMatch(/Falta un RFC/i);
    expect(visible).not.toMatch(/RFC real/i);
    expect(aligned).toMatch(/IMSS: Falló/);
    expect(aligned).toMatch(/SAT: Falló/);
    expect(aligned).not.toMatch(/Pendiente|Faltan datos/);
    expect(JSON.stringify({ briefing, answer, aligned })).not.toMatch(/\bcumple\b|\bcobro\b/i);
  });
});
