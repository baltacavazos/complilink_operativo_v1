/**
 * Veredicto de 5 segundos para la persona trabajadora.
 * Una línea de lo que se vio + un solo siguiente paso. Sin jerga.
 */

export type FiveSecondSeen = "bien" | "hay_diferencia" | "no_se_leyo";

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
  if (input.hasDifferenceSignal || risky) return "hay_diferencia";
  return "bien";
}

export function selectFiveSecondNextStep(input: FiveSecondVerdictInput, seen: FiveSecondSeen): string {
  const hasIdentity = Boolean(input.hasNss || input.hasCurp || input.hasWorkerRfc);

  if (seen === "no_se_leyo") {
    return "Sube una foto más clara del mismo recibo o el CFDI del mismo periodo.";
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
  return selectFiveSecondVerdict({
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
}
