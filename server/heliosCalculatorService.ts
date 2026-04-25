import type { HeliosOpinion } from "./heliosIntegrationService";

export type HeliosCalculatorDocumentInput = {
  documentId: string;
  originalName?: string | null;
  documentType: string;
  createdAt: Date | string;
  heliosOpinion?: unknown;
};

export type HeliosCalculatorPeriodComparison = {
  periodKey: string;
  periodLabel: string;
  payrollDocumentId?: string | null;
  payrollAmount?: number | null;
  cfdiDocumentId?: string | null;
  cfdiAmount?: number | null;
  differenceAmount?: number | null;
  direction: "payroll_above" | "cfdi_above" | "equal" | "incomplete";
  summary: string;
  recommendedNextStep: string;
  legalContext: string;
  generatedAt: string;
};

export type HeliosCalculatorSnapshot = {
  status: "ready" | "partial" | "empty";
  latestComparison: HeliosCalculatorPeriodComparison | null;
  history: HeliosCalculatorPeriodComparison[];
  legalExplanation: {
    headline: string;
    summary: string;
    actionItems: string[];
    disclaimer: string;
  } | null;
};

type ParsedOpinion = HeliosOpinion & {
  rawPayload?: Record<string, unknown>;
};

type ParsedDocumentSignal = {
  source: HeliosCalculatorDocumentInput;
  opinion: ParsedOpinion | null;
  periodKey: string | null;
  periodLabel: string | null;
  amount: number | null;
  recommendedNextStep: string | null;
  legalOpinion: string | null;
  primaryConcern: string | null;
  generatedAt: string;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asText(value: unknown) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text.length > 0 ? text : null;
}

function asNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const normalized = value.replace(/[^\d.,-]/g, "").replace(/,(?=\d{1,2}$)/, ".").replace(/,/g, "");
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function safeDate(value: Date | string | undefined | null) {
  const candidate = value instanceof Date ? value : value ? new Date(value) : null;
  if (!candidate || Number.isNaN(candidate.getTime())) {
    return new Date(0);
  }
  return candidate;
}

function getPreliminaryAnalysis(opinion: ParsedOpinion | null) {
  const rawPayload = asRecord(opinion?.rawPayload);
  return asRecord(rawPayload?.preliminaryAnalysis);
}

function getNestedText(record: Record<string, unknown> | null, key: string) {
  return asText(record?.[key]);
}

function pickVisiblePeriod(opinion: ParsedOpinion | null) {
  const preliminary = getPreliminaryAnalysis(opinion);
  const confirmed = asRecord(preliminary?.confirmedData);
  const estimated = asRecord(preliminary?.estimatedData);
  return getNestedText(confirmed, "period") ?? getNestedText(estimated, "period");
}

function pickVisibleAmount(opinion: ParsedOpinion | null) {
  const preliminary = getPreliminaryAnalysis(opinion);
  const confirmed = asRecord(preliminary?.confirmedData);
  const estimated = asRecord(preliminary?.estimatedData);
  return asNumber(confirmed?.apparentAmount) ?? asNumber(estimated?.apparentAmount);
}

function normalizePeriodKey(value: string | null) {
  if (!value) return null;
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || null;
}

function buildFallbackPeriodLabel(date: Date) {
  return new Intl.DateTimeFormat("es-MX", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function formatAmount(value: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 2,
  }).format(value);
}

function parseSignal(document: HeliosCalculatorDocumentInput): ParsedDocumentSignal {
  const opinion = asRecord(document.heliosOpinion) as ParsedOpinion | null;
  const createdAt = safeDate(document.createdAt);
  const rawPeriod = pickVisiblePeriod(opinion);
  const periodKey = normalizePeriodKey(rawPeriod) ?? `sin-periodo-${createdAt.toISOString().slice(0, 10)}`;
  const periodLabel = rawPeriod ?? buildFallbackPeriodLabel(createdAt);
  return {
    source: document,
    opinion,
    periodKey,
    periodLabel,
    amount: pickVisibleAmount(opinion),
    recommendedNextStep: asText(opinion?.recommendedNextStep),
    legalOpinion: asText(opinion?.legalOpinion),
    primaryConcern: asText(asRecord(opinion?.legalHighlights)?.primaryConcern),
    generatedAt: asText(opinion?.generatedAt) ?? createdAt.toISOString(),
  };
}

function pickNewestSignal(signals: ParsedDocumentSignal[]) {
  return [...signals].sort((left, right) => {
    const rightTime = safeDate(right.generatedAt || right.source.createdAt).getTime();
    const leftTime = safeDate(left.generatedAt || left.source.createdAt).getTime();
    return rightTime - leftTime;
  })[0] ?? null;
}

function buildComparison(params: {
  periodKey: string;
  periodLabel: string;
  payroll: ParsedDocumentSignal | null;
  cfdi: ParsedDocumentSignal | null;
}): HeliosCalculatorPeriodComparison {
  const payrollAmount = params.payroll?.amount ?? null;
  const cfdiAmount = params.cfdi?.amount ?? null;
  const differenceAmount =
    payrollAmount !== null && cfdiAmount !== null ? Number((payrollAmount - cfdiAmount).toFixed(2)) : null;
  const absoluteDifference = differenceAmount !== null ? Math.abs(differenceAmount) : null;
  const direction: HeliosCalculatorPeriodComparison["direction"] =
    differenceAmount === null
      ? "incomplete"
      : differenceAmount === 0
        ? "equal"
        : differenceAmount > 0
          ? "payroll_above"
          : "cfdi_above";

  const summary =
    direction === "incomplete"
      ? `Ya existe una base útil para ${params.periodLabel}, pero todavía falta una de las dos piezas para cerrar el cruce entre nómina y CFDI.`
      : direction === "equal"
        ? `Para ${params.periodLabel}, el monto visible de nómina y CFDI coincide en ${formatAmount(payrollAmount ?? 0)}.`
        : direction === "payroll_above"
          ? `Para ${params.periodLabel}, la nómina aparece ${formatAmount(absoluteDifference ?? 0)} por encima del CFDI visible.`
          : `Para ${params.periodLabel}, el CFDI aparece ${formatAmount(absoluteDifference ?? 0)} por encima de la nómina visible.`;

  const recommendedNextStep =
    params.payroll?.recommendedNextStep ??
    params.cfdi?.recommendedNextStep ??
    (direction === "incomplete"
      ? "Conviene subir o contrastar el documento faltante del mismo periodo para cerrar mejor la lectura." 
      : "Después del monto, conviene revisar periodo exacto, conceptos y cualquier deducción relevante del mismo mes.");

  const legalContext =
    params.payroll?.legalOpinion ??
    params.cfdi?.legalOpinion ??
    "La diferencia visible sirve para orientar la revisión del expediente, pero debe contrastarse con el periodo y los conceptos del mismo mes antes de tomar decisiones.";

  return {
    periodKey: params.periodKey,
    periodLabel: params.periodLabel,
    payrollDocumentId: params.payroll?.source.documentId ?? null,
    payrollAmount,
    cfdiDocumentId: params.cfdi?.source.documentId ?? null,
    cfdiAmount,
    differenceAmount,
    direction,
    summary,
    recommendedNextStep,
    legalContext,
    generatedAt: params.payroll?.generatedAt ?? params.cfdi?.generatedAt ?? new Date().toISOString(),
  };
}

export function buildHeliosCalculatorSnapshot(
  documents: HeliosCalculatorDocumentInput[]
): HeliosCalculatorSnapshot {
  const relevantSignals = documents
    .filter(document => document.documentType === "payroll_receipt" || document.documentType === "cfdi")
    .map(parseSignal);

  if (relevantSignals.length === 0) {
    return {
      status: "empty",
      latestComparison: null,
      history: [],
      legalExplanation: null,
    };
  }

  const grouped = new Map<string, { periodLabel: string; payroll: ParsedDocumentSignal[]; cfdi: ParsedDocumentSignal[] }>();

  for (const signal of relevantSignals) {
    const current = grouped.get(signal.periodKey ?? "sin-periodo") ?? {
      periodLabel: signal.periodLabel ?? "Periodo sin etiqueta",
      payroll: [],
      cfdi: [],
    };

    if (signal.source.documentType === "payroll_receipt") {
      current.payroll.push(signal);
    } else if (signal.source.documentType === "cfdi") {
      current.cfdi.push(signal);
    }

    grouped.set(signal.periodKey ?? "sin-periodo", current);
  }

  const history = Array.from(grouped.entries())
    .map(([periodKey, value]) =>
      buildComparison({
        periodKey,
        periodLabel: value.periodLabel,
        payroll: pickNewestSignal(value.payroll),
        cfdi: pickNewestSignal(value.cfdi),
      })
    )
    .sort(
      (left, right) =>
        safeDate(right.generatedAt).getTime() - safeDate(left.generatedAt).getTime()
    );

  const latestComparison = history[0] ?? null;
  const signalsByFreshness = [...relevantSignals].sort(
    (left, right) =>
      safeDate(right.generatedAt).getTime() - safeDate(left.generatedAt).getTime()
  );
  const actionItems = Array.from(
    new Set(
      signalsByFreshness
        .flatMap(signal => {
          const opinion = signal.opinion;
          const actions = Array.isArray(opinion?.recommendedActions)
            ? opinion?.recommendedActions.map(item => asText(item)).filter(Boolean)
            : [];
          return actions;
        })
        .filter((item): item is string => Boolean(item))
    )
  ).slice(0, 3);

  const primarySignal = signalsByFreshness[0] ?? null;
  const legalExplanation = latestComparison
    ? {
        headline:
          latestComparison.direction === "incomplete"
            ? `Todavía falta una pieza para cerrar ${latestComparison.periodLabel}`
            : `Qué significa jurídicamente el cruce de ${latestComparison.periodLabel}`,
        summary:
          primarySignal?.legalOpinion ??
          latestComparison.legalContext ??
          "La lectura sigue siendo preliminar y conviene contrastarla con más documentos del expediente.",
        actionItems:
          actionItems.length > 0
            ? actionItems
            : [latestComparison.recommendedNextStep],
        disclaimer:
          asText(primarySignal?.opinion?.disclaimer) ??
          "La calculadora orienta la revisión del expediente. No sustituye asesoría profesional personalizada.",
      }
    : null;

  return {
    status: history.some(item => item.direction !== "incomplete") ? "ready" : "partial",
    latestComparison,
    history,
    legalExplanation,
  };
}
