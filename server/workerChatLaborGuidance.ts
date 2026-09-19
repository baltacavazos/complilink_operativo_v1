import { sanitizeWorkerChatCopy } from "@shared/workerChatUx";
import { readStoredLaborFiscalNarrative } from "./laborFiscalNarrative";
import {
  describeWorkerReviewSource,
  isPreferredRemoteWorkerOpinion,
  type LaborFiscalStructuredFacts,
} from "./laborFiscalSignals";

export type WorkerChatPromptFocus =
  | "imss"
  | "fiscal"
  | "imss_fiscal"
  | "infonavit"
  | "imss_infonavit"
  | "fiscal_infonavit"
  | "imss_fiscal_infonavit"
  | "alta"
  | "general";

const IMSS_TOPIC_RE = /\bimss\b|cuota obrera|seguro social|\bnss\b|\balta\b|semanas cotiz/;
const FISCAL_TOPIC_RE =
  /\bisr\b|impuestos?\b|\bsat\b|retenci[oó]n(?:es)?(?!\s+(?:de\s+)?(?:imss|infonavit))/;
const INFONAVIT_TOPIC_RE = /infonavit|infon[aá]vit|cr[eé]dito de vivienda/;

export type WorkerChatGuidanceFoundation = {
  title: string;
  reference: string;
  relevance: string;
};

export type WorkerChatLaborGuidanceInput = {
  documentsCount: number;
  documentType: string | null;
  summary: string | null;
  recommendedNextStep: string | null;
  uncertainties: string[];
  keyFacts: string[];
  legalFoundations: WorkerChatGuidanceFoundation[];
  laborFacts: LaborFiscalStructuredFacts;
  laborExplanations: Array<{ label: string; summary: string }>;
  hasImssSignal: boolean;
  hasFiscalSignal: boolean;
  hasInfonavitSignal: boolean;
  missingDocumentLabel: string | null;
  missingDocumentReason: string | null;
  sourceOpinion?: unknown;
};

export type WorkerChatLaborGuidance = {
  prefersRemoteOpinion: boolean;
  reviewSource: "local" | "remote";
  reviewSourceLabel: string;
  nextStepSource: "remote" | "stored" | "opinion" | "signals";
  promptFocus: WorkerChatPromptFocus;
  visibleFactLines: string[];
  clearAnswer: string;
  known: string;
  missing: string;
  nextStep: string;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asText(value?: string | null) {
  if (typeof value !== "string") return null;
  const next = value.replace(/\s+/g, " ").trim();
  return next.length > 0 ? next : null;
}

function cleanCopy(value?: string | null) {
  return asText(sanitizeWorkerChatCopy(value) ?? value);
}

export function inferWorkerChatPromptFocus(prompt?: string | null): WorkerChatPromptFocus {
  const text = (prompt ?? "").toLowerCase();
  if (!text) return "general";
  const mentionsImss = IMSS_TOPIC_RE.test(text);
  const mentionsFiscal = FISCAL_TOPIC_RE.test(text);
  const mentionsInfonavit = INFONAVIT_TOPIC_RE.test(text);
  if (mentionsImss && mentionsFiscal && mentionsInfonavit) return "imss_fiscal_infonavit";
  if (mentionsImss && mentionsFiscal) return "imss_fiscal";
  if (mentionsImss && mentionsInfonavit) return "imss_infonavit";
  if (mentionsFiscal && mentionsInfonavit) return "fiscal_infonavit";
  if (mentionsInfonavit) return "infonavit";
  if (/\balta\b|semanas cotiz/.test(text)) return "alta";
  if (mentionsImss) return "imss";
  if (mentionsFiscal || /\brfc\b|cfdi/.test(text)) return "fiscal";
  return "general";
}

export function listVisibleLaborFactLines(facts: LaborFiscalStructuredFacts): string[] {
  return [
    facts.period ? `periodo ${facts.period}` : null,
    facts.netAmount ? `neto ${facts.netAmount}` : null,
    facts.isrWithheld ? `ISR ${facts.isrWithheld}` : null,
    facts.imssWithheld ? `IMSS ${facts.imssWithheld}` : null,
    facts.infonavitWithheld ? `Infonavit ${facts.infonavitWithheld}` : null,
    facts.nss ? `NSS ${facts.nss}` : null,
    facts.employerRfc ? `RFC del patrón ${facts.employerRfc}` : null,
    facts.workerRfc ? `RFC de la persona trabajadora ${facts.workerRfc}` : null,
  ].filter((item): item is string => Boolean(item));
}

function joinFactLines(lines: string[]) {
  if (lines.length === 0) return "";
  if (lines.length === 1) return lines[0];
  if (lines.length === 2) return `${lines[0]} y ${lines[1]}`;
  return `${lines.slice(0, -1).join(", ")} y ${lines[lines.length - 1]}`;
}

function periodPhrase(period?: string | null) {
  return period ? ` del periodo ${period}` : "";
}

function firstExplanationLine(explanations: WorkerChatLaborGuidanceInput["laborExplanations"]) {
  return explanations.find((item) => !/l[ií]mite de esta lectura/i.test(item.label))?.summary ?? null;
}

function composeImssCrossStep(input: WorkerChatLaborGuidanceInput, altaEmphasis = false): string {
  const facts = input.laborFacts;
  const period = periodPhrase(facts.period);

  if (altaEmphasis) {
    return facts.nss
      ? `El NSS ${facts.nss} se ve en el papel${period}, pero eso no confirma el alta oficial. Si puedes, sube otro recibo o un papel IMSS que tú tengas para comparar.`
      : "En tus papeles puede verse una señal de IMSS, pero eso no confirma el alta oficial. Sube un papel IMSS o el siguiente recibo si lo tienes.";
  }

  if (facts.imssWithheld) {
    return `Cruza el descuento IMSS ${facts.imssWithheld}${period} con tu siguiente recibo o con un papel IMSS que tú subas. Verlo en el recibo no confirma alta ni semanas cotizadas.`;
  }
  if (facts.nss) {
    return `El NSS ${facts.nss} se ve en el papel${period}. Compáralo con tu siguiente recibo o con un papel IMSS que tú subas; eso no confirma el alta oficial.`;
  }
  return "Hay una señal de IMSS en tus papeles, pero no confirma alta. Sube otro recibo o un papel IMSS si lo tienes.";
}

function composeFiscalCrossStep(input: WorkerChatLaborGuidanceInput): string {
  const facts = input.laborFacts;
  const period = periodPhrase(facts.period);
  const documentType = input.documentType;

  if (facts.isrWithheld && documentType === "cfdi") {
    return `Compara la retención ISR ${facts.isrWithheld}${period} con tu recibo o depósito del mismo periodo. Verla timbrada no prueba que el patrón la haya enterado al SAT.`;
  }
  if (facts.isrWithheld) {
    return `Cruza la retención ISR ${facts.isrWithheld}${period} con el CFDI o con lo que realmente te depositaron. Verla en el recibo no prueba el entero al SAT.`;
  }
  return documentType === "cfdi"
    ? "Compara lo timbrado con tu recibo o depósito del mismo periodo antes de dar por bueno el pago."
    : "Si puedes, sube el CFDI del mismo periodo para cruzar impuestos y lo que realmente te depositaron.";
}

function composeImssOfficialLimitPart(input: WorkerChatLaborGuidanceInput): string {
  const facts = input.laborFacts;
  const period = periodPhrase(facts.period);
  if (facts.imssWithheld && facts.nss) {
    return `Cruza el descuento IMSS ${facts.imssWithheld} y el NSS ${facts.nss}${period} con tu siguiente recibo o con un papel IMSS que tú subas; eso no confirma el alta oficial.`;
  }
  return composeImssCrossStep(input).replace(
    /no confirma alta ni semanas cotizadas\.?$/i,
    "no confirma el alta oficial.",
  );
}

function composeFiscalAlsoPart(input: WorkerChatLaborGuidanceInput): string {
  const facts = input.laborFacts;
  if (facts.isrWithheld) {
    return `Cruza también la retención ISR ${facts.isrWithheld} con el CFDI o con lo que te depositaron del mismo periodo.`;
  }
  return input.documentType === "cfdi"
    ? "Cruza también lo timbrado de ISR o impuestos con tu recibo o depósito del mismo periodo."
    : "Cruza también las retenciones o impuestos con el CFDI o el depósito del mismo periodo.";
}

function composeInfonavitCrossStep(
  input: WorkerChatLaborGuidanceInput,
  options?: { also?: boolean },
): string {
  const facts = input.laborFacts;
  const period = options?.also ? "" : periodPhrase(facts.period);
  const also = Boolean(options?.also);

  if (facts.infonavitWithheld) {
    return also
      ? `Cruza también el descuento Infonavit ${facts.infonavitWithheld} con tu aviso de retención o estado de crédito, si lo tienes. Verlo en el recibo no prueba el entero.`
      : `Cruza el descuento Infonavit ${facts.infonavitWithheld}${period} con tu aviso de retención o estado de crédito, si lo tienes. Verlo en el recibo no prueba que el patrón lo haya enterado.`;
  }

  return also
    ? "Cruza también Infonavit con tu aviso de retención o estado de crédito. Verlo en el recibo no prueba el entero."
    : "Si se ve Infonavit en el papel, cruza ese descuento con tu aviso de retención o estado de crédito. Verlo en el recibo no prueba el entero.";
}

function composeImssFiscalNextStep(input: WorkerChatLaborGuidanceInput): string {
  return `${composeImssOfficialLimitPart(input)} ${composeFiscalAlsoPart(input)}`;
}

function composeImssInfonavitNextStep(input: WorkerChatLaborGuidanceInput): string {
  return `${composeImssOfficialLimitPart(input)} ${composeInfonavitCrossStep(input, { also: true })}`;
}

function composeFiscalInfonavitNextStep(input: WorkerChatLaborGuidanceInput): string {
  return `${composeFiscalCrossStep(input)} ${composeInfonavitCrossStep(input, { also: true })}`;
}

function composeImssFiscalInfonavitNextStep(input: WorkerChatLaborGuidanceInput): string {
  return `${composeImssFiscalNextStep(input)} ${composeInfonavitCrossStep(input, { also: true })}`;
}

function composeSignalNextStep(
  input: WorkerChatLaborGuidanceInput,
  focus: WorkerChatPromptFocus,
): string {
  const facts = input.laborFacts;
  const period = periodPhrase(facts.period);
  const documentType = input.documentType;

  if (focus === "alta") {
    return composeImssCrossStep(input, true);
  }

  if (focus === "imss") {
    return composeImssCrossStep(input);
  }

  if (focus === "imss_fiscal") {
    return composeImssFiscalNextStep(input);
  }

  if (focus === "imss_fiscal_infonavit") {
    return composeImssFiscalInfonavitNextStep(input);
  }

  if (focus === "imss_infonavit") {
    return composeImssInfonavitNextStep(input);
  }

  if (focus === "fiscal_infonavit") {
    return composeFiscalInfonavitNextStep(input);
  }

  if (focus === "infonavit") {
    return composeInfonavitCrossStep(input);
  }

  if (focus === "fiscal") {
    return composeFiscalCrossStep(input);
  }

  if (documentType === "cfdi" && facts.period && facts.netAmount) {
    return `Compara este CFDI del periodo ${facts.period} (neto ${facts.netAmount}) con tu recibo o depósito del mismo periodo.`;
  }

  if (documentType === "payroll_receipt") {
    const retentions = [
      facts.isrWithheld ? `ISR ${facts.isrWithheld}` : null,
      facts.imssWithheld ? `IMSS ${facts.imssWithheld}` : null,
      facts.infonavitWithheld ? `Infonavit ${facts.infonavitWithheld}` : null,
    ].filter((item): item is string => Boolean(item));
    if (facts.period && facts.netAmount) {
      const extra = retentions.length > 0 ? ` y las retenciones ${retentions.join(", ")}` : "";
      return `Si puedes, sube el CFDI del periodo ${facts.period} para contrastar el neto ${facts.netAmount}${extra}. Ver descuentos en el recibo no prueba entero ni alta oficial.`;
    }
    if (retentions.length > 0) {
      return `Cruza las retenciones visibles (${retentions.join(", ")})${period} con el CFDI o el siguiente recibo. Verlas en el papel no prueba entero ni alta oficial.`;
    }
  }

  if (input.missingDocumentLabel) {
    return `Si lo tienes, sube ${input.missingDocumentLabel.toLowerCase()}. ${input.missingDocumentReason ?? ""}`.trim();
  }

  return "Revisa lo que ya se ve y, si puedes, sube otro documento del mismo periodo.";
}

function pickAnchoredNextStep(
  input: WorkerChatLaborGuidanceInput,
  focus: WorkerChatPromptFocus,
  prefersRemote: boolean,
): { nextStep: string; source: WorkerChatLaborGuidance["nextStepSource"] } {
  const opinion = asRecord(input.sourceOpinion);
  const resultCard = asRecord(opinion?.resultCard);
  const stored = readStoredLaborFiscalNarrative(input.sourceOpinion);

  const remoteStep = prefersRemote
    ? cleanCopy(asText(typeof opinion?.recommendedNextStep === "string" ? opinion.recommendedNextStep : null)) ??
      cleanCopy(asText(typeof resultCard?.nextStepSummary === "string" ? resultCard.nextStepSummary : null))
    : null;
  if (remoteStep) {
    return { nextStep: remoteStep, source: "remote" };
  }

  if (stored?.nextStep) {
    return { nextStep: stored.nextStep, source: "stored" };
  }

  if (input.recommendedNextStep) {
    return { nextStep: input.recommendedNextStep, source: "opinion" };
  }

  return { nextStep: composeSignalNextStep(input, focus), source: "signals" };
}

function ensureHonestLimit(nextStep: string, input: WorkerChatLaborGuidanceInput) {
  if (/no confirma|no prueba|no consulta/i.test(nextStep)) return nextStep;
  if (input.hasImssSignal) {
    return `${nextStep} Ver IMSS en el papel no confirma alta ni semanas cotizadas.`;
  }
  if (input.hasFiscalSignal || input.hasInfonavitSignal) {
    return `${nextStep} Ver una retención en el recibo no prueba que el patrón la haya enterado.`;
  }
  return nextStep;
}

function ensureFoundationWhy(nextStep: string, foundation: WorkerChatGuidanceFoundation | null) {
  if (!foundation) return nextStep;
  const title = foundation.title.toLowerCase();
  if (nextStep.toLowerCase().includes(title)) return nextStep;
  if (nextStep.length > 220) return nextStep;
  return `${nextStep} Esta lectura usa ${title} para comparar lo que sí se ve en tus papeles.`;
}

function composeClearAnswer(
  input: WorkerChatLaborGuidanceInput,
  prefersRemote: boolean,
  visibleFactLines: string[],
) {
  const opinion = asRecord(input.sourceOpinion);
  const remoteText = prefersRemote
    ? cleanCopy(asText(typeof opinion?.legalOpinion === "string" ? opinion.legalOpinion : null)) ??
      cleanCopy(asText(typeof opinion?.summary === "string" ? opinion.summary : null))
    : null;
  const foundation = input.legalFoundations[0] ?? null;
  const foundationLine = foundation
    ? ` Esta lectura ya usa ${foundation.title.toLowerCase()}: ${foundation.relevance}`
    : "";
  const imssLine = input.hasImssSignal
    ? " Si se ve IMSS en el papel, eso no confirma alta, vigencia ni semanas cotizadas."
    : "";

  if (remoteText) {
    return `${remoteText}${imssLine}`.replace(/\s+/g, " ").trim();
  }

  if (visibleFactLines.length > 0) {
    return `En tus papeles se alcanza a leer ${joinFactLines(visibleFactLines)}.${foundationLine}${imssLine}`
      .replace(/\s+/g, " ")
      .trim();
  }

  const factLine = firstExplanationLine(input.laborExplanations);
  return (
    factLine ??
    input.summary ??
    "Ya hay una primera lectura de tus papeles, aunque todavía faltan piezas para cerrar la respuesta."
  ) + foundationLine + imssLine;
}

function composeKnown(input: WorkerChatLaborGuidanceInput, visibleFactLines: string[]) {
  const fromFacts = visibleFactLines.map((line) => line.charAt(0).toUpperCase() + line.slice(1));
  const fromOpinion = input.keyFacts.slice(0, 3);
  const combined = Array.from(new Set([...fromFacts, ...fromOpinion]));
  if (combined.length > 0) {
    return `${combined.join(". ")}.`;
  }
  return (
    firstExplanationLine(input.laborExplanations) ??
    input.summary ??
    "Ya hay una primera lectura de tus papeles."
  );
}

function composeMissing(input: WorkerChatLaborGuidanceInput) {
  const parts: string[] = [];
  if (input.uncertainties[0]) parts.push(input.uncertainties[0]);
  if (input.missingDocumentLabel) {
    parts.push(`Todavía no está ${input.missingDocumentLabel.toLowerCase()}.`);
  }
  if (input.hasImssSignal && !parts.some((item) => /imss|alta|semanas/i.test(item))) {
    parts.push("No hay una constancia oficial de alta, vigencia o semanas cotizadas.");
  }
  if (
    (input.hasFiscalSignal || input.hasInfonavitSignal) &&
    !parts.some((item) => /enterado|entero|sat|infonavit/i.test(item))
  ) {
    parts.push(
      "Ver retenciones en el recibo no prueba que el patrón las haya enterado al SAT, IMSS o Infonavit.",
    );
  }
  if (parts.length > 0) return parts.slice(0, 2).join(" ");
  return "Todavía falta contrastar con más papeles del mismo periodo.";
}

export function buildLaborFiscalChatGuidance(
  input: WorkerChatLaborGuidanceInput,
  prompt?: string | null,
): WorkerChatLaborGuidance {
  const review = describeWorkerReviewSource(input.sourceOpinion);
  const prefersRemoteOpinion = isPreferredRemoteWorkerOpinion(input.sourceOpinion);
  const promptFocus = inferWorkerChatPromptFocus(prompt);
  const visibleFactLines = listVisibleLaborFactLines(input.laborFacts);
  const foundation = input.legalFoundations[0] ?? null;
  const anchored = pickAnchoredNextStep(input, promptFocus, prefersRemoteOpinion);
  const focusedLocalStep =
    promptFocus !== "general" && !prefersRemoteOpinion
      ? composeSignalNextStep(input, promptFocus)
      : null;
  const nextStep = ensureFoundationWhy(
    ensureHonestLimit(focusedLocalStep ?? anchored.nextStep, input),
    foundation,
  );

  return {
    prefersRemoteOpinion,
    reviewSource: review.reviewSource,
    reviewSourceLabel: review.reviewSourceLabel,
    nextStepSource: focusedLocalStep ? "signals" : anchored.source,
    promptFocus,
    visibleFactLines,
    clearAnswer: composeClearAnswer(input, prefersRemoteOpinion, visibleFactLines),
    known: composeKnown(input, visibleFactLines),
    missing: composeMissing(input),
    nextStep,
  };
}
