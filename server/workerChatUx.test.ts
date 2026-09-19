import { describe, expect, it } from "vitest";

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
    expect(answer).toContain("Siguiente paso");
    expect(answer).toContain("Lo que sí se sabe");
    expect(answer).toContain("Lo que falta");
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
    expect(answer).toContain("Siguiente paso");
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
    expect(instructions).toMatch(/nunca digas que consultaste IMSS/i);
    expect(instructions).toMatch(/Acreditación de pagos y deducciones/);
    expect(instructions).toContain(WORKER_CHAT_DISCLAIMER);
    expect(instructions).toMatch(/Internamente puedes razonar como Helios/);
    expect(instructions).toMatch(/NUNCA escribas Helios/);
    expect(instructions).toMatch(/Respuesta clara/);
    expect(instructions).toMatch(/Lo que s[ií] se sabe/);
    expect(instructions).toMatch(/Lo que falta/);
    expect(instructions).toMatch(/Siguiente paso/);
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
