import { describe, expect, it } from "vitest";

import {
  CASE_ADVISOR_RULE,
  WORKER_CHAT_NO_CONSULTA_EMPTY,
  buildNoLiveOfficialAnswer,
  buildOfficialCaseBriefing,
  buildOfficialChatStarterQuestions,
  buildPayWellFallback,
  formatOfficialCaseBriefingForPrompt,
  isPayWellQuestion,
  officialIdentityGapDetail,
  selectReceiptOfficialComparison,
} from "./officialCaseBriefing";
import {
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

  it("usa reciboVsOficial del puente y no inventa bien", () => {
    const bien = selectReceiptOfficialComparison({
      officialCheck: official("vivo", { chatAnchor: liveAnchor }),
      facts: {},
      reciboVsOficial: "bien",
    });
    expect(bien.seenLine).toBe("Cuadra con tu recibo.");
    expect(bien.nextStep).toBe("Guarda este resultado con la fecha.");

    const diff = selectReceiptOfficialComparison({
      officialCheck: official("vivo", { chatAnchor: liveAnchor }),
      facts: {},
      reciboVsOficial: { resultado: "hay_diferencia", motivo: "SBC distinto" },
    });
    expect(diff.seenLine).toBe("Hay diferencia entre tu recibo y la respuesta de hoy.");
    expect(diff.nextStep).toMatch(/Anota periodo y montos/);

    const unknown = selectReceiptOfficialComparison({
      officialCheck: official("vivo", { chatAnchor: liveAnchor }),
      facts: {},
      reciboVsOficial: null,
    });
    expect(unknown.seenLine).toBe(RECEIPT_OFFICIAL_COMPARISON_COPY.no_se_pudo.seenLine);
    expect(unknown.seen).toBe("no_se_pudo");
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
    expect(prompt).toMatch(/Hay diferencia entre tu recibo/);
    expect(prompt).toMatch(/neto \$4,200/);
    expect(prompt).toMatch(/Nunca inventes: cumple, alta vigente, salario oficial/);
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
  });
});
