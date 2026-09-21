import { describe, expect, it } from "vitest";

import { hasForbiddenWorkerChatClaim } from "@shared/workerChatUx";
import {
  WORKER_CHAT_GENERIC_LABOR_PRIMARY_DISABLED,
  buildLaborFiscalChatGuidance,
  inferWorkerChatPromptFocus,
  listVisibleLaborFactLines,
} from "./workerChatLaborGuidance";

const FACTS = {
  period: "2026-05-01 al 2026-05-15",
  netAmount: "$4,725.60",
  perceptions: "$5,156.10",
  deductions: "$430.50",
  employerRfc: "ECC190605VA1",
  workerRfc: "XOXX010101000",
  nss: "12345678901",
  employerRegistration: null,
  isrWithheld: "$310.00",
  imssWithheld: "$120.50",
  infonavitWithheld: "$80.00",
};

const localInput = {
  documentsCount: 1,
  documentType: "payroll_receipt",
  summary: "El recibo muestra periodo, neto y descuentos.",
  recommendedNextStep: "Compara el descuento con tu siguiente recibo.",
  uncertainties: ["No se ve una constancia oficial de semanas cotizadas."],
  keyFacts: ["Periodo 1 al 15 de mayo", "NSS 12345678901"],
  legalFoundations: [
    {
      title: "Acreditación de pagos y deducciones",
      reference: "Recibos y comprobantes fiscales laborales",
      relevance: "Permite revisar si los pagos documentados coinciden con la relación laboral.",
    },
  ],
  laborFacts: FACTS,
  laborExplanations: [
    {
      label: "Periodo visible",
      summary: "El periodo que se alcanza a leer es 2026-05-01 al 2026-05-15.",
    },
  ],
  hasImssSignal: true,
  hasFiscalSignal: true,
  hasInfonavitSignal: true,
  missingDocumentLabel: "CFDI del mismo periodo",
  missingDocumentReason: "Sirve para comparar lo timbrado con tu recibo.",
  sourceOpinion: {
    mode: "mock",
    status: "completed",
    summary: "El recibo muestra periodo, neto y descuentos.",
    recommendedNextStep: "Compara el descuento con tu siguiente recibo.",
    legalFoundations: [
      {
        title: "Acreditación de pagos y deducciones",
        reference: "Recibos y comprobantes fiscales laborales",
        relevance: "Permite revisar si los pagos documentados coinciden con la relación laboral.",
      },
    ],
  },
};

describe("workerChatLaborGuidance", () => {
  it("apaga el consejo genérico como respuesta principal del chat de caso", () => {
    expect(WORKER_CHAT_GENERIC_LABOR_PRIMARY_DISABLED).toBe(true);
    const guidance = buildLaborFiscalChatGuidance(
      { ...localInput, caseChatPrimary: true },
      "¿Qué hago ahora?",
    );
    expect(guidance.clearAnswer).toMatch(/resultado de TU consulta|este expediente/i);
    expect(guidance.clearAnswer).not.toMatch(/ya hay una primera lectura/i);
    expect(guidance.clearAnswer).not.toMatch(/Helios|CompliLink|\bcumple\b/i);
  });

  it("lista solo hechos visibles del papel", () => {
    expect(listVisibleLaborFactLines(FACTS)).toEqual(
      expect.arrayContaining([
        "periodo 2026-05-01 al 2026-05-15",
        "neto $4,725.60",
        "ISR $310.00",
        "IMSS $120.50",
        "Infonavit $80.00",
        "NSS 12345678901",
      ]),
    );
  });

  it("detecta el foco de la pregunta sin inventar portales", () => {
    expect(inferWorkerChatPromptFocus("¿Me descontaron IMSS?")).toBe("imss");
    expect(inferWorkerChatPromptFocus("¿Estoy bien dado de alta?")).toBe("alta");
    expect(inferWorkerChatPromptFocus("¿Me descontaron impuestos?")).toBe("fiscal");
    expect(inferWorkerChatPromptFocus("¿Me descontaron IMSS o impuestos?")).toBe("imss_fiscal");
    expect(inferWorkerChatPromptFocus("¿Reviso IMSS e ISR?")).toBe("imss_fiscal");
    expect(inferWorkerChatPromptFocus("¿El NSS y las retenciones coinciden?")).toBe("imss_fiscal");
    expect(inferWorkerChatPromptFocus("¿Me descontaron la retención IMSS?")).toBe("imss");
    expect(inferWorkerChatPromptFocus("¿Qué hay de Infonavit?")).toBe("infonavit");
    expect(inferWorkerChatPromptFocus("¿Me descontaron IMSS o Infonavit?")).toBe("imss_infonavit");
    expect(inferWorkerChatPromptFocus("¿Reviso ISR e Infonavit?")).toBe("fiscal_infonavit");
    expect(inferWorkerChatPromptFocus("¿Me descontaron IMSS, impuestos o Infonavit?")).toBe(
      "imss_fiscal_infonavit",
    );
    expect(inferWorkerChatPromptFocus("¿Reviso IMSS, ISR e Infonavit?")).toBe(
      "imss_fiscal_infonavit",
    );
    expect(inferWorkerChatPromptFocus("¿Qué hago ahora?")).toBe("general");
  });

  it("ancla la respuesta clara en la persona trabajadora y el patrón de ESTE expediente", () => {
    const guidance = buildLaborFiscalChatGuidance(
      {
        ...localInput,
        workerName: "María López",
        employerName: "Compañía Norte",
      },
      "¿Qué es el IMSS?",
    );

    expect(guidance.clearAnswer).toMatch(/María López/);
    expect(guidance.clearAnswer).toMatch(/Compañía Norte/);
    expect(guidance.clearAnswer).toMatch(/IMSS|\$120\.50|NSS/);
    expect(`${guidance.clearAnswer} ${guidance.nextStep}`).not.toMatch(
      /Cavazos|de la Cueva|de Buen|Helios|AES-256|JWT/i,
    );
  });

  it("en la ruta local profundiza el siguiente paso con periodo, montos y base ya presente", () => {
    const guidance = buildLaborFiscalChatGuidance(localInput, "¿Qué hago ahora?");

    expect(guidance.prefersRemoteOpinion).toBe(false);
    expect(guidance.reviewSource).toBe("local");
    expect(guidance.clearAnswer).toMatch(/\$120\.50|\$310\.00|2026-05-01 al 2026-05-15/);
    expect(guidance.clearAnswer).toMatch(/acreditaci[oó]n de pagos/i);
    expect(guidance.known).toMatch(/NSS 12345678901/);
    expect(guidance.missing).toMatch(/semanas cotizadas|CFDI/i);
    expect(guidance.nextStep).toMatch(/siguiente recibo|CFDI|periodo/i);
    expect(guidance.nextStep).toMatch(/no confirma|no prueba/i);
    expect(guidance.nextStep).toMatch(/acreditaci[oó]n de pagos/i);
    expect(hasForbiddenWorkerChatClaim(`${guidance.clearAnswer} ${guidance.nextStep}`)).toBe(false);
    expect(`${guidance.clearAnswer} ${guidance.nextStep}`).not.toMatch(
      /tesis|jurisprudencia|Helios|CompliLink|consulta en vivo/i,
    );
  });

  it("si preguntan por IMSS, el siguiente paso local cruza el descuento sin fingir alta", () => {
    const guidance = buildLaborFiscalChatGuidance(localInput, "¿Me descontaron IMSS?");

    expect(guidance.promptFocus).toBe("imss");
    expect(guidance.nextStep).toMatch(/IMSS \$120\.50/);
    expect(guidance.nextStep).toMatch(/no confirma alta/i);
    expect(guidance.nextStep).not.toMatch(/tesis|registro digital|Semanario/i);
    expect(hasForbiddenWorkerChatClaim(guidance.nextStep)).toBe(false);
  });

  it("si preguntan por impuestos, el siguiente paso local cruza ISR con el CFDI", () => {
    const guidance = buildLaborFiscalChatGuidance(localInput, "¿Me descontaron impuestos?");

    expect(guidance.promptFocus).toBe("fiscal");
    expect(guidance.nextStep).toMatch(/ISR \$310\.00/);
    expect(guidance.nextStep).toMatch(/CFDI|depositaron/i);
    expect(guidance.nextStep).toMatch(/no prueba el entero al SAT/i);
    expect(hasForbiddenWorkerChatClaim(guidance.nextStep)).toBe(false);
  });

  it("si preguntan IMSS e ISR juntos, el siguiente paso cubre alta y retención", () => {
    const guidance = buildLaborFiscalChatGuidance(
      localInput,
      "¿Me descontaron IMSS o impuestos?",
    );

    expect(guidance.promptFocus).toBe("imss_fiscal");
    expect(guidance.nextStep).toMatch(/IMSS \$120\.50|NSS 12345678901/);
    expect(guidance.nextStep).toMatch(/no confirma el alta oficial/i);
    expect(guidance.nextStep).toMatch(/ISR \$310\.00/);
    expect(guidance.nextStep).toMatch(/CFDI|depositaron/i);
    expect(guidance.nextStep).not.toMatch(/Infonavit/i);
    expect(guidance.nextStep).not.toMatch(/tesis|registro digital|Semanario|Helios|consulta en vivo/i);
    expect(hasForbiddenWorkerChatClaim(guidance.nextStep)).toBe(false);
  });

  it("si preguntan por Infonavit, el siguiente paso local cruza retención o crédito", () => {
    const guidance = buildLaborFiscalChatGuidance(localInput, "¿Qué hay de Infonavit?");

    expect(guidance.promptFocus).toBe("infonavit");
    expect(guidance.nextStep).toMatch(/Infonavit \$80\.00/);
    expect(guidance.nextStep).toMatch(/aviso de retenci[oó]n|estado de cr[eé]dito/i);
    expect(guidance.nextStep).toMatch(/no prueba/i);
    expect(guidance.nextStep).not.toMatch(/tesis|Helios|consulta en vivo/i);
    expect(hasForbiddenWorkerChatClaim(guidance.nextStep)).toBe(false);
  });

  it("si preguntan IMSS e Infonavit juntos, el siguiente paso cubre alta y crédito", () => {
    const guidance = buildLaborFiscalChatGuidance(
      localInput,
      "¿Me descontaron IMSS o Infonavit?",
    );

    expect(guidance.promptFocus).toBe("imss_infonavit");
    expect(guidance.nextStep).toMatch(/IMSS \$120\.50|NSS 12345678901/);
    expect(guidance.nextStep).toMatch(/no confirma el alta oficial/i);
    expect(guidance.nextStep).toMatch(/Infonavit \$80\.00/);
    expect(guidance.nextStep).toMatch(/aviso de retenci[oó]n|estado de cr[eé]dito/i);
    expect(guidance.nextStep).not.toMatch(/tesis|Helios|consulta en vivo/i);
    expect(hasForbiddenWorkerChatClaim(guidance.nextStep)).toBe(false);
  });

  it("si preguntan ISR e Infonavit juntos, el siguiente paso cubre retención y crédito", () => {
    const guidance = buildLaborFiscalChatGuidance(
      localInput,
      "¿Reviso ISR e Infonavit?",
    );

    expect(guidance.promptFocus).toBe("fiscal_infonavit");
    expect(guidance.nextStep).toMatch(/ISR \$310\.00/);
    expect(guidance.nextStep).toMatch(/CFDI|depositaron/i);
    expect(guidance.nextStep).toMatch(/Infonavit \$80\.00/);
    expect(guidance.nextStep).toMatch(/aviso de retenci[oó]n|estado de cr[eé]dito/i);
    expect(hasForbiddenWorkerChatClaim(guidance.nextStep)).toBe(false);
  });

  it("si preguntan IMSS, ISR e Infonavit, el siguiente paso cubre los tres", () => {
    const guidance = buildLaborFiscalChatGuidance(
      localInput,
      "¿Me descontaron IMSS, impuestos o Infonavit?",
    );

    expect(guidance.promptFocus).toBe("imss_fiscal_infonavit");
    expect(guidance.nextStep).toMatch(/IMSS \$120\.50|NSS 12345678901/);
    expect(guidance.nextStep).toMatch(/no confirma el alta oficial/i);
    expect(guidance.nextStep).toMatch(/ISR \$310\.00/);
    expect(guidance.nextStep).toMatch(/CFDI|depositaron/i);
    expect(guidance.nextStep).toMatch(/Infonavit \$80\.00/);
    expect(guidance.nextStep).toMatch(/aviso de retenci[oó]n|estado de cr[eé]dito/i);
    expect(guidance.nextStep).not.toMatch(/tesis|registro digital|Semanario|Helios|consulta en vivo/i);
    expect(hasForbiddenWorkerChatClaim(guidance.nextStep)).toBe(false);
  });

  it("si preguntan los tres sin monto Infonavit, igual pide cruce de retención o crédito", () => {
    const guidance = buildLaborFiscalChatGuidance(
      {
        ...localInput,
        laborFacts: { ...FACTS, infonavitWithheld: null },
        hasInfonavitSignal: false,
      },
      "¿Reviso IMSS, ISR e Infonavit?",
    );

    expect(guidance.promptFocus).toBe("imss_fiscal_infonavit");
    expect(guidance.nextStep).toMatch(/no confirma el alta oficial/i);
    expect(guidance.nextStep).toMatch(/ISR|CFDI|dep[oó]sito/i);
    expect(guidance.nextStep).toMatch(/Infonavit/i);
    expect(guidance.nextStep).toMatch(/aviso de retenci[oó]n|estado de cr[eé]dito/i);
    expect(hasForbiddenWorkerChatClaim(guidance.nextStep)).toBe(false);
  });

  it("si preguntan IMSS y retenciones sin monto ISR, igual pide cruce fiscal concreto", () => {
    const guidance = buildLaborFiscalChatGuidance(
      {
        ...localInput,
        laborFacts: { ...FACTS, isrWithheld: null },
        hasFiscalSignal: false,
      },
      "¿Reviso IMSS y las retenciones?",
    );

    expect(guidance.promptFocus).toBe("imss_fiscal");
    expect(guidance.nextStep).toMatch(/no confirma el alta oficial|no confirma alta/i);
    expect(guidance.nextStep).toMatch(/CFDI|dep[oó]sito/i);
    expect(guidance.nextStep).toMatch(/ISR|impuestos|retenciones/i);
    expect(hasForbiddenWorkerChatClaim(guidance.nextStep)).toBe(false);
  });

  it("si hay opinión remota usable, la prefiere y no la sustituye por la plantilla local", () => {
    const guidance = buildLaborFiscalChatGuidance(
      {
        ...localInput,
        recommendedNextStep: "Compara este CFDI con el recibo del mismo periodo.",
        summary: "Ya hay una lectura consolidada del CFDI.",
        sourceOpinion: {
          mode: "remote",
          status: "completed",
          summary: "Ya hay una lectura consolidada del CFDI.",
          legalOpinion:
            "Ya hay una lectura consolidada del CFDI para contrastar pagos y descuentos.",
          recommendedNextStep: "Compara este CFDI con el recibo del mismo periodo.",
          resultCard: {
            nextStepSummary: "Compara este CFDI con el recibo del mismo periodo.",
          },
        },
      },
      "¿Me descontaron IMSS?",
    );

    expect(guidance.prefersRemoteOpinion).toBe(true);
    expect(guidance.reviewSource).toBe("remote");
    expect(guidance.nextStepSource).toBe("remote");
    expect(guidance.clearAnswer).toMatch(/lectura consolidada/i);
    expect(guidance.nextStep).toMatch(/Compara este CFDI con el recibo del mismo periodo/);
    expect(guidance.nextStep).toMatch(/no confirma alta/i);
    expect(guidance.nextStep).not.toMatch(/Cruza el descuento IMSS/i);
    expect(hasForbiddenWorkerChatClaim(`${guidance.clearAnswer} ${guidance.nextStep}`)).toBe(false);
  });
});
