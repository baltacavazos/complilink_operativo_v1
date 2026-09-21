/**
 * Expediente + consulta IMSS/SAT/Infonavit para el asesor.
 * Español plano. Nunca «cumple». Nunca marcas internas.
 * Consume el retorno CLK: chatAnchor + officialCheck + reciboVsOficial.
 */

import {
  ADVISOR_CHAT_NEVER_INVENT,
  OFFICIAL_CHECK_BUTTON,
  OFFICIAL_CHECK_STATUS_DETAIL,
  OFFICIAL_CHECK_STATUS_LABEL,
  buildOfficialCheckHeadline,
  buildReceiptOfficialComparisonCopy,
  formatOfficialCheckDate,
  hasLiveOfficialResult,
  honestyToOfficialStatus,
  inferOfficialMissingFieldKeys,
  isPermissionBlockedStatus,
  listOfficialMissingFieldKeys,
  looksLikeNoOfficialResponse,
  officialStatusToHonesty,
  type OfficialChatAnchor,
  type OfficialChatAnchorSource,
  type OfficialCheckSummary,
  type OfficialCheckStatus,
  type OfficialIdentityFlags,
  type ReciboVsOficial,
  type ReciboVsOficialResultado,
} from "./officialCheckCopy";

export const CASE_ADVISOR_RULE =
  "Responde solo con base en este expediente y estas consultas. Si no hay dato oficial, di que aún no hay resultado / faltan datos — no inventes. Nunca inventes cumple, alta vigente ni salario oficial.";

export const WORKER_CHAT_NO_CONSULTA_EMPTY =
  "Aún no hay resultado de TU consulta. Pulsa Consultar IMSS y SAT.";

export type OfficialBriefingFacts = {
  period?: string | null;
  netAmount?: string | null;
  perceptions?: string | null;
  deductions?: string | null;
  imssWithheld?: string | null;
  isrWithheld?: string | null;
  infonavitWithheld?: string | null;
  nss?: string | null;
  curp?: string | null;
  workerRfc?: string | null;
  employerRfc?: string | null;
};

export type OfficialIdentityLabel = "NSS" | "CURP" | "RFC";
export type ReceiptOfficialComparisonSeen = ReciboVsOficialResultado;

export type ReceiptOfficialComparison = {
  seen: ReceiptOfficialComparisonSeen;
  seenLine: string;
  nextStep: string;
  nextStepLine: string;
  hasOfficialConsulta: boolean;
};

export type OfficialCaseBriefing = {
  hasOfficialConsulta: boolean;
  hasLiveOfficialResult: boolean;
  officialCheck: OfficialCheckSummary | null;
  chatAnchor: OfficialChatAnchor | null;
  reciboVsOficial: ReciboVsOficial | null;
  statusLines: string[];
  hechoLines: string[];
  headline: string | null;
  missingIdentity: OfficialIdentityLabel[];
  missingIdentityDetail: string | null;
  receiptLines: string[];
  comparison: ReceiptOfficialComparison;
  facts: OfficialBriefingFacts;
};

const PAY_WELL_RE =
  /me pagan bien|pagan bien|estoy bien pagad|me pagan lo (?:justo|correcto)|me pagan mal|el salario (?:est[aá]|es) (?:bien|correcto|justo)|cobro bien|me pagan (?:poco|de m[aá]s)/i;

export function isPayWellQuestion(prompt?: string | null): boolean {
  return PAY_WELL_RE.test(String(prompt ?? ""));
}

export function identityFlagsFromFacts(facts: OfficialBriefingFacts): OfficialIdentityFlags {
  return {
    nss: Boolean(facts.nss),
    curp: Boolean(facts.curp),
    rfc: Boolean(facts.workerRfc),
  };
}

export function listMissingOfficialIdentityLabels(
  identity: OfficialIdentityFlags,
): OfficialIdentityLabel[] {
  const missing: OfficialIdentityLabel[] = [];
  if (!identity.nss) missing.push("NSS");
  if (!identity.curp) missing.push("CURP");
  if (!identity.rfc) missing.push("RFC");
  return missing;
}

export function officialIdentityGapDetail(identity: OfficialIdentityFlags): string {
  const missing = listMissingOfficialIdentityLabels(identity);
  if (missing.length === 0) return OFFICIAL_CHECK_STATUS_DETAIL.sin_datos;
  if (missing.length === 1) return `Falta tu ${missing[0]} en el recibo para consultar.`;
  if (missing.length === 2) return `Falta tu ${missing[0]} y ${missing[1]} en el recibo para consultar.`;
  return "Falta tu NSS, CURP y RFC en el recibo para consultar.";
}

export function applyMissingFieldsToIdentity(
  identity: OfficialIdentityFlags,
  missingFields?: unknown,
): OfficialIdentityFlags {
  const missing = listOfficialMissingFieldKeys(missingFields);
  if (missing.length === 0) return identity;
  return {
    nss: missing.includes("nss") ? false : identity.nss,
    curp: missing.includes("curp") ? false : identity.curp,
    rfc: missing.includes("rfc") ? false : identity.rfc,
  };
}

export function collectOfficialMissingFieldKeys(params: {
  officialCheck?: OfficialCheckSummary | null;
  chatAnchor?: OfficialChatAnchor | null;
}): string[] {
  const keys: string[] = [];
  const push = (values?: unknown) => {
    for (const key of listOfficialMissingFieldKeys(values)) {
      if (!keys.includes(key)) keys.push(key);
    }
  };
  for (const check of params.officialCheck?.checks ?? []) {
    push(check.missingFields);
    push(inferOfficialMissingFieldKeys(check.motivoFallo));
    push(inferOfficialMissingFieldKeys((check.hechos ?? []).join(" ")));
  }
  const anchor = params.chatAnchor ?? params.officialCheck?.chatAnchor;
  if (anchor) {
    for (const source of [anchor.imss, anchor.sat, anchor.infonavit]) {
      push(source.missingFields);
      push(inferOfficialMissingFieldKeys(source.motivoFallo));
      push(inferOfficialMissingFieldKeys(source.hechos.join(" ")));
    }
  }
  return keys;
}

export function formatOfficialStatusLine(params: {
  sourceLabel: string;
  status: OfficialCheckStatus;
  checkedAt?: string | null;
}): string {
  const date = formatOfficialCheckDate(params.checkedAt);
  const label = OFFICIAL_CHECK_STATUS_LABEL[params.status];
  return date ? `${params.sourceLabel}: ${label} · ${date}` : `${params.sourceLabel}: ${label}`;
}

function sourceLabel(fuente: OfficialChatAnchorSource["fuente"]): string {
  return fuente === "sat" ? "SAT" : fuente === "imss" ? "IMSS" : "Infonavit";
}

export function formatChatAnchorStatusLine(
  source: OfficialChatAnchorSource,
  fallbackDate?: string | null,
): string {
  const mapped = honestyToOfficialStatus(source.estado, source.missingFields);
  const status =
    mapped === "pendiente" && looksLikeNoOfficialResponse(source.motivoFallo ?? source.hechos.join(" "))
      ? "no_se_pudo"
      : (mapped ?? "pendiente");
  const date = formatOfficialCheckDate(source.fecha ?? fallbackDate);
  const fail =
    (status === "no_se_pudo" || status === "sin_datos") && source.motivoFallo
      ? ` · ${source.motivoFallo}`
      : "";
  const label = OFFICIAL_CHECK_STATUS_LABEL[status];
  return date
    ? `${sourceLabel(source.fuente)}: ${label} · ${date}${fail}`
    : `${sourceLabel(source.fuente)}: ${label}${fail}`;
}

export function formatOfficialCheckStatusLines(summary: OfficialCheckSummary | null | undefined): string[] {
  if (!summary || isPermissionBlockedStatus(summary.overallStatus)) return [];
  if (summary.chatAnchor) {
    return [summary.chatAnchor.imss, summary.chatAnchor.sat, summary.chatAnchor.infonavit].map(
      (source) => formatChatAnchorStatusLine(source, summary.checkedAt),
    );
  }
  if (summary.checks.length > 0) {
    return summary.checks.map((item) =>
      formatOfficialStatusLine({
        sourceLabel: item.sourceLabel,
        status: item.status,
        checkedAt: item.checkedAt ?? summary.checkedAt,
      }),
    );
  }
  return [
    formatOfficialStatusLine({
      sourceLabel: "IMSS y SAT",
      status: summary.overallStatus,
      checkedAt: summary.checkedAt,
    }),
  ];
}

export function listChatAnchorHechos(anchor: OfficialChatAnchor | null | undefined): string[] {
  if (!anchor) return [];
  return [anchor.imss, anchor.sat, anchor.infonavit].flatMap((source) => {
    const prefix = sourceLabel(source.fuente);
    return source.hechos.slice(0, 3).map((hecho) => `${prefix}: ${hecho}`);
  });
}

export function listReceiptFactLines(facts: OfficialBriefingFacts): string[] {
  return [
    facts.period ? `periodo ${facts.period}` : null,
    facts.netAmount ? `neto ${facts.netAmount}` : null,
    facts.imssWithheld ? `IMSS del recibo ${facts.imssWithheld}` : null,
    facts.isrWithheld ? `ISR del recibo ${facts.isrWithheld}` : null,
    facts.infonavitWithheld ? `Infonavit del recibo ${facts.infonavitWithheld}` : null,
    facts.nss ? `NSS ${facts.nss}` : null,
    facts.curp ? `CURP ${facts.curp}` : null,
    facts.workerRfc ? `RFC de la persona trabajadora ${facts.workerRfc}` : null,
  ].filter((item): item is string => Boolean(item));
}

function consultAttempted(check?: OfficialCheckSummary | null): boolean {
  if (!check || isPermissionBlockedStatus(check.overallStatus)) return false;
  if (check.chatAnchor) return true;
  if (check.reciboVsOficial) return true;
  return Boolean(
    check.checkedAt ||
      (check.overallStatus &&
        check.overallStatus !== "sin_permiso" &&
        check.overallStatus !== "no_configurado"),
  );
}

export function selectReceiptOfficialComparison(params: {
  officialCheck?: OfficialCheckSummary | null;
  facts: OfficialBriefingFacts;
  reciboVsOficial?: ReciboVsOficial | ReciboVsOficialResultado | null;
  hasDifferenceSignal?: boolean;
}): ReceiptOfficialComparison {
  const check = params.officialCheck ?? null;
  const ran = consultAttempted(check);
  const raw =
    params.reciboVsOficial ??
    check?.reciboVsOficial ??
    null;
  const resultado =
    typeof raw === "string"
      ? raw
      : raw && typeof raw === "object"
        ? raw.resultado
        : null;

  if (!ran) {
    const copy = buildReceiptOfficialComparisonCopy("no_se_pudo");
    return {
      seen: "no_se_pudo",
      seenLine: copy.seenLine,
      nextStep: copy.nextStep,
      nextStepLine: copy.nextStepLine,
      hasOfficialConsulta: false,
    };
  }

  let seen: ReciboVsOficialResultado = "no_se_pudo";
  if (resultado === "bien" || resultado === "hay_diferencia" || resultado === "no_se_pudo") {
    seen = resultado;
  } else if (params.hasDifferenceSignal) {
    seen = "hay_diferencia";
  }
  const copy = buildReceiptOfficialComparisonCopy(seen);
  return {
    seen,
    seenLine: copy.seenLine,
    nextStep: copy.nextStep,
    nextStepLine: copy.nextStepLine,
    hasOfficialConsulta: true,
  };
}

export function buildOfficialCaseBriefing(params: {
  officialCheck?: OfficialCheckSummary | null;
  facts?: OfficialBriefingFacts | null;
  chatAnchor?: OfficialChatAnchor | null;
  reciboVsOficial?: ReciboVsOficial | ReciboVsOficialResultado | null;
  hasDifferenceSignal?: boolean;
}): OfficialCaseBriefing {
  const facts = params.facts ?? {};
  const officialCheck = params.officialCheck ?? null;
  const chatAnchor = params.chatAnchor ?? officialCheck?.chatAnchor ?? null;
  const reciboVsOficial =
    (typeof params.reciboVsOficial === "string"
      ? { resultado: params.reciboVsOficial, motivo: "" }
      : params.reciboVsOficial) ??
    officialCheck?.reciboVsOficial ??
    null;
  const identity = applyMissingFieldsToIdentity(
    officialCheck?.identity ?? identityFlagsFromFacts(facts),
    collectOfficialMissingFieldKeys({ officialCheck, chatAnchor }),
  );
  const missingIdentity = listMissingOfficialIdentityLabels(identity);
  const comparison = selectReceiptOfficialComparison({
    officialCheck,
    facts,
    reciboVsOficial,
    hasDifferenceSignal: params.hasDifferenceSignal,
  });
  const mergedCheck = officialCheck
    ? { ...officialCheck, chatAnchor: chatAnchor ?? officialCheck.chatAnchor ?? null, reciboVsOficial }
    : officialCheck;
  const statusLines = formatOfficialCheckStatusLines(mergedCheck);

  return {
    hasOfficialConsulta: comparison.hasOfficialConsulta,
    hasLiveOfficialResult: hasLiveOfficialResult(mergedCheck),
    officialCheck,
    chatAnchor,
    reciboVsOficial,
    statusLines,
    hechoLines: listChatAnchorHechos(chatAnchor),
    headline: officialCheck && !isPermissionBlockedStatus(officialCheck.overallStatus)
      ? buildOfficialCheckHeadline(officialCheck)
      : null,
    missingIdentity,
    missingIdentityDetail: missingIdentity.length > 0 ? officialIdentityGapDetail(identity) : null,
    receiptLines: listReceiptFactLines(facts),
    comparison,
    facts,
  };
}

export function formatOfficialCaseBriefingForPrompt(briefing: OfficialCaseBriefing): string {
  const official = briefing.hasOfficialConsulta
    ? briefing.statusLines.length > 0
      ? briefing.statusLines.join("\n")
      : briefing.headline ?? "Hay una consulta, pero sin estados claros."
    : "Aún no hay resultado de TU consulta.";
  const hechos =
    briefing.hechoLines.length > 0
      ? briefing.hechoLines.map((item) => `- ${item}`).join("\n")
      : "- La consulta no trajo hechos citables. No inventes alta vigente ni salario oficial.";
  const receipt =
    briefing.receiptLines.length > 0
      ? briefing.receiptLines.map((item) => `- ${item}`).join("\n")
      : "- En el recibo no hay montos, NSS, CURP ni RFC claros.";
  const missing = briefing.missingIdentityDetail ?? "No faltan NSS, CURP ni RFC en el papel, o ya se usaron.";
  return [
    CASE_ADVISOR_RULE,
    `Nunca inventes: ${ADVISOR_CHAT_NEVER_INVENT.join(", ")}.`,
    "Estados oficiales del caso (únicos que puedes citar como consulta):",
    official,
    "Hechos de TU consulta (únicos que puedes citar; máximo 3 por fuente):",
    hechos,
    `Comparación recibo vs oficial: ${briefing.comparison.seenLine} ${briefing.comparison.nextStepLine}`,
    "Montos y datos del recibo (únicos números del papel):",
    receipt,
    `Identidad para consultar: ${missing}`,
    "Si preguntan «¿me pagan bien?», ancla la respuesta a esa comparación y a IMSS/SAT/Infonavit del caso. No inventes que el patrón cumple.",
  ].join("\n");
}

export function buildPayWellFallback(briefing: OfficialCaseBriefing): {
  clearAnswer: string;
  known: string;
  missing: string;
  nextStep: string;
} {
  const receipt =
    briefing.receiptLines.length > 0
      ? `En tu recibo se ve ${briefing.receiptLines.join(", ")}.`
      : "En tu recibo no se alcanzan a leer montos claros.";

  if (!briefing.hasOfficialConsulta) {
    return {
      clearAnswer: WORKER_CHAT_NO_CONSULTA_EMPTY,
      known: receipt,
      missing: briefing.missingIdentityDetail ?? "Aún no hay resultado de TU consulta.",
      nextStep: OFFICIAL_CHECK_BUTTON,
    };
  }

  const statuses = briefing.statusLines.length > 0 ? briefing.statusLines.join(". ") : briefing.headline;
  return {
    clearAnswer: `${briefing.comparison.seenLine} ${statuses ?? ""}. ${receipt} Eso no significa que tu patrón esté al corriente.`.replace(/\s+/g, " ").trim(),
    known: [statuses, receipt, ...briefing.hechoLines.slice(0, 3)].filter(Boolean).join(" "),
    missing:
      briefing.comparison.seen === "no_se_pudo"
        ? briefing.missingIdentityDetail ?? "La consulta de hoy no trajo un resultado comparable."
        : "La consulta no confirma que el pago sea el correcto.",
    nextStep: briefing.comparison.nextStep,
  };
}

export function buildOfficialChatStarterQuestions(briefing: OfficialCaseBriefing): string[] {
  if (!briefing.hasOfficialConsulta) {
    return [];
  }
  if (briefing.comparison.seen === "hay_diferencia") {
    return ["¿Hay diferencia con mi recibo?", "¿Qué anoto para pedir aclaración?"];
  }
  if (briefing.comparison.seen === "bien") {
    return ["¿Cuadra con mi recibo?", "¿Qué guardo de este resultado?"];
  }
  return ["¿Se pudo comparar con mi recibo?", "¿Qué falta para consultar otra vez?"];
}

export function buildNoLiveOfficialAnswer(briefing: OfficialCaseBriefing): {
  clearAnswer: string;
  known: string;
  missing: string;
  nextStep: string;
} {
  if (!briefing.hasOfficialConsulta) {
    return {
      clearAnswer: WORKER_CHAT_NO_CONSULTA_EMPTY,
      known: briefing.receiptLines.length > 0
        ? `En tu recibo se ve ${briefing.receiptLines.join(", ")}.`
        : "Todavía no hay un resultado de TU consulta.",
      missing: briefing.missingIdentityDetail ?? "Falta el resultado de TU consulta.",
      nextStep: OFFICIAL_CHECK_BUTTON,
    };
  }

  const statuses = briefing.statusLines.join(". ");
  return {
    clearAnswer: statuses
      ? `${statuses}. Pulsa ${OFFICIAL_CHECK_BUTTON}.`
      : WORKER_CHAT_NO_CONSULTA_EMPTY,
    known: [statuses, ...briefing.hechoLines.slice(0, 3)].filter(Boolean).join(" ") || "Hay una consulta, pero sin un resultado vivo.",
    missing: briefing.missingIdentityDetail ?? "Todavía no hay un resultado vivo de IMSS, SAT o Infonavit.",
    nextStep: OFFICIAL_CHECK_BUTTON,
  };
}

export function chatAnchorFromOfficialCheck(summary: OfficialCheckSummary | null | undefined): OfficialChatAnchor | null {
  if (!summary) return null;
  if (summary.chatAnchor) return summary.chatAnchor;
  if (!consultAttempted(summary)) return null;
  const fromCheck = (fuente: OfficialChatAnchorSource["fuente"]): OfficialChatAnchorSource => {
    const check = summary.checks.find((item) => item.source === fuente);
    const status = check?.status ?? summary.overallStatus;
    return {
      fuente,
      estado: check?.honesty ?? officialStatusToHonesty(status),
      fecha: check?.checkedAt ?? summary.checkedAt,
      hechos: check?.hechos?.slice(0, 3) ?? [],
      motivoFallo: check?.motivoFallo ?? null,
      missingFields: check?.missingFields ?? [],
    };
  };
  return {
    sat: fromCheck("sat"),
    imss: fromCheck("imss"),
    infonavit: fromCheck("infonavit"),
  };
}
