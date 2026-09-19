import { describe, expect, it } from "vitest";

import { WORKER_CHAT_DISCLAIMER, hasForbiddenWorkerChatClaim } from "@shared/workerChatUx";
import {
  buildWorkerChatFallbackAnswer,
  buildWorkerChatGrounding,
  buildWorkerChatLlmInstructions,
  buildWorkerChatSuggestedPrompts,
  sanitizeWorkerChatAnswer,
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
    expect(grounding.validationMode).toBe("document_signals");
    expect(grounding.hasImssSignal).toBe(true);
    expect(grounding.hasFiscalSignal).toBe(true);
    expect(grounding.laborFacts.nss).toBe("12345678901");
    expect(grounding.laborFacts.imssWithheld).toBe("$120.50");
    expect(grounding.legalFoundations[0]?.title).toBe("Acreditación de pagos y deducciones");
    expect(grounding.disclaimer).toBe(WORKER_CHAT_DISCLAIMER);

    const answer = buildWorkerChatFallbackAnswer(grounding);
    expect(answer).toMatch(/NSS 12345678901|\$120\.50|periodo/i);
    expect(answer).toMatch(/acreditaci[oó]n de pagos/i);
    expect(answer).toContain("Qué hacer ahora");
    expect(answer).toContain(WORKER_CHAT_DISCLAIMER);
    expect(answer).not.toMatch(/consulta en vivo|validaci[oó]n en vivo/i);
    expect(answer).not.toMatch(/tesis|jurisprudencia|Helios|CompliLink/i);
    expect(hasForbiddenWorkerChatClaim(answer)).toBe(false);
  });

  it("sin documentos no inventa IMSS ni jurisprudencia", () => {
    const grounding = buildWorkerChatGrounding({ documents: [] });
    const answer = buildWorkerChatFallbackAnswer(grounding);
    const prompts = buildWorkerChatSuggestedPrompts(grounding);

    expect(grounding.liveImssValidation).toBe(false);
    expect(grounding.legalFoundations).toEqual([]);
    expect(answer).toMatch(/todavía no hay un documento/i);
    expect(answer).toContain("Qué hacer ahora");
    expect(prompts).toContain("¿Qué hago ahora?");
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
    expect(clean).toContain("Qué hacer ahora");
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
    expect(instructions).toMatch(/nunca digas que consultaste IMSS/i);
    expect(instructions).toMatch(/Acreditación de pagos y deducciones/);
    expect(instructions).toContain(WORKER_CHAT_DISCLAIMER);
    expect(instructions).toMatch(/Qu[eé] hacer ahora/);
  });
});
