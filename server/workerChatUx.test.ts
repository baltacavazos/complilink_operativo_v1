import { describe, expect, it } from "vitest";

import { RECEIPT_OFFICIAL_COMPARISON_COPY, type OfficialCheckSummary } from "@shared/officialCheckCopy";
import { listLastGoodOfficialCitations } from "@shared/officialDigest";
import {
  WORKER_CHAT_DISCLAIMER,
  WORKER_CHAT_MULTI_DOC_UPSELL,
  hasForbiddenWorkerChatClaim,
  hasInternalControlMarkers,
} from "@shared/workerChatUx";
import {
  buildWorkerChatFallbackAnswer,
  buildWorkerChatGrounding,
  buildWorkerChatLlmInstructions,
  buildWorkerChatSuggestedPrompts,
  pickPrincipalWorkerChatDocument,
  sanitizeWorkerChatAnswer,
  scopeWorkerChatDocumentsForPlan,
} from "./workerChatUx";

const payrollDocument = {
  documentType: "payroll_receipt",
  originalName: "recibo-mayo.pdf",
  heliosOpinion: {
    summary: "El recibo muestra periodo, neto y un descuento de IMSS.",
    recommendedNextStep: "Compara el descuento con tu siguiente recibo.",
    uncertainties: ["No se ve una constancia oficial de semanas cotizadas."],
    keyFactsUsed: ["Periodo 1 al 15 de mayo", "NSS 12345678901"],
    legalFoundations: [
      {
        title: "Acreditación de pagos y deducciones",
        reference: "Recibos y comprobantes fiscales laborales",
        relevance: "Permite revisar si los pagos documentados coinciden con la relación laboral.",
      },
    ],
    rawPayload: {
      preliminaryAnalysis: {
        confirmedData: {
          payrollPeriod: "2026-05-01 al 2026-05-15",
          payrollNss: "12345678901",
          imssWithheld: "$120.50",
          isrWithheld: "$310.00",
          infonavitWithheld: "$80.00",
        },
      },
    },
  },
};

describe("workerChatUx grounding", () => {
  it("ancla la respuesta en señales del documento y bases ya presentes", () => {
    const grounding = buildWorkerChatGrounding({
      documents: [payrollDocument],
      opinion: payrollDocument.heliosOpinion,
      missingDocument: {
        label: "CFDI del mismo periodo",
        reason: "Sirve para comparar lo timbrado con tu recibo.",
      },
    });

    expect(grounding.liveImssValidation).toBe(false);
    expect(grounding.officialBriefing.hasOfficialConsulta).toBe(false);
    expect(grounding.officialBriefing.hasLiveOfficialResult).toBe(false);
    expect(grounding.validationMode).toBe("document_signals");
    expect(grounding.hasImssSignal).toBe(true);
    expect(grounding.laborFacts.nss).toBe("12345678901");
    expect(grounding.disclaimer).toBe(WORKER_CHAT_DISCLAIMER);
    expect(grounding.disclaimer).toMatch(/resultado de TU consulta/);

    const answer = buildWorkerChatFallbackAnswer(grounding, { prompt: "¿Qué hago ahora?" });
    expect(answer).toMatch(/Aún no hay resultado de TU consulta/);
    expect(answer).toMatch(/Consultar IMSS y SAT/);
    expect(answer).toContain(WORKER_CHAT_DISCLAIMER);
    expect(answer).not.toMatch(/consulta en vivo|validaci[oó]n en vivo|no consultamos en vivo/i);
    expect(answer).not.toMatch(/tesis|jurisprudencia|Helios|CompliLink/i);
    expect(hasForbiddenWorkerChatClaim(answer)).toBe(false);
  });

  it("recibo con NSS y RFC visibles no deja que el chat diga Falta tu NSS", () => {
    const staleCheck: OfficialCheckSummary = {
      configured: true,
      consentGranted: true,
      overallStatus: "sin_datos",
      overallLabel: "Faltan datos",
      overallDetail: "Falta tu NSS, CURP y RFC en el recibo para consultar.",
      checkedAt: "2026-09-21T15:30:00.000Z",
      identity: { nss: false, curp: false, rfc: false },
      checks: [],
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
    };
    const receiptDocument = {
      documentType: "payroll_receipt",
      originalName: "recibo-smoke.pdf",
      heliosOpinion: {
        summary: "El recibo muestra NSS, RFC genérico y neto.",
        rawPayload: {
          preliminaryAnalysis: {
            confirmedData: {
              payrollNss: "12345678901",
              workerRfc: "XAXX010101000",
              payrollNetAmount: "$12,450",
            },
          },
        },
      },
    };
    const grounding = buildWorkerChatGrounding({
      documents: [receiptDocument],
      opinion: receiptDocument.heliosOpinion,
      officialCheck: staleCheck,
      caseOnly: true,
      caseTitle: "Smoke Magia",
    });
    const answer = buildWorkerChatFallbackAnswer(grounding, { prompt: "¿Qué dice mi consulta?" });
    const instructions = buildWorkerChatLlmInstructions(grounding, { prompt: "¿Qué dice mi consulta?" });

    expect(grounding.laborFacts.nss).toBe("12345678901");
    expect(grounding.officialBriefing.facts.nss).toBe("12345678901");
    expect(grounding.officialBriefing.statusLines.some((line) => /IMSS: Faltan datos/.test(line))).toBe(false);
    expect(grounding.officialBriefing.statusLines.join(" ")).not.toMatch(/IMSS y SAT: Faltan datos/);
    expect(answer).not.toMatch(/Falta tu NSS/);
    expect(answer).not.toMatch(/Falta tu NSS, CURP y RFC/);
    expect(answer).not.toMatch(/IMSS y SAT: Faltan datos/);
    expect(answer).toMatch(/aún no podemos decirte si tu patrón está bien dado de alta|No inventamos que tu patr[oó]n cumple/);
    expect(answer).not.toMatch(/\b(sí,? )?tu patrón cumple\b/i);
    expect(
      instructions
        .split("\n")
        .filter((line) => !/PROHIBIDO escribir/.test(line))
        .join("\n"),
    ).not.toMatch(/Falta tu NSS/);
    expect(instructions).toMatch(/NSS en recibo: 12345678901/);
    expect(instructions).toMatch(/PROHIBIDO escribir «Falta tu NSS»/);
    expect(instructions).not.toMatch(/IMSS y SAT: Faltan datos/);
    expect(hasForbiddenWorkerChatClaim(answer)).toBe(false);
  });

  it("fixture 53 con RFC UIPD no deja Falta un RFC real ni un Pendiente viejo", () => {
    const started = "2026-09-21T15:30:00.000Z";
    const gap = "Falta un RFC real en el recibo para consultar SAT.";
    const receiptDocument = {
      documentType: "payroll_receipt",
      originalName: "recibo-53.xml",
      heliosOpinion: {
        summary: "El recibo muestra NSS, CURP y RFC de la persona trabajadora.",
        rawPayload: {
          preliminaryAnalysis: {
            confirmedData: {
              payrollNss: "84129214965",
              curp: "UIPD921125HYNCLD03",
              employerRfc: "ECC190605VA1",
              receptor_rfc: "UIPD9211257I0",
              payrollNetAmount: "$4,725.60",
            },
          },
        },
      },
    };
    const staleCheck: OfficialCheckSummary = {
      configured: true,
      consentGranted: true,
      overallStatus: "pendiente",
      overallLabel: "Pendiente",
      overallDetail: gap,
      checkedAt: started,
      identity: { nss: true, curp: false, rfc: false },
      checks: [
        {
          source: "imss",
          sourceLabel: "IMSS",
          status: "pendiente",
          label: "Pendiente",
          detail: "Todavía no hay una respuesta oficial nueva.",
          checkedAt: started,
          used: { nss: true, curp: false, rfc: false },
          honesty: "pending",
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
          missingFields: ["curp"],
        },
      ],
    };
    const grounding = buildWorkerChatGrounding({
      documents: [receiptDocument],
      opinion: receiptDocument.heliosOpinion,
      officialCheck: staleCheck,
      caseOnly: true,
      nowMs: new Date(started).getTime() + 120_000,
    });
    const answer = buildWorkerChatFallbackAnswer(grounding, { prompt: "¿Qué dice mi consulta?" });
    const invented = sanitizeWorkerChatAnswer(
      "IMSS: Pendiente. SAT/Infonavit: Faltan datos. Falta un RFC real en el recibo para consultar SAT.",
      grounding,
      { prompt: "¿Qué dice mi consulta?" },
    );
    const blob = [answer, invented, grounding.officialBriefing.statusLines.join("\n")].join("\n");

    expect(grounding.laborFacts.workerRfc).toBe("UIPD9211257I0");
    expect(grounding.officialBriefing.facts.workerRfc).toBe("UIPD9211257I0");
    expect(grounding.officialBriefing.statusLines.some((line) => /IMSS: Falló/.test(line))).toBe(true);
    expect(grounding.officialBriefing.statusLines.some((line) => /SAT: Falló/.test(line))).toBe(true);
    expect(grounding.officialBriefing.statusLines.some((line) => /Infonavit: Falló/.test(line))).toBe(true);
    expect(blob).not.toMatch(/Falta un RFC/i);
    expect(blob).not.toMatch(/RFC real/i);
    expect(blob).not.toMatch(/IMSS: Pendiente/);
    expect(blob).not.toMatch(/Faltan datos/);
    expect(blob.replace(/No inventamos que tu patr[oó]n cumple/g, "")).not.toMatch(/\bcumple\b|\bcobro\b/i);
  });

  it("lastUpload NSS sin flags del servidor impide la cita exacta y la recorta si el modelo la inventa", () => {
    const invented = sanitizeWorkerChatAnswer(
      "Falta tu NSS y RFC en el recibo para consultar.",
      buildWorkerChatGrounding({
        documents: [{ documentType: "payroll_receipt", originalName: "recibo.pdf" }],
        officialBriefing: {
          hasOfficialConsulta: true,
          hasLiveOfficialResult: false,
          officialCheck: null,
          chatAnchor: null,
          reciboVsOficial: null,
          statusLines: ["IMSS: Pendiente"],
          hechoLines: [],
          headline: "Pendiente",
          missingIdentity: ["CURP", "RFC"],
          missingIdentityDetail: "El RFC del recibo es genérico; SAT necesita un RFC real para consultar.",
          receiptLines: ["NSS en recibo: 12345678901"],
          comparison: {
            seen: "no_se_pudo",
            seenLine: RECEIPT_OFFICIAL_COMPARISON_COPY.no_se_pudo.seenLine,
            nextStep: RECEIPT_OFFICIAL_COMPARISON_COPY.no_se_pudo.nextStep,
            nextStepLine: `Qué hacer ahora: ${RECEIPT_OFFICIAL_COMPARISON_COPY.no_se_pudo.nextStep}`,
            hasOfficialConsulta: true,
          },
          facts: { nss: "12345678901", workerRfc: "XAXX010101000", netAmount: "$12,450" },
        },
        caseOnly: true,
      }),
    );
    expect(invented).not.toMatch(/Falta tu NSS/);
    expect(invented).not.toContain("Falta tu NSS y RFC en el recibo para consultar.");
  });

  it("en el caso el prompt del modelo solo usa chatAnchor, recibo y TU consulta", () => {
    const officialCheck: OfficialCheckSummary = {
      configured: true,
      consentGranted: true,
      overallStatus: "vivo",
      overallLabel: "Vivo",
      overallDetail: "Esto respondió el instituto hoy. No significa que tu patrón cumple.",
      checkedAt: "2026-09-21T15:30:00.000Z",
      identity: { nss: true, curp: false, rfc: true },
      checks: [],
      chatAnchor: {
        imss: {
          fuente: "imss",
          estado: "live",
          fecha: "2026-09-21T15:30:00.000Z",
          hechos: ["Alta vigente: sí."],
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
          hechos: ["Infonavit está en mantenimiento."],
          motivoFallo: "Infonavit está en mantenimiento.",
        },
      },
      reciboVsOficial: { resultado: "hay_diferencia", motivo: "SBC distinto" },
    };
    const instructions = buildWorkerChatLlmInstructions(
      buildWorkerChatGrounding({
        documents: [payrollDocument],
        opinion: payrollDocument.heliosOpinion,
        officialCheck,
        caseOnly: true,
      }),
    );
    expect(instructions).toContain("chatAnchor");
    expect(instructions).toContain("reciboVsOficial");
    expect(instructions).toMatch(/Esto vimos: hay diferencia/);
    expect(instructions).toMatch(/resultado de TU consulta/);
    expect(instructions).not.toMatch(/no consultamos en vivo/i);
    expect(instructions).not.toMatch(/Esto no consulta IMSS, SAT ni Infonavit en vivo/);
    expect(instructions).toContain(WORKER_CHAT_DISCLAIMER);
  });

  it("con chatAnchor vivo ancla comparación y hechos de ESTE expediente", () => {
    const officialCheck: OfficialCheckSummary = {
      configured: true,
      consentGranted: true,
      overallStatus: "vivo",
      overallLabel: "Vivo",
      overallDetail: "Esto respondió el instituto hoy. No significa que tu patrón cumple.",
      checkedAt: "2026-09-21T15:30:00.000Z",
      identity: { nss: true, curp: false, rfc: true },
      checks: [],
      chatAnchor: {
        imss: {
          fuente: "imss",
          estado: "live",
          fecha: "2026-09-21T15:30:00.000Z",
          hechos: ["Alta vigente: sí."],
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
          hechos: ["Infonavit está en mantenimiento."],
          motivoFallo: "Infonavit está en mantenimiento.",
        },
      },
      reciboVsOficial: { resultado: "hay_diferencia", motivo: "SBC distinto" },
    };
    const grounding = buildWorkerChatGrounding({
      documents: [payrollDocument],
      opinion: payrollDocument.heliosOpinion,
      officialCheck,
      caseOnly: true,
    });
    const answer = buildWorkerChatFallbackAnswer(grounding, { prompt: "¿Me pagan bien?" });
    const prompts = buildWorkerChatSuggestedPrompts(grounding);

    expect(grounding.liveImssValidation).toBe(true);
    expect(grounding.chatAnchor?.imss.hechos[0]).toBe("Alta vigente: sí.");
    expect(grounding.reciboVsOficial?.resultado).toBe("hay_diferencia");
    expect(answer).toContain(RECEIPT_OFFICIAL_COMPARISON_COPY.hay_diferencia.seenLine);
    expect(answer).toContain(RECEIPT_OFFICIAL_COMPARISON_COPY.hay_diferencia.nextStep);
    expect(answer).toMatch(/Alta vigente: sí|IMSS: Vivo/);
    expect(answer).not.toMatch(/Helios|CompliLink|HMAC/i);
    expect(prompts).toContain("¿Hay diferencia con mi recibo?");
    expect(hasForbiddenWorkerChatClaim(answer)).toBe(false);
  });

  it("si Falló, el asesor culpa al instituto y no a AuditaPatrón", () => {
    const officialCheck: OfficialCheckSummary = {
      configured: true,
      consentGranted: true,
      overallStatus: "no_se_pudo",
      overallLabel: "Falló",
      overallDetail: "No hubo respuesta usable en esta consulta. Inténtalo más tarde.",
      checkedAt: "2026-09-21T15:30:00.000Z",
      identity: { nss: true, curp: false, rfc: false },
      checks: [
        {
          source: "imss",
          sourceLabel: "IMSS",
          status: "no_se_pudo",
          label: "Falló",
          detail: "No hubo respuesta usable en esta consulta. Inténtalo más tarde.",
          checkedAt: "2026-09-21T15:30:00.000Z",
          used: { nss: true, curp: false, rfc: false },
          honesty: "failed",
          hechos: ["El instituto no respondió hoy"],
          motivoFallo: "El instituto no respondió hoy",
        },
      ],
      chatAnchor: {
        imss: {
          fuente: "imss",
          estado: "failed",
          fecha: "2026-09-21T15:30:00.000Z",
          hechos: ["El instituto no respondió hoy"],
          motivoFallo: "El instituto no respondió hoy",
        },
        sat: {
          fuente: "sat",
          estado: "pending",
          fecha: null,
          hechos: ["Todavía no hay una respuesta oficial nueva de SAT."],
          motivoFallo: null,
        },
        infonavit: {
          fuente: "infonavit",
          estado: "pending",
          fecha: null,
          hechos: ["Todavía no hay una respuesta oficial nueva de Infonavit."],
          motivoFallo: null,
        },
      },
    };
    const grounding = buildWorkerChatGrounding({
      documents: [payrollDocument],
      opinion: payrollDocument.heliosOpinion,
      officialCheck,
      caseOnly: true,
    });
    const answer = buildWorkerChatFallbackAnswer(grounding, { prompt: "¿Qué pasó con mi consulta?" });
    const instructions = buildWorkerChatLlmInstructions(grounding, { prompt: "¿Qué pasó con mi consulta?" });

    expect(answer).toMatch(/Hoy pedimos datos a IMSS y no contestaron/);
    expect(answer).not.toMatch(/Respuesta clara|Lo que sí se sabe|Falló|no de AuditaPatrón/);
    expect(answer).not.toMatch(/respuesta usable|fallo de AuditaPatrón|cruza el descuento|cumple/i);
    expect(instructions).toMatch(/un solo párrafo/i);
    expect(instructions).toMatch(/Sin tips laborales genéricos/);
    expect(instructions).toMatch(/Prohibido/);
    expect(hasForbiddenWorkerChatClaim(answer)).toBe(false);
  });

  it("si preguntan ¿me pagan bien? ancla al recibo y no inventa consulta", () => {
    const grounding = buildWorkerChatGrounding({
      documents: [payrollDocument],
      opinion: payrollDocument.heliosOpinion,
    });
    const payAnswer = buildWorkerChatFallbackAnswer(grounding, { prompt: "¿Me pagan bien?" });
    expect(payAnswer).toMatch(/Aún no hay resultado de TU consulta/);
    expect(payAnswer).toMatch(/\$120\.50|neto|recibo/i);
    expect(payAnswer).not.toMatch(/Helios|CompliLink|HMAC|jurisprudencia/i);
    expect(payAnswer).toMatch(/No inventamos que tu patr[oó]n cumple/);
    expect(hasForbiddenWorkerChatClaim(payAnswer)).toBe(false);
  });

  it("si preguntan IMSS e ISR juntos, el fallback cubre alta y retención en las 4 secciones", () => {
    const grounding = buildWorkerChatGrounding({
      documents: [payrollDocument],
      opinion: payrollDocument.heliosOpinion,
    });
    const answer = buildWorkerChatFallbackAnswer(grounding, {
      prompt: "¿Me descontaron IMSS o impuestos?",
    });
    const instructions = buildWorkerChatLlmInstructions(grounding, {
      prompt: "¿Me descontaron IMSS o impuestos?",
    });

    expect(answer).toContain("Respuesta clara");
    expect(answer).toMatch(/Aún no hay resultado de TU consulta|Consultar IMSS y SAT/);
    expect(answer).toContain(WORKER_CHAT_DISCLAIMER);
    expect(answer).not.toMatch(/Helios|CompliLink|required_plan|current_plan|\|\|/i);
    expect(instructions).toMatch(/Responde solo con base en este expediente/);
    expect(hasForbiddenWorkerChatClaim(answer)).toBe(false);
  });

  it("si preguntan IMSS, ISR e Infonavit, el fallback cubre los tres en las 4 secciones", () => {
    const grounding = buildWorkerChatGrounding({
      documents: [payrollDocument],
      opinion: payrollDocument.heliosOpinion,
    });
    const answer = buildWorkerChatFallbackAnswer(grounding, {
      prompt: "¿Me descontaron IMSS, impuestos o Infonavit?",
    });
    const instructions = buildWorkerChatLlmInstructions(grounding, {
      prompt: "¿Me descontaron IMSS, impuestos o Infonavit?",
    });

    expect(answer).toContain("Respuesta clara");
    expect(answer).toMatch(/Aún no hay resultado de TU consulta|Consultar IMSS y SAT/);
    expect(answer).toContain(WORKER_CHAT_DISCLAIMER);
    expect(answer).not.toMatch(/Helios|CompliLink|required_plan|current_plan|\|\|/i);
    expect(instructions).toMatch(/Responde solo con base en este expediente/);
    expect(hasForbiddenWorkerChatClaim(answer)).toBe(false);
  });

  it("si preguntan por IMSS, el fallback local cita el descuento y niega el alta oficial", () => {
    const grounding = buildWorkerChatGrounding({
      documents: [payrollDocument],
      opinion: payrollDocument.heliosOpinion,
    });
    const answer = buildWorkerChatFallbackAnswer(grounding, { prompt: "¿Me descontaron IMSS?" });

    expect(grounding.prefersRemoteOpinion).toBe(false);
    expect(answer).toMatch(/Aún no hay resultado de TU consulta|Consultar IMSS y SAT/);
    expect(answer).not.toMatch(/tesis|jurisprudencia|Helios|CompliLink/i);
    expect(hasForbiddenWorkerChatClaim(answer)).toBe(false);
  });

  it("si hay opinión remota usable, el asesor la prefiere sobre la plantilla local", () => {
    const remoteOpinion = {
      mode: "remote",
      status: "completed",
      summary: "Ya hay una lectura consolidada del recibo.",
      legalOpinion: "Ya hay una lectura consolidada del recibo para contrastar pagos y descuentos.",
      recommendedNextStep: "Compara este recibo con el CFDI del mismo periodo.",
      keyFactsUsed: ["Periodo 1 al 15 de mayo"],
      uncertainties: ["Falta el CFDI para cerrar el cruce."],
      legalFoundations: payrollDocument.heliosOpinion.legalFoundations,
      rawPayload: payrollDocument.heliosOpinion.rawPayload,
    };
    const grounding = buildWorkerChatGrounding({
      documents: [{ ...payrollDocument, heliosOpinion: remoteOpinion }],
      opinion: remoteOpinion,
    });
    const answer = buildWorkerChatFallbackAnswer(grounding, { prompt: "¿Me descontaron IMSS?" });
    const instructions = buildWorkerChatLlmInstructions(grounding, {
      prompt: "¿Me descontaron IMSS?",
    });

    expect(grounding.prefersRemoteOpinion).toBe(true);
    expect(grounding.reviewSource).toBe("remote");
    expect(answer).toMatch(/Aún no hay resultado de TU consulta|Consultar IMSS y SAT/);
    expect(instructions).toMatch(/Responde solo con base en este expediente/);
    expect(hasForbiddenWorkerChatClaim(answer)).toBe(false);
  });

  it("sin documentos no inventa IMSS ni jurisprudencia", () => {
    const grounding = buildWorkerChatGrounding({ documents: [] });
    const answer = buildWorkerChatFallbackAnswer(grounding);
    const prompts = buildWorkerChatSuggestedPrompts(grounding);

    expect(grounding.liveImssValidation).toBe(false);
    expect(grounding.legalFoundations).toEqual([]);
    expect(answer).toMatch(/todavía no hay un documento/i);
    expect(answer).toContain("Siguiente paso");
    expect(prompts).toEqual([]);
    expect(hasForbiddenWorkerChatClaim(answer)).toBe(false);
  });

  it("nombra a la persona y al patrón de ESTE expediente en fallback e instrucciones", () => {
    const grounding = buildWorkerChatGrounding({
      documents: [payrollDocument],
      opinion: payrollDocument.heliosOpinion,
      workerName: "María López",
      employerName: "Compañía Norte",
      caseTitle: "Revisión de recibo mayo",
      riskLevel: "medium",
    });
    const emptyGrounding = buildWorkerChatGrounding({
      documents: [],
      workerName: "María López",
      employerName: "Compañía Norte",
    });
    const answer = buildWorkerChatFallbackAnswer(grounding, { prompt: "¿Qué es el IMSS?" });
    const emptyAnswer = buildWorkerChatFallbackAnswer(emptyGrounding);
    const instructions = buildWorkerChatLlmInstructions(grounding, { prompt: "¿Qué es el IMSS?" });

    expect(answer).toMatch(/Aún no hay resultado de TU consulta|María López|Consultar IMSS y SAT/);
    expect(emptyAnswer).toMatch(/María López/);
    expect(emptyAnswer).toMatch(/Compañía Norte/);
    expect(instructions).toMatch(/persona trabajadora: María López/);
    expect(instructions).toMatch(/patrón: Compañía Norte/);
    expect(instructions).toMatch(/aplica todo a los papeles|caso concreto/i);
    expect(instructions).toMatch(/explícalo aplicado a ESTE expediente/);
    expect(instructions).not.toMatch(/Cavazos|de la Cueva|de Buen|AES-256|JWT/i);
    expect(instructions).toMatch(/NUNCA escribas Helios/);
    expect(hasForbiddenWorkerChatClaim(answer)).toBe(false);
  });

  it("limpia una respuesta del modelo que inventa tesis y alta IMSS", () => {
    const grounding = buildWorkerChatGrounding({
      documents: [payrollDocument],
      opinion: payrollDocument.heliosOpinion,
    });
    const dirty =
      "Respuesta clara: Helios ya validamos ante el IMSS. Tesis 1a./J. 12/2024 del Semanario Judicial confirma que estás dado de alta.\nQué hacer ahora: Nada, ya quedó.";

    const clean = sanitizeWorkerChatAnswer(dirty, grounding);
    expect(clean).not.toMatch(/Helios|tesis|Semanario|validamos ante el IMSS/i);
    expect(clean).toContain("Siguiente paso");
    expect(clean).toContain(WORKER_CHAT_DISCLAIMER);
    expect(hasForbiddenWorkerChatClaim(clean)).toBe(false);
  });

  it("el prompt del modelo prohíbe consulta en vivo y jurisprudencia inventada", () => {
    const grounding = buildWorkerChatGrounding({
      documents: [payrollDocument],
      opinion: payrollDocument.heliosOpinion,
    });
    const instructions = buildWorkerChatLlmInstructions(grounding);

    expect(instructions).toMatch(/nunca inventes tesis/i);
    expect(instructions).toMatch(/Responde solo con base en este expediente y estas consultas/i);
    expect(instructions).toMatch(/a[uú]n no hay resultado/i);
    expect(instructions).toContain("pagos y deducciones");
    expect(instructions).toContain(WORKER_CHAT_DISCLAIMER);
    expect(instructions).toMatch(/resultado de TU consulta/i);
    expect(instructions).toMatch(/este expediente/i);
    expect(instructions).toMatch(/NUNCA escribas Helios/);
    expect(instructions).not.toMatch(/Internamente puedes razonar como Helios/);
    expect(instructions).toMatch(/Respuesta clara/);
    expect(instructions).toMatch(/Lo que s[ií] se sabe/);
    expect(instructions).toMatch(/Lo que falta/);
    expect(instructions).toMatch(/Siguiente paso/);
    expect(instructions).toMatch(/Hechos visibles/);
    expect(instructions).toMatch(/\$120\.50|12345678901/);
    expect(instructions).toMatch(/Siguiente paso ya anclado/);
    expect(instructions).toMatch(/Lecturas oficiales del digest/);
    expect(instructions).toMatch(/doctrina de la Corte, no jurisprudencia/);
  });

  it("en una pregunta legal cita títulos reales del digest y etiqueta doctrina", () => {
    const digest = {
      citations: [
        {
          title:
            "TIEMPO EXTRAORDINARIO DE LAS PERSONAS TRABAJADORAS AL SERVICIO DEL ESTADO DE GUERRERO. NO ES REQUISITO LA AUTORIZACIÓN POR ESCRITO DE LA PATRONAL PARA LABORARLAS, A FIN DE RECLAMAR SU PAGO [INTERRUPCIÓN DE LA JURISPRUDENCIA XXI.2o.C.T. J/1 L (11a.)].",
          url: "https://sjf2.scjn.gob.mx/detalle/tesis/2032611",
          source: "scjn" as const,
          kind: "doctrina" as const,
          kindLabel: "Doctrina de la Corte, no jurisprudencia",
          officialId: "2032611",
          publishedAt: "2026-09-04 10:13",
          matchedTopics: ["tiempo extraordinario"],
          freshness: "last_good" as const,
        },
      ],
      freshness: "last_good" as const,
      liveAttempted: false,
      liveBlocked: false,
      honestyNote:
        "Estas lecturas oficiales las tengo de una consulta anterior. Ahora no pude abrir la Corte o el Diario Oficial.",
    };
    const grounding = buildWorkerChatGrounding({
      documents: [payrollDocument],
      opinion: payrollDocument.heliosOpinion,
      officialDigest: digest,
    });
    const answer = buildWorkerChatFallbackAnswer(grounding, {
      prompt: "¿Qué dice la ley sobre horas extra?",
    });
    const instructions = buildWorkerChatLlmInstructions(grounding, {
      prompt: "¿Qué dice la ley sobre horas extra?",
    });

    expect(answer).toContain("Lecturas oficiales");
    expect(answer).toContain("TIEMPO EXTRAORDINARIO DE LAS PERSONAS TRABAJADORAS");
    expect(answer).toContain("consulta anterior");
    expect(answer).not.toContain(digest.citations[0]!.title);
    expect(answer).not.toMatch(/registro digital 2032611|IUS 2032611|XXI\.2o\.C\.T\.1/);
    expect(instructions).toContain("https://sjf2.scjn.gob.mx/detalle/tesis/2032611");
    expect(instructions).toContain("TIEMPO EXTRAORDINARIO DE LAS PERSONAS TRABAJADORAS");
    expect(instructions).not.toContain(digest.citations[0]!.title);
    expect(instructions).toMatch(/Doctrina de la Corte, no jurisprudencia/);
    expect(hasForbiddenWorkerChatClaim(answer)).toBe(false);
  });

  it("en una pregunta de IMSS del recibo no arrastra Lecturas oficiales ni DOF de subcontratación", () => {
    const digest = {
      citations: listLastGoodOfficialCitations(),
      freshness: "last_good" as const,
      liveAttempted: false,
      liveBlocked: false,
      honestyNote:
        "Estas lecturas oficiales las tengo de una consulta anterior. Ahora no pude abrir la Corte o el Diario Oficial.",
    };
    const grounding = buildWorkerChatGrounding({
      documents: [payrollDocument],
      opinion: payrollDocument.heliosOpinion,
      officialDigest: digest,
    });
    const leaked =
      "Respuesta clara: En tu recibo se ve un descuento de IMSS.\nLecturas oficiales:\n" +
      digest.citations[0]!.title +
      "\nDecreto por el que se reforman, adicionan y derogan diversas disposiciones de la Ley Federal del Trabajo; de la Ley del Seguro Social";
    const answer = sanitizeWorkerChatAnswer(leaked, grounding, {
      prompt: "¿Me descontaron IMSS?",
    });
    const fallback = buildWorkerChatFallbackAnswer(grounding, {
      prompt: "¿Me descontaron IMSS?",
    });
    const instructions = buildWorkerChatLlmInstructions(grounding, {
      prompt: "¿Me descontaron IMSS?",
    });

    expect(answer).toContain("Respuesta clara");
    expect(answer).toContain("Lo que sí se sabe");
    expect(answer).toContain("Lo que falta");
    expect(answer).toContain("Siguiente paso");
    expect(answer).not.toMatch(/Lecturas oficiales|Subcontrataci[oó]n|Diario Oficial|consulta anterior/i);
    expect(fallback).not.toMatch(/Lecturas oficiales|Subcontrataci[oó]n|Diario Oficial/i);
    expect(instructions).toMatch(/NO agregues la secci[oó]n Lecturas oficiales/i);
    expect(instructions).not.toContain(digest.citations[0]!.title);
  });

  it("en plan gratis recorta a un documento y deja upsell limpio, sin marcadores", () => {
    const secondDocument = {
      documentType: "cfdi",
      originalName: "cfdi-mayo.pdf",
      createdAt: new Date("2026-05-02T10:00:00.000Z"),
      heliosOpinion: {
        summary: "El CFDI muestra el mismo periodo.",
      },
    };
    const principal = {
      ...payrollDocument,
      createdAt: new Date("2026-05-16T10:00:00.000Z"),
    };
    const scoped = scopeWorkerChatDocumentsForPlan({
      documents: [secondDocument, principal],
      canUseMultiDocument: false,
    });

    expect(pickPrincipalWorkerChatDocument([secondDocument, principal])?.originalName).toBe(
      "recibo-mayo.pdf",
    );
    expect(scoped.scopedToSingleDocument).toBe(true);
    expect(scoped.documents).toHaveLength(1);
    expect(scoped.documents[0]?.originalName).toBe("recibo-mayo.pdf");
    expect(scoped.upsell).toBe(WORKER_CHAT_MULTI_DOC_UPSELL);
    expect(hasInternalControlMarkers(scoped.upsell)).toBe(false);

    const grounding = buildWorkerChatGrounding({
      documents: scoped.documents,
      opinion: principal.heliosOpinion,
      multiDocUpsell: scoped.upsell,
    });
    const answer = buildWorkerChatFallbackAnswer(grounding);

    expect(answer).toContain("Respuesta clara");
    expect(answer).toContain("Lo que sí se sabe");
    expect(answer).toContain("Lo que falta");
    expect(answer).toContain("Siguiente paso");
    expect(answer).toContain(WORKER_CHAT_MULTI_DOC_UPSELL);
    expect(answer).not.toMatch(/required_plan|current_plan|\|\|/);
    expect(hasForbiddenWorkerChatClaim(answer)).toBe(false);
  });

  it("con multi-documento habilitado no recorta ni pone upsell", () => {
    const scoped = scopeWorkerChatDocumentsForPlan({
      documents: [payrollDocument, { documentType: "cfdi", originalName: "cfdi.pdf" }],
      canUseMultiDocument: true,
    });

    expect(scoped.scopedToSingleDocument).toBe(false);
    expect(scoped.documents).toHaveLength(2);
    expect(scoped.upsell).toBeNull();
  });
});
