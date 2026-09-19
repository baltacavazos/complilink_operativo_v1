import { describe, expect, it } from "vitest";

import { sanitizeClientVisibleCopy } from "./clientVisibleCopy";
import {
  WORKER_CHAT_ASK_CTA,
  WORKER_CHAT_DISCLAIMER,
  WORKER_CHAT_KNOWN_HEADING,
  WORKER_CHAT_MISSING_HEADING,
  WORKER_CHAT_MULTI_DOC_UPSELL,
  WORKER_CHAT_NEXT_HEADING,
  WORKER_CHAT_SHEET_COPY,
  WORKER_CHAT_TITLE,
  buildWorkerStarterQuestions,
  extractWorkerChatSections,
  extractWorkerWhatToDoNow,
  formatWorkerChatAnswer,
  hasForbiddenLiveValidationClaim,
  hasForbiddenWorkerBrand,
  hasForbiddenWorkerChatClaim,
  hasInternalControlMarkers,
  hasInventedLegalCitation,
  parseWorkerStructuredAnswer,
  sanitizeWorkerChatCopy,
  stripInternalControlMarkers,
  toFriendlyWorkerChatError,
} from "./workerChatUx";

describe("sanitizeWorkerChatCopy", () => {
  it("quita Helios y CompliLink del copy del chat", () => {
    expect(sanitizeWorkerChatCopy("Helios generó una lectura útil")).toBe(
      "esta lectura generó una lectura útil",
    );
    expect(sanitizeWorkerChatCopy("CompliLink ya analizó tu recibo")).toBe(
      "AuditaPatrón ya analizó tu recibo",
    );
    expect(hasForbiddenWorkerBrand(sanitizeWorkerChatCopy("Preguntar a Helios"))).toBe(
      false,
    );
  });

  it("no deja tesis, registro digital ni jurisprudencia inventada", () => {
    const dirty =
      "Según la tesis 2a./J. 45/2023 (registro digital 2024567) del Semanario Judicial, tu alta ya está confirmada.";
    const clean = sanitizeWorkerChatCopy(dirty);

    expect(hasInventedLegalCitation(dirty)).toBe(true);
    expect(clean).not.toMatch(/tesis/i);
    expect(clean).not.toMatch(/registro digital/i);
    expect(clean).not.toMatch(/semanario judicial/i);
    expect(hasInventedLegalCitation(clean)).toBe(false);
  });

  it("neutraliza una validación IMSS en vivo inventada", () => {
    const dirty = "Ya validamos ante el IMSS y confirmamos tu alta.";
    const clean = sanitizeWorkerChatCopy(dirty);

    expect(hasForbiddenLiveValidationClaim(dirty)).toBe(true);
    expect(clean).toMatch(/no confirma el alta oficial|no es una consulta oficial/i);
    expect(hasForbiddenLiveValidationClaim(clean)).toBe(false);
    expect(hasForbiddenWorkerChatClaim(clean)).toBe(false);
  });

  it("no reescribe una pregunta honesta sobre el alta", () => {
    expect(sanitizeWorkerChatCopy("¿Estoy bien dado de alta?")).toBe(
      "¿Estoy bien dado de alta?",
    );
  });

  it("nunca deja required_plan, current_plan ni marcadores || visibles", () => {
    const leaked =
      "Asesor laboral con lectura de varios documentos del expediente está disponible desde Audita Esencial. Puedes seguir usando la parte gratuita o desbloquearlo cuando te haga sentido.||required_plan=essential||current_plan=free";
    const clean = sanitizeWorkerChatCopy(leaked);

    expect(hasInternalControlMarkers(leaked)).toBe(true);
    expect(hasInternalControlMarkers(clean)).toBe(false);
    expect(clean).not.toMatch(/required_plan|current_plan|\|\|/);
    expect(stripInternalControlMarkers(leaked)).not.toMatch(/\|\||required_plan=|current_plan=/);
    expect(hasForbiddenWorkerChatClaim(clean)).toBe(false);

    const friendly = toFriendlyWorkerChatError(leaked);
    expect(friendly).toContain("Respuesta clara");
    expect(friendly).toContain("Lo que sí se sabe");
    expect(friendly).toContain("Lo que falta");
    expect(friendly).toContain("Siguiente paso");
    expect(friendly).toContain(WORKER_CHAT_MULTI_DOC_UPSELL);
    expect(friendly).not.toMatch(/required_plan|current_plan|\|\|/);
    expect(hasForbiddenWorkerChatClaim(friendly)).toBe(false);
  });
});

describe("chat UX helpers", () => {
  it("arma preguntas de arranque en español plano, sin jerga interna", () => {
    const prompts = buildWorkerStarterQuestions({
      documentType: "payroll_receipt",
      documentsCount: 1,
      hasImssSignal: true,
      hasFiscalSignal: true,
    });

    expect(prompts).toContain("¿Qué dice mi recibo?");
    expect(prompts).toContain("¿Me descontaron IMSS o impuestos?");
    expect(prompts).toContain("¿Qué hago ahora?");
    expect(prompts.join(" ")).not.toMatch(/Helios|CompliLink|jurisprudencia|copiloto/i);
    expect(prompts.every((item) => item.length < 80)).toBe(true);
  });

  it("cuando no hay documentos, pide subir uno y qué hacer ahora", () => {
    const prompts = buildWorkerStarterQuestions({ documentsCount: 0 });
    expect(prompts[0]).toMatch(/documento/i);
    expect(prompts).toContain("¿Qué hago ahora?");
  });

  it("formatea una respuesta corta con qué hacer ahora y aviso honesto", () => {
    const answer = formatWorkerChatAnswer({
      answer: "En tu recibo se ve un descuento de IMSS de $120.50.",
      nextStep: "Compara ese descuento con tu siguiente recibo.",
    });

    expect(answer).toContain("Respuesta clara");
    expect(answer).toContain(WORKER_CHAT_KNOWN_HEADING);
    expect(answer).toContain(WORKER_CHAT_MISSING_HEADING);
    expect(answer).toContain(WORKER_CHAT_NEXT_HEADING);
    expect(answer).toContain("Compara ese descuento con tu siguiente recibo.");
    expect(answer).toContain(WORKER_CHAT_DISCLAIMER);
    expect(answer).toMatch(/no es asesoría legal/i);
    expect(answer).toMatch(/no soy abogado/i);
    expect(extractWorkerWhatToDoNow(answer)).toMatch(/siguiente recibo/i);
  });

  it("extrae las dos partes aunque vengan del formato largo anterior", () => {
    const sections = extractWorkerChatSections(
      [
        "1) Respuesta clara: Ya se ve el periodo en tu recibo.",
        "2) Lo que sí se sabe: Hay NSS visible.",
        "4) Siguiente paso útil: Sube el CFDI del mismo periodo.",
      ].join("\n"),
    );

    expect(sections.clearAnswer).toMatch(/periodo/i);
    expect(sections.known ?? "").toMatch(/NSS/i);
    expect(sections.nextStep ?? "").toMatch(/CFDI/i);
  });

  it("el panel usa Asesor laboral, las cuatro secciones y el sanitizador no reintroduce Helios", () => {
    expect(WORKER_CHAT_SHEET_COPY.title).toBe(WORKER_CHAT_TITLE);
    expect(WORKER_CHAT_ASK_CTA).toBe("Preguntar al asesor");
    expect(WORKER_CHAT_SHEET_COPY.promptsHeading).toBe("Empieza por aquí");
    expect(WORKER_CHAT_SHEET_COPY.capabilityBadge).toBe("No es un abogado");
    expect(WORKER_CHAT_SHEET_COPY.quickHighlights).toEqual([
      "Respuesta clara",
      "Lo que sí se sabe",
      "Lo que falta",
      "Siguiente paso",
    ]);
    expect(
      hasForbiddenWorkerBrand(
        sanitizeClientVisibleCopy(WORKER_CHAT_SHEET_COPY.description),
      ),
    ).toBe(false);
    expect(WORKER_CHAT_DISCLAIMER).toMatch(/no es asesoría legal/i);
    expect(WORKER_CHAT_DISCLAIMER).toMatch(/no soy abogado/i);
    expect(WORKER_CHAT_DISCLAIMER).toMatch(/no consulta IMSS/i);
  });

  it("prioriza las preguntas del resultCard y pinta las cuatro secciones", () => {
    const prompts = buildWorkerStarterQuestions({
      documentType: "payroll_receipt",
      documentsCount: 1,
      resultCardQuestions: ["¿Este descuento de IMSS es oficial?"],
    });
    expect(prompts[0]).toBe("¿Este descuento de IMSS es oficial?");

    const blocks = parseWorkerStructuredAnswer(
      formatWorkerChatAnswer({
        answer: "En tu recibo se ve un descuento de IMSS.",
        known: "Hay un descuento de IMSS de $120.50.",
        missing: "No hay constancia oficial de pago al IMSS.",
        nextStep: "Compara con el siguiente recibo.",
      }),
    );
    expect(blocks.map((item) => item.heading)).toEqual([
      "Respuesta clara",
      "Lo que sí se sabe",
      "Lo que falta",
      "Siguiente paso",
      null,
    ]);
    expect(blocks.at(-1)?.kind).toBe("disclaimer");
  });

  it("conserva las cuatro secciones aunque el sanitizador de UI colapse espacios", () => {
    const formatted = formatWorkerChatAnswer({
      answer: "En tu recibo se ve un descuento de IMSS.",
      known: "Hay un descuento de IMSS de $120.50.",
      missing: "No hay constancia oficial de pago al IMSS.",
      nextStep: "Compara con el siguiente recibo.",
    });
    const lineSafe = formatted
      .split(/\r?\n/)
      .map((line) => sanitizeClientVisibleCopy(line) ?? line)
      .join("\n");

    expect(lineSafe).toContain("Lo que falta");
    expect(parseWorkerStructuredAnswer(lineSafe).map((item) => item.heading)).toEqual([
      "Respuesta clara",
      "Lo que sí se sabe",
      "Lo que falta",
      "Siguiente paso",
      null,
    ]);
  });
});
