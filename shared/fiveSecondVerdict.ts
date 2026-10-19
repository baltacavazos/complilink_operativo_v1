/**
 * Veredicto de 5 segundos para la persona trabajadora.
 * Una línea de lo que se vio + un solo siguiente paso. Sin jerga.
 */

export type FiveSecondSeen = "bien" | "hay_diferencia" | "no_se_leyo" | "falta_dato";

export type FiveSecondVerdict = {
  seen: FiveSecondSeen;
  seenLine: string;
  nextStep: string;
  nextStepLine: string;
  disclaimer: string;
};

export const FIVE_SECOND_DISCLAIMER =
  "Esto no es un dictamen legal. Si consultamos IMSS o SAT, te decimos lo que respondieron ese día.";

const SEEN_LABEL: Record<FiveSecondSeen, string> = {
  bien: "bien",
  hay_diferencia: "hay diferencia",
  no_se_leyo: "no se leyó",
  falta_dato: "falta un dato",
};

export type FiveSecondVerdictInput = {
  hasEmployer?: boolean;
  hasPeriod?: boolean;
  hasPayment?: boolean;
  hasNss?: boolean;
  hasCurp?: boolean;
  hasWorkerRfc?: boolean;
  classificationConfidence?: number | null;
  riskLevel?: string | null;
  hasDifferenceSignal?: boolean;
};

function normalizeRisk(value?: string | null) {
  return String(value ?? "").trim().toLowerCase();
}

export function selectFiveSecondSeen(input: FiveSecondVerdictInput): FiveSecondSeen {
  const coreCount = [input.hasEmployer, input.hasPeriod, input.hasPayment].filter(Boolean).length;
  const confidence = typeof input.classificationConfidence === "number" ? input.classificationConfidence : null;
  const risk = normalizeRisk(input.riskLevel);
  const risky = risk === "medium" || risk === "high" || risk === "critical";
  const unread =
    coreCount === 0 ||
    (coreCount <= 1 && (confidence === null || confidence < 50));

  if (unread) return "no_se_leyo";
  if (!input.hasPayment || !input.hasPeriod) return "falta_dato";
  if (input.hasDifferenceSignal || risky) return "hay_diferencia";
  return "bien";
}

export function selectFiveSecondNextStep(input: FiveSecondVerdictInput, seen: FiveSecondSeen): string {
  const hasIdentity = Boolean(input.hasNss || input.hasCurp || input.hasWorkerRfc);

  if (seen === "no_se_leyo") {
    return "Sube una foto más clara del mismo recibo o el CFDI del mismo periodo.";
  }

  if (seen === "falta_dato") {
    if (!input.hasPayment) {
      return "No alcanzamos a leer cuánto te pagaron. Toma otra foto donde se vea el total, o sube el PDF.";
    }
    return "No alcanzamos a leer el periodo. Toma otra foto donde se vea la fecha, o sube el PDF.";
  }

  if (seen === "hay_diferencia") {
    return "Compara este recibo con el CFDI del mismo periodo y pide el desglose por escrito.";
  }

  if (hasIdentity) {
    return "Consulta IMSS y SAT con tu permiso para ver si tu alta aparece hoy.";
  }

  return "Sube el CFDI del mismo periodo para comparar lo timbrado con lo que te pagaron.";
}

export function formatFiveSecondSeenLine(seen: FiveSecondSeen) {
  if (seen === "bien") return "Tu recibo se leyó completo";
  return `Esto vimos: ${SEEN_LABEL[seen]}`;
}

export function formatFiveSecondNextStepLine(nextStep: string) {
  return `Qué hacer ahora: ${nextStep}`;
}

export function selectFiveSecondVerdict(input: FiveSecondVerdictInput = {}): FiveSecondVerdict {
  const seen = selectFiveSecondSeen(input);
  const nextStep = selectFiveSecondNextStep(input, seen);
  return {
    seen,
    seenLine: formatFiveSecondSeenLine(seen),
    nextStep,
    nextStepLine: formatFiveSecondNextStepLine(nextStep),
    disclaimer: FIVE_SECOND_DISCLAIMER,
  };
}

export function selectFiveSecondVerdictFromReceipt(params: {
  employer?: string | null;
  employerRfc?: string | null;
  period?: string | null;
  payment?: string | null;
  nss?: string | null;
  curp?: string | null;
  workerRfc?: string | null;
  classificationConfidence?: number | null;
  riskLevel?: string | null;
  hasDifferenceSignal?: boolean;
}): FiveSecondVerdict {
  const verdict = selectFiveSecondVerdict({
    hasEmployer: Boolean(params.employer || params.employerRfc),
    hasPeriod: Boolean(params.period),
    hasPayment: Boolean(params.payment),
    hasNss: Boolean(params.nss),
    hasCurp: Boolean(params.curp),
    hasWorkerRfc: Boolean(params.workerRfc),
    classificationConfidence: params.classificationConfidence,
    riskLevel: params.riskLevel,
    hasDifferenceSignal: params.hasDifferenceSignal,
  });
  if (verdict.seen !== "bien" || !params.payment) return verdict;
  const period = params.period?.trim().replace(/^del\s+/i, "");
  return {
    ...verdict,
    seenLine: `Ya leímos tu recibo: te pagaron ${params.payment}${period ? ` del ${period}` : ""}. Falta preguntarle al IMSS si te tiene registrado.`,
  };
}
