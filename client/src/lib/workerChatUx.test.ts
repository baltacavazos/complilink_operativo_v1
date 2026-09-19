import { describe, expect, it } from "vitest";

import { DOF_LAST_GOOD_SEED, listLastGoodOfficialCitations } from "@shared/officialDigest";
import { sanitizeClientVisibleCopy } from "./clientVisibleCopy";
import {
  WORKER_CHAT_ASK_CTA,
  WORKER_CHAT_DISCLAIMER,
  WORKER_CHAT_HISTORY_MAX_CONTENT_CHARS,
  WORKER_CHAT_HISTORY_MAX_MESSAGES,
  WORKER_CHAT_KNOWN_HEADING,
  WORKER_CHAT_MISSING_HEADING,
  WORKER_CHAT_MULTI_DOC_UPSELL,
  WORKER_CHAT_NEXT_HEADING,
  WORKER_CHAT_RETRY_ERROR,
  WORKER_CHAT_SHEET_COPY,
  WORKER_CHAT_TITLE,
  buildWorkerStarterQuestions,
  capWorkerChatConversationHistory,
  capWorkerChatHistoryContent,
  extractWorkerChatSections,
  extractWorkerWhatToDoNow,
  formatWorkerChatAnswer,
  hasForbiddenLiveValidationClaim,
  hasForbiddenWorkerBrand,
  hasForbiddenWorkerChatClaim,
  hasInternalControlMarkers,
  hasInventedLegalCitation,
  parseWorkerStructuredAnswer,
  sanitizeVisibleChatHistoryContent,
  sanitizeVisibleChatHistoryMessages,
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

  it("conserva un título y liga oficiales reales del digest", () => {
    const official =
      "OFRECIMIENTO DE TRABAJO. PARA CALIFICARLO DE BUENA FE Y, EN SU CASO, DETERMINAR LA PROCEDENCIA DE LA REVERSIÓN DE LA CARGA DE LA PRUEBA, NO DEBEN VALORARSE LOS MEDIOS PROBATORIOS RELACIONADOS CON LA EXISTENCIA O INEXISTENCIA DEL DESPIDO QUE DIO ORIGEN AL JUICIO LABORAL. https://sjf2.scjn.gob.mx/detalle/tesis/2032614";
    const clean = sanitizeWorkerChatCopy(official);

    expect(hasInventedLegalCitation(official)).toBe(false);
    expect(clean).toContain("OFRECIMIENTO DE TRABAJO");
    expect(clean).toContain("https://sjf2.scjn.gob.mx/detalle/tesis/2032614");
    expect(hasInventedLegalCitation(clean)).toBe(false);
    expect(hasInventedLegalCitation("https://sjf2.scjn.gob.mx/detalle/tesis/9999999")).toBe(true);
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

describe("sanitizeVisibleChatHistoryContent", () => {
  it("al cargar historial viejo reemplaza el blob Zod/too_big por español limpio", () => {
    const zodBlob = JSON.stringify([
      {
        origin: "string",
        code: "too_big",
        maximum: 2000,
        inclusive: true,
        path: ["conversationHistory", 3, "content"],
        message: "Too big: expected string to have <=2000 characters",
      },
    ]);

    expect(sanitizeVisibleChatHistoryContent(zodBlob)).toBe(WORKER_CHAT_RETRY_ERROR);
    expect(sanitizeVisibleChatHistoryContent(zodBlob)).not.toMatch(
      /too_big|conversationHistory|"code"|maximum/i,
    );
    expect(
      sanitizeVisibleChatHistoryMessages([
        { role: "user", content: "¿Me descontaron IMSS?" },
        { role: "assistant", content: zodBlob },
      ]),
    ).toEqual([
      { role: "user", content: "¿Me descontaron IMSS?" },
      { role: "assistant", content: WORKER_CHAT_RETRY_ERROR },
    ]);
  });

  it("limpia burbujas viejas de localStorage y no deja required_plan/current_plan", () => {
    const storedLeak =
      "Asesor laboral con lectura de varios documentos del expediente está disponible desde Audita Esencial. Puedes seguir usando la parte gratuita o desbloquearlo cuando te haga sentido.||required_plan=essential||current_plan=free";
    const rendered = sanitizeVisibleChatHistoryContent(storedLeak);

    expect(rendered).toContain("Respuesta clara");
    expect(rendered).toContain("Lo que sí se sabe");
    expect(rendered).toContain("Lo que falta");
    expect(rendered).toContain("Siguiente paso");
    expect(rendered).toContain(WORKER_CHAT_MULTI_DOC_UPSELL);
    expect(rendered).not.toMatch(/required_plan|current_plan|\|\|/);
    expect(hasInternalControlMarkers(rendered)).toBe(false);
    expect(hasForbiddenWorkerChatClaim(rendered)).toBe(false);
    expect(rendered).not.toMatch(/\bHelios\b/i);
  });

  it("al sanitizar historial no borra un siguiente paso IMSS+ISR+Infonavit", () => {
    const tripleAnswer = formatWorkerChatAnswer({
      answer: "En tu recibo se ve IMSS $120.50, ISR $310.00 e Infonavit $80.00.",
      known: "Periodo 2026-05-01 al 2026-05-15. IMSS $120.50. ISR $310.00. Infonavit $80.00.",
      missing: "No hay constancia oficial de alta, entero al SAT ni estado de crédito Infonavit.",
      nextStep:
        "Cruza el descuento IMSS $120.50 y el NSS 12345678901 con tu siguiente recibo o un papel IMSS; eso no confirma el alta oficial. Cruza también la retención ISR $310.00 con el CFDI o el depósito del mismo periodo. Cruza también el descuento Infonavit $80.00 con tu aviso de retención o estado de crédito.",
    });
    const rendered = sanitizeVisibleChatHistoryContent(tripleAnswer);

    expect(parseWorkerStructuredAnswer(rendered).map((item) => item.heading)).toEqual([
      "Respuesta clara",
      "Lo que sí se sabe",
      "Lo que falta",
      "Siguiente paso",
      null,
    ]);
    expect(rendered).toMatch(/no confirma el alta oficial/i);
    expect(rendered).toMatch(/ISR \$310\.00/);
    expect(rendered).toMatch(/Infonavit \$80\.00/);
    expect(rendered).toMatch(/aviso de retenci[oó]n|estado de cr[eé]dito/i);
    expect(rendered).not.toMatch(/required_plan|current_plan|\|\||\bHelios\b/i);
    expect(hasForbiddenWorkerChatClaim(rendered)).toBe(false);
  });

  it("al sanitizar historial no borra un siguiente paso IMSS+ISR", () => {
    const dualAnswer = formatWorkerChatAnswer({
      answer: "En tu recibo se ve IMSS $120.50 e ISR $310.00.",
      known: "Periodo 2026-05-01 al 2026-05-15. IMSS $120.50. ISR $310.00.",
      missing: "No hay constancia oficial de alta ni entero al SAT.",
      nextStep:
        "Cruza el descuento IMSS $120.50 y el NSS 12345678901 con tu siguiente recibo o un papel IMSS; eso no confirma el alta oficial. Cruza también la retención ISR $310.00 con el CFDI o el depósito del mismo periodo.",
    });
    const rendered = sanitizeVisibleChatHistoryContent(dualAnswer);

    expect(parseWorkerStructuredAnswer(rendered).map((item) => item.heading)).toEqual([
      "Respuesta clara",
      "Lo que sí se sabe",
      "Lo que falta",
      "Siguiente paso",
      null,
    ]);
    expect(rendered).toMatch(/no confirma el alta oficial/i);
    expect(rendered).toMatch(/ISR \$310\.00/);
    expect(rendered).toMatch(/CFDI|dep[oó]sito/i);
    expect(rendered).not.toMatch(/required_plan|current_plan|\|\||\bHelios\b/i);
    expect(hasForbiddenWorkerChatClaim(rendered)).toBe(false);
  });

  it("al renderizar historial sucio conserva las 4 secciones de una respuesta nueva", () => {
    const cleanAnswer = formatWorkerChatAnswer({
      answer: "En tu recibo se ve un descuento de IMSS de $120.50.",
      known: "El recibo muestra periodo, neto y un descuento de IMSS.",
      missing: "No hay constancia oficial de pago al IMSS.",
      nextStep: "Compara con el siguiente recibo.",
    });
    const dirtyHistory = sanitizeVisibleChatHistoryMessages([
      {
        role: "assistant",
        content:
          "Asesor laboral con lectura de varios documentos del expediente está disponible desde Audita Esencial.||required_plan=essential||current_plan=free",
      },
      { role: "user", content: "¿Me descontaron IMSS?" },
      { role: "assistant", content: cleanAnswer },
    ]);

    expect(dirtyHistory[0]?.content).not.toMatch(/required_plan|current_plan|\|\|/);
    expect(dirtyHistory[0]?.content).toContain("Respuesta clara");
    expect(dirtyHistory[1]?.content).toBe("¿Me descontaron IMSS?");
    expect(parseWorkerStructuredAnswer(dirtyHistory[2]?.content ?? "").map((item) => item.heading)).toEqual([
      "Respuesta clara",
      "Lo que sí se sabe",
      "Lo que falta",
      "Siguiente paso",
      null,
    ]);
    expect(dirtyHistory.map((item) => item.content).join("\n")).not.toMatch(
      /required_plan|current_plan|\|\||\bHelios\b/i,
    );
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

    const withInfonavit = buildWorkerStarterQuestions({
      documentType: "payroll_receipt",
      documentsCount: 1,
      hasImssSignal: true,
      hasFiscalSignal: true,
      hasInfonavitSignal: true,
    });
    expect(withInfonavit).toContain("¿Me descontaron IMSS, impuestos o Infonavit?");
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
    expect(WORKER_CHAT_SHEET_COPY.eyebrow).toBe("Lectura de tus papeles");
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

  it("en una pregunta de recibo/IMSS no pinta Lecturas oficiales aunque vengan en el digest", () => {
    const withOfficial = formatWorkerChatAnswer({
      answer: "En tu recibo se ve un descuento de IMSS.",
      known: "Hay un descuento de IMSS de $120.50.",
      missing: "No hay constancia oficial de alta.",
      nextStep: "Compara con el siguiente recibo.",
      officialSources: listLastGoodOfficialCitations(),
      officialSourcesNote:
        "Estas lecturas oficiales las tengo de una consulta anterior. Ahora no pude abrir la Corte o el Diario Oficial.",
      prompt: "¿Me descontaron IMSS?",
      includeOfficialSources: false,
    });

    expect(withOfficial).toContain("Respuesta clara");
    expect(withOfficial).toContain("Siguiente paso");
    expect(withOfficial).not.toMatch(/Lecturas oficiales|Subcontrataci[oó]n|Diario Oficial|consulta anterior/i);
    expect(parseWorkerStructuredAnswer(withOfficial).map((item) => item.heading)).toEqual([
      "Respuesta clara",
      "Lo que sí se sabe",
      "Lo que falta",
      "Siguiente paso",
      null,
    ]);
  });

  it("no muestra too_big ni jerga Zod al fallar el chat", () => {
    const zodBlob = JSON.stringify([
      {
        code: "too_big",
        maximum: 2000,
        type: "string",
        inclusive: true,
        exact: false,
        message: "String must contain at most 2000 character(s)",
        path: ["conversationHistory", 1, "content"],
      },
    ]);

    expect(toFriendlyWorkerChatError(zodBlob)).toBe(WORKER_CHAT_RETRY_ERROR);
    expect(toFriendlyWorkerChatError(zodBlob)).not.toMatch(/too_big|Zod|conversationHistory|maximum/i);
    expect(toFriendlyWorkerChatError("TRPCClientError: too_big on conversationHistory")).toBe(
      WORKER_CHAT_RETRY_ERROR,
    );
    expect(
      toFriendlyWorkerChatError("Too big: expected string to have <=2000 characters"),
    ).toBe(WORKER_CHAT_RETRY_ERROR);
  });

  it("recorta historial largo y rubros oficiales antes de validar", () => {
    const longOfficialAnswer = formatWorkerChatAnswer({
      answer: "Sobre horas extra solo puedo citar lecturas oficiales del digest.",
      known: "El recibo no trae horas extra.",
      missing: "Falta un papel que muestre las horas.",
      nextStep: "Compara con tu siguiente recibo.",
      officialSources: listLastGoodOfficialCitations(),
      officialSourcesNote:
        "Estas lecturas oficiales las tengo de una consulta anterior. Ahora no pude abrir la Corte o el Diario Oficial.",
    });
    const bloatedHistoryAnswer = [
      longOfficialAnswer,
      ...listLastGoodOfficialCitations().map((item) => item.title),
      DOF_LAST_GOOD_SEED[0]!.title,
    ].join("\n\n");

    expect(bloatedHistoryAnswer.length).toBeGreaterThan(2000);

    const padded = Array.from({ length: 10 }, (_, index) => ({
      role: index % 2 === 0 ? ("user" as const) : ("assistant" as const),
      content: index % 2 === 0 ? `Pregunta previa ${index}` : bloatedHistoryAnswer,
    }));

    const capped = capWorkerChatConversationHistory(padded);
    expect(capped).toHaveLength(WORKER_CHAT_HISTORY_MAX_MESSAGES);
    expect(capped.every((item) => item.content.length <= WORKER_CHAT_HISTORY_MAX_CONTENT_CHARS)).toBe(
      true,
    );
    expect(capped.every((item) => item.content.length <= 2000)).toBe(true);
    expect(capWorkerChatHistoryContent(bloatedHistoryAnswer).length).toBeLessThanOrEqual(
      WORKER_CHAT_HISTORY_MAX_CONTENT_CHARS,
    );
    expect(capped.at(-1)?.content).not.toContain(DOF_LAST_GOOD_SEED[0]!.title);
  });
});
