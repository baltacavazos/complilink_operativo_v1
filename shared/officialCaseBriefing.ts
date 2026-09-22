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
  OFFICIAL_FAILED_MISSING,
  buildHonestOfficialPresentation,
  buildInstituteSilencePresentation,
  buildOfficialCheckHeadline,
  buildReceiptOfficialComparisonCopy,
  OFFICIAL_CHECK_SOURCES,
  OFFICIAL_SOURCE_LABEL,
  canDispatchOfficialConsult,
  filterOfficialMissingFieldsForSource,
  looksLikeOfficialCurp,
  looksLikeOfficialNss,
  looksLikeRealWorkerRfc,
  formatOfficialCheckDate,
  hasLiveOfficialResult,
  humanizeOfficialHecho,
  honestyToOfficialStatus,
  identityFlagsFromReceiptValues,
  inferOfficialMissingFieldKeys,
  isGenericSatRfc,
  isPermissionBlockedStatus,
  listFailedOfficialSources,
  listFailedOfficialSourcesFromAnchor,
  looksLikeNoOfficialResponse,
  mergeOfficialIdentityFlags,
  officialDispatchGapDetail,
  officialSourceGapDetail,
  officialStatusToHonesty,
  readOfficialSourceOutcomes,
  reconcileOfficialCheckWithIdentity,
  rewriteOfficialIdentityHechos,
  sourceHasRequiredOfficialIdentity,
  stripContradictoryMissingIdentityCopy,
  type OfficialChatAnchor,
  type OfficialChatAnchorSource,
  type OfficialCheckSummary,
  type OfficialResultPresentation,
  type OfficialCheckStatus,
  type OfficialIdentityFlags,
  type ReciboVsOficial,
  type ReciboVsOficialResultado,
} from "./officialCheckCopy";

export const CASE_ADVISOR_RULE =
  "Responde solo con base en este expediente y estas consultas. Si no hay dato oficial, di que aún no hay resultado / faltan datos — no inventes. Nunca inventes cumple, alta vigente ni salario oficial.";

export const CASE_ADVISOR_FALLO_RULE =
  "Si IMSS, SAT o Infonavit no contestaron: dilo en un solo párrafo. El recibo puede estar leído, pero eso no dice si el patrón está bien dado de alta. No escribas Falló, ni «no de AuditaPatrón», ni «Esto vimos: bien». No inventes que el patrón cumple o incumple. Sin tips laborales genéricos.";

export const WORKER_CHAT_NO_CONSULTA_EMPTY =
  "Aún no hay resultado de TU consulta. Pulsa Consultar IMSS y SAT.";

export type OfficialBriefingFacts = {
  period?: string | null;
  netAmount?: string | null;
  perceptions?: string | null;
  deductions?: string | null;
  salary?: string | null;
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
  /** Recibo contra lo que sí contestó una oficina. Vacío si no hay dato oficial citable. */
  comparisonLines: string[];
  facts: OfficialBriefingFacts;
  instituteSilence: boolean;
  verdict: OfficialResultPresentation | null;
};

const PAY_WELL_RE =
  /me pagan bien|pagan bien|estoy bien pagad|me pagan lo (?:justo|correcto)|me pagan mal|el salario (?:est[aá]|es) (?:bien|correcto|justo)|cobro bien|me pagan (?:poco|de m[aá]s)/i;

export function isPayWellQuestion(prompt?: string | null): boolean {
  return PAY_WELL_RE.test(String(prompt ?? ""));
}

export function identityFlagsFromFacts(facts: OfficialBriefingFacts): OfficialIdentityFlags {
  return identityFlagsFromReceiptValues({
    nss: facts.nss,
    curp: facts.curp,
    rfc: facts.workerRfc,
    workerRfc: facts.workerRfc,
    employerRfc: facts.employerRfc,
  });
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

/** Chat: nunca «Falta tu NSS» si el recibo ya lo muestra. SAT puede pedir RFC real si XAXX. */
export function officialChatIdentityGapDetail(
  identity: OfficialIdentityFlags,
  facts?: OfficialBriefingFacts | null,
): string | null {
  const nssVisible = identity.nss || looksLikeOfficialNss(facts?.nss);
  const rfcVisible = identity.rfc || looksLikeRealWorkerRfc(facts?.workerRfc, facts?.employerRfc);
  if (nssVisible && rfcVisible) {
    return identity.curp || looksLikeOfficialCurp(facts?.curp)
      ? null
      : "Falta tu CURP en el recibo para consultar Infonavit.";
  }
  if (nssVisible && !rfcVisible) {
    if (isGenericSatRfc(facts?.workerRfc)) {
      return "El RFC del recibo es genérico; SAT necesita un RFC real para consultar.";
    }
    return officialSourceGapDetail("sat", facts);
  }
  if (!nssVisible && rfcVisible) {
    return officialSourceGapDetail("imss");
  }
  return officialDispatchGapDetail(identity, facts);
}

export function applyMissingFieldsToIdentity(
  identity: OfficialIdentityFlags,
  _missingFields?: unknown,
): OfficialIdentityFlags {
  return identity;
}

export function mergeOfficialIdentity(
  ...identities: Array<OfficialIdentityFlags | null | undefined>
): OfficialIdentityFlags {
  return mergeOfficialIdentityFlags(...identities);
}

export function collectOfficialMissingFieldKeys(params: {
  officialCheck?: OfficialCheckSummary | null;
  chatAnchor?: OfficialChatAnchor | null;
}): string[] {
  const keys: string[] = [];
  const identity = params.officialCheck?.identity;
  const push = (source: "imss" | "sat" | "infonavit" | null, values?: unknown) => {
    for (const key of filterOfficialMissingFieldsForSource(source, values, identity)) {
      if (!keys.includes(key)) keys.push(key);
    }
  };
  for (const check of params.officialCheck?.checks ?? []) {
    push(check.source, check.missingFields);
    push(check.source, inferOfficialMissingFieldKeys(check.motivoFallo));
    push(check.source, inferOfficialMissingFieldKeys((check.hechos ?? []).join(" ")));
  }
  const anchor = params.chatAnchor ?? params.officialCheck?.chatAnchor;
  if (anchor) {
    for (const source of [anchor.imss, anchor.sat, anchor.infonavit]) {
      push(source.fuente, source.missingFields);
      push(source.fuente, inferOfficialMissingFieldKeys(source.motivoFallo));
      push(source.fuente, inferOfficialMissingFieldKeys(source.hechos.join(" ")));
    }
  }
  return keys;
}

export function formatOfficialStatusLine(params: {
  sourceLabel: string;
  status: OfficialCheckStatus;
  checkedAt?: string | null;
  maintenance?: boolean;
}): string {
  if (params.status === "no_se_pudo") {
    const base = `${params.sourceLabel} — sin respuesta hoy`;
    return params.maintenance ? `${base} · en mantenimiento` : base;
  }
  if (params.status === "pendiente") return `${params.sourceLabel} — esperando hoy`;
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
  identity?: OfficialIdentityFlags | null,
): string {
  const mapped = honestyToOfficialStatus(
    source.estado,
    filterOfficialMissingFieldsForSource(source.fuente, source.missingFields, identity),
    identity,
    source.fuente,
  );
  const status =
    mapped === "pendiente" && looksLikeNoOfficialResponse(source.motivoFallo ?? source.hechos.join(" "))
      ? "no_se_pudo"
      : (mapped ?? "pendiente");
  if (status === "no_se_pudo") {
    const maintenance = /mantenimiento/i.test(`${source.motivoFallo ?? ""} ${source.hechos.join(" ")}`);
    const base = `${sourceLabel(source.fuente)} — sin respuesta hoy`;
    return maintenance ? `${base} · en mantenimiento` : base;
  }
  if (status === "pendiente") return `${sourceLabel(source.fuente)} — esperando hoy`;
  const date = formatOfficialCheckDate(source.fecha ?? fallbackDate);
  const fail = status === "sin_datos" && source.motivoFallo ? ` · ${source.motivoFallo}` : "";
  const label = OFFICIAL_CHECK_STATUS_LABEL[status];
  return date
    ? `${sourceLabel(source.fuente)}: ${label} · ${date}${fail}`
    : `${sourceLabel(source.fuente)}: ${label}${fail}`;
}

function lineWithInstituteFailure(line: string, _source: OfficialChatAnchorSource["fuente"], _detail?: string | null) {
  return line;
}

export function formatOfficialCheckStatusLines(summary: OfficialCheckSummary | null | undefined): string[] {
  if (!summary || isPermissionBlockedStatus(summary.overallStatus)) return [];
  if (summary.chatAnchor) {
    return [summary.chatAnchor.imss, summary.chatAnchor.sat, summary.chatAnchor.infonavit].map(
      (source) => {
        const check = summary.checks.find((item) => item.source === source.fuente);
        const maintenance = /mantenimiento/i.test(
          `${check?.motivoFallo ?? ""} ${source.motivoFallo ?? ""} ${(check?.hechos ?? []).join(" ")} ${source.hechos.join(" ")}`,
        );
        const line =
          check && check.status === "no_se_pudo" && source.estado !== "failed" && source.estado !== "live"
            ? formatOfficialStatusLine({
                sourceLabel: check.sourceLabel,
                status: check.status,
                checkedAt: check.checkedAt ?? source.fecha ?? summary.checkedAt,
                maintenance,
              })
            : formatChatAnchorStatusLine(source, summary.checkedAt, summary.identity);
        return lineWithInstituteFailure(line, source.fuente, check?.detail ?? source.motivoFallo);
      },
    );
  }
  if (summary.checks.length > 0) {
    return summary.checks.map((item) =>
      lineWithInstituteFailure(
        formatOfficialStatusLine({
          sourceLabel: item.sourceLabel,
          status: item.status,
          checkedAt: item.checkedAt ?? summary.checkedAt,
          maintenance: /mantenimiento/i.test(`${item.motivoFallo ?? ""} ${(item.hechos ?? []).join(" ")}`),
        }),
        item.source,
        item.detail,
      ),
    );
  }
  return OFFICIAL_CHECK_SOURCES.map((source) => {
    const hasRequired = sourceHasRequiredOfficialIdentity(source, summary.identity);
    const status = hasRequired
      ? summary.overallStatus === "sin_datos"
        ? "pendiente"
        : summary.overallStatus
      : "sin_datos";
    return lineWithInstituteFailure(
      formatOfficialStatusLine({
        sourceLabel: OFFICIAL_SOURCE_LABEL[source],
        status,
        checkedAt: summary.checkedAt,
      }),
      source,
      null,
    );
  });
}

export function listChatAnchorHechos(
  anchor: OfficialChatAnchor | null | undefined,
  identity?: OfficialIdentityFlags | null,
): string[] {
  if (!anchor) return [];
  return [anchor.imss, anchor.sat, anchor.infonavit].flatMap((source) => {
    const prefix = sourceLabel(source.fuente);
    return rewriteOfficialIdentityHechos(source.fuente, source.hechos, identity)
      .slice(0, 3)
      .map((hecho) => `${prefix}: ${hecho}`);
  });
}

export function listReceiptFactLines(facts: OfficialBriefingFacts): string[] {
  return [
    facts.period ? `periodo ${facts.period}` : null,
    facts.netAmount ? `neto ${facts.netAmount}` : null,
    facts.perceptions ? `percepciones ${facts.perceptions}` : null,
    facts.salary ? `sueldo ${facts.salary}` : null,
    facts.imssWithheld ? `IMSS del recibo ${facts.imssWithheld}` : null,
    facts.isrWithheld ? `ISR del recibo ${facts.isrWithheld}` : null,
    facts.infonavitWithheld ? `Infonavit del recibo ${facts.infonavitWithheld}` : null,
    facts.nss ? `NSS en recibo: ${facts.nss}` : null,
    facts.curp ? `CURP ${facts.curp}` : null,
    facts.workerRfc ? `RFC de la persona trabajadora ${facts.workerRfc}` : null,
    facts.employerRfc ? `RFC del patrón ${facts.employerRfc}` : null,
  ].filter((item): item is string => Boolean(item));
}

export function briefingHasInstituteFailure(briefing: OfficialCaseBriefing): boolean {
  if (briefing.officialCheck?.overallStatus === "no_se_pudo") return true;
  if (listFailedOfficialSources(briefing.officialCheck?.checks).length > 0) return true;
  if (listFailedOfficialSourcesFromAnchor(briefing.chatAnchor).length > 0) return true;
  return briefing.statusLines.some((line) => /sin respuesta hoy|: Falló/.test(line));
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
  const failedSources = [
    ...listFailedOfficialSources(check?.checks),
    ...listFailedOfficialSourcesFromAnchor(check?.chatAnchor),
  ];
  const instituteFailed =
    (seen === "no_se_pudo" || check?.overallStatus === "no_se_pudo") &&
    !hasLiveOfficialResult(check) &&
    (failedSources.length > 0 || check?.overallStatus === "no_se_pudo");
  if (instituteFailed) {
    const silence = buildInstituteSilencePresentation(failedSources);
    return {
      seen: "no_se_pudo",
      seenLine: silence.verdict,
      nextStep: silence.nextStep,
      nextStepLine: formatOfficialNext(silence.nextStep),
      hasOfficialConsulta: true,
    };
  }
  const copy = buildReceiptOfficialComparisonCopy(seen, { instituteFailed: false });
  return {
    seen,
    seenLine: copy.seenLine,
    nextStep: copy.nextStep,
    nextStepLine: copy.nextStepLine,
    hasOfficialConsulta: true,
  };
}

function formatOfficialNext(nextStep: string) {
  return `Qué hacer ahora: ${nextStep}`;
}

function displayReceiptAmount(value: string) {
  const trimmed = value.trim();
  if (trimmed.startsWith("$")) return trimmed;
  if (/^\d[\d,]*(?:\.\d+)?$/.test(trimmed)) return `$${trimmed}`;
  return trimmed;
}

function amountInHecho(text: string) {
  return text.match(/\$\s?\d[\d,]*(?:\.\d{2})?/)?.[0]?.replace(/\s+/g, "") ?? null;
}

/**
 * Compara el recibo con lo que sí contestó SAT o IMSS.
 * No inventa cumplimiento: solo pone lado a lado los números y RFC que ya existen.
 */
export function buildReceiptVsConfirmedLines(params: {
  facts: OfficialBriefingFacts;
  officialCheck?: OfficialCheckSummary | null;
}): string[] {
  const outcomes = readOfficialSourceOutcomes(params.officialCheck ?? null);
  const lines: string[] = [];
  const sat = outcomes.find((item) => item.source === "sat" && item.status === "vivo");
  if (sat) {
    const hechos = sat.hechos.map((item) => humanizeOfficialHecho(item)).filter((item) => item.length > 0);
    const joined = hechos.join(" ");
    const confirmedRfc = joined.toUpperCase().match(/\b([A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3})\b/)?.[1] ?? null;
    const receiptRfc = params.facts.workerRfc?.trim().toUpperCase() || null;
    if (receiptRfc && confirmedRfc) {
      lines.push(
        receiptRfc === confirmedRfc
          ? `Tu recibo muestra el RFC ${receiptRfc}. El SAT confirmó el mismo RFC.`
          : `Tu recibo muestra el RFC ${receiptRfc}. El SAT confirmó ${confirmedRfc}.`,
      );
    } else if (receiptRfc && joined) {
      lines.push(`Tu recibo muestra el RFC ${receiptRfc}. El SAT confirmó: ${joined}.`);
    } else if (joined) {
      lines.push(`El SAT confirmó: ${joined}.`);
    } else if (receiptRfc) {
      lines.push(`Tu recibo muestra el RFC ${receiptRfc}. El SAT contestó, pero no trajo un dato para comparar.`);
    }
  }

  const imss = outcomes.find((item) => item.source === "imss");
  const salaryHecho = (imss?.hechos ?? [])
    .map((item) => humanizeOfficialHecho(item))
    .find((item) => /salario|sueldo|registro del IMSS|\$\s?\d/i.test(item));
  if (salaryHecho) {
    const officialMoney = amountInHecho(salaryHecho);
    const receiptMoney = params.facts.salary || params.facts.netAmount || params.facts.perceptions || null;
    if (officialMoney && receiptMoney) {
      lines.push(
        `En tu recibo se lee ${displayReceiptAmount(receiptMoney)}. El IMSS tiene registrado ${officialMoney}.`,
      );
    } else if (officialMoney) {
      lines.push(`El IMSS tiene registrado un salario de ${officialMoney}.`);
    } else {
      lines.push(salaryHecho.endsWith(".") ? salaryHecho : `${salaryHecho}.`);
    }
  }

  return lines.slice(0, 3);
}

export function buildOfficialCaseBriefing(params: {
  officialCheck?: OfficialCheckSummary | null;
  facts?: OfficialBriefingFacts | null;
  chatAnchor?: OfficialChatAnchor | null;
  reciboVsOficial?: ReciboVsOficial | ReciboVsOficialResultado | null;
  hasDifferenceSignal?: boolean;
  nowMs?: number;
  pendingSinceMs?: number | null;
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
  const receiptIdentity = identityFlagsFromFacts(facts);
  const identity = mergeOfficialIdentity(
    receiptIdentity,
    officialCheck?.identity
      ? {
          nss: officialCheck.identity.nss || receiptIdentity.nss,
          curp: officialCheck.identity.curp || receiptIdentity.curp,
          rfc: officialCheck.identity.rfc && !isGenericSatRfc(facts.workerRfc) ? officialCheck.identity.rfc : receiptIdentity.rfc,
        }
      : receiptIdentity,
  );
  const missingIdentity = listMissingOfficialIdentityLabels(identity);
  const reconciled = reconcileOfficialCheckWithIdentity(
    officialCheck
      ? { ...officialCheck, chatAnchor: chatAnchor ?? officialCheck.chatAnchor ?? null, reciboVsOficial }
      : officialCheck,
    identity,
    { nowMs: params.nowMs, pendingSinceMs: params.pendingSinceMs, facts },
  );
  const comparison = selectReceiptOfficialComparison({
    officialCheck: reconciled,
    facts,
    reciboVsOficial,
    hasDifferenceSignal: params.hasDifferenceSignal,
  });
  const verdict = buildHonestOfficialPresentation(reconciled);
  const formattedStatusLines = formatOfficialCheckStatusLines(reconciled);
  const statusLines = verdict?.sourceLines?.length
    ? [
        ...verdict.sourceLines,
        ...formattedStatusLines.filter((line) => {
          const name = line.split(/[:—]/)[0]?.trim();
          return name ? !verdict.sourceLines.some((item) => item.startsWith(name)) : true;
        }),
      ]
    : formattedStatusLines;
  const canDispatch = canDispatchOfficialConsult(identity);
  const headlineStatus =
    reconciled &&
    !isPermissionBlockedStatus(reconciled.overallStatus) &&
    !(reconciled.overallStatus === "sin_datos" && canDispatch)
      ? reconciled
      : null;

  return {
    hasOfficialConsulta: comparison.hasOfficialConsulta,
    hasLiveOfficialResult: hasLiveOfficialResult(reconciled),
    officialCheck: reconciled,
    chatAnchor: reconciled?.chatAnchor ?? chatAnchor,
    reciboVsOficial,
    statusLines,
    hechoLines: listChatAnchorHechos(reconciled?.chatAnchor ?? chatAnchor, identity),
    headline: headlineStatus ? buildOfficialCheckHeadline(headlineStatus) : null,
    missingIdentity,
    missingIdentityDetail: officialChatIdentityGapDetail(identity, facts),
    receiptLines: listReceiptFactLines(facts),
    comparison,
    comparisonLines: buildReceiptVsConfirmedLines({ facts, officialCheck: reconciled }),
    facts,
    instituteSilence: verdict?.kind === "silent",
    verdict,
  };
}

const STALE_SOURCE_STATUS_RE = (source: string) =>
  new RegExp(
    `${source}:\\s*(?:Pendiente|Faltan datos)(?:\\s*·\\s*\\d{2}/\\d{2}/\\d{4})?(?:\\s*·\\s*[^\\n.]*)?`,
    "gi",
  );

/** Cita y historial usan el mismo Falló de la tarjeta, no un Pendiente viejo. */
export function alignVisibleChatWithBriefing(
  text: string,
  briefing?: Pick<OfficialCaseBriefing, "statusLines" | "facts"> | null,
): string {
  const raw = String(text ?? "");
  if (!raw.trim()) return "";
  const identity = briefing ? identityFlagsFromFacts(briefing.facts) : null;
  let next = stripContradictoryMissingIdentityCopy(raw, identity, briefing?.facts);
  const failedLines = (briefing?.statusLines ?? []).filter((line) =>
    /:\s*Falló|— sin respuesta hoy/.test(line),
  );
  if (failedLines.length > 0) {
    const sat = failedLines.find((line) => /^SAT\b/.test(line));
    const infonavit = failedLines.find((line) => /^Infonavit\b/.test(line));
    if (sat || infonavit) {
      next = next.replace(/SAT\/Infonavit:\s*Faltan datos(?:\s*·\s*\d{2}\/\d{2}\/\d{4})?/gi, [sat, infonavit].filter(Boolean).join(". "));
    }
    for (const line of failedLines) {
      const source = line.match(/^(IMSS|SAT|Infonavit)/)?.[1];
      if (!source) continue;
      next = next.replace(STALE_SOURCE_STATUS_RE(source), line.trim());
    }
    next = next.replace(
      /IMSS:\s*Pendiente[^.\n]{0,80}SAT\/Infonavit:\s*Faltan datos[^.\n]*/gi,
      failedLines.join(". "),
    );
  }
  return next.replace(/[ \t]{2,}/g, " ").replace(/\n{3,}/g, "\n\n").trim();
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
  const missing =
    briefing.missingIdentityDetail ?? "No faltan NSS, CURP ni RFC en el papel, o ya se usaron.";
  const nssAlreadyOnReceipt =
    Boolean(briefing.facts.nss) || !briefing.missingIdentity.includes("NSS");
  const nssFact = briefing.facts.nss
    ? `Hecho fijo del recibo: NSS en recibo: ${briefing.facts.nss}. PROHIBIDO escribir «Falta tu NSS» o «Falta tu NSS y RFC en el recibo para consultar.» Si el NSS ya está en el recibo, no lo niegues.`
    : nssAlreadyOnReceipt
      ? "Hecho fijo: el recibo ya tiene NSS. PROHIBIDO escribir «Falta tu NSS» o «Falta tu NSS y RFC en el recibo para consultar.» Si el NSS ya está en el recibo, no lo niegues."
      : "En el recibo no se alcanzó a leer un NSS.";
  const personRfc = looksLikeRealWorkerRfc(briefing.facts.workerRfc, briefing.facts.employerRfc)
    ? briefing.facts.workerRfc
    : null;
  const rfcFact = personRfc
    ? `Hecho fijo del recibo: RFC de la persona trabajadora ${personRfc}. Si ya está en el recibo, no lo niegues ni pidas otro para consultar SAT.`
    : "";
  const grounded = stripContradictoryMissingIdentityCopy(
    [
      CASE_ADVISOR_RULE,
      `Nunca inventes: ${ADVISOR_CHAT_NEVER_INVENT.join(", ")}.`,
      "Estados oficiales del caso (únicos que puedes citar como consulta):",
      official,
      "Hechos de TU consulta (únicos que puedes citar; máximo 3 por fuente):",
      hechos,
      `Comparación recibo vs oficial: ${briefing.comparison.seenLine} ${briefing.comparison.nextStepLine}`,
      briefing.comparisonLines.length > 0
        ? `Recibo contra lo que sí contestó:\n${briefing.comparisonLines.map((item) => `- ${item}`).join("\n")}`
        : "Recibo contra lo que sí contestó: aún no hay un dato oficial para poner junto al recibo.",
      CASE_ADVISOR_FALLO_RULE,
      "Montos y datos del recibo (únicos números del papel):",
      receipt,
      `Identidad para consultar: ${missing}`,
      "Si preguntan «¿me pagan bien?», ancla la respuesta a esa comparación y a IMSS/SAT/Infonavit del caso. No inventes que el patrón cumple.",
    ].join("\n"),
    identityFlagsFromFacts(briefing.facts),
    briefing.facts,
  );
  return [rfcFact, nssFact, alignVisibleChatWithBriefing(grounded, briefing)].filter(Boolean).join("\n");
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

  if (briefing.verdict?.kind === "mixed") {
    return {
      clearAnswer: briefing.verdict.chat,
      known: [briefing.verdict.verdict, ...briefing.hechoLines.slice(0, 3)].filter(Boolean).join(" "),
      missing: "Todavía falta la respuesta de las oficinas que hoy no contestaron.",
      nextStep: briefing.verdict.nextStep,
    };
  }

  if (briefing.instituteSilence) {
    const silence = briefing.verdict ?? buildInstituteSilencePresentation([
      ...listFailedOfficialSources(briefing.officialCheck?.checks),
      ...listFailedOfficialSourcesFromAnchor(briefing.chatAnchor),
    ]);
    return {
      clearAnswer: silence.chat,
      known: "Tu recibo ya está leído.",
      missing: OFFICIAL_FAILED_MISSING,
      nextStep: silence.nextStep,
    };
  }

  const statuses = briefing.statusLines.length > 0 ? briefing.statusLines.join(". ") : briefing.headline;
  return {
    clearAnswer: `${briefing.comparison.seenLine} ${statuses ?? ""}. ${receipt} Eso no significa que tu patrón esté al corriente.`.replace(/\s+/g, " ").trim(),
    known: [statuses, receipt, ...briefing.hechoLines.slice(0, 3)].filter(Boolean).join(" "),
    missing:
      briefing.comparison.seen === "no_se_pudo"
        ? briefing.missingIdentityDetail ?? OFFICIAL_FAILED_MISSING
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
  if (briefing.instituteSilence || briefing.comparison.seen === "no_se_pudo") {
    return ["¿Qué implica esto para mi pago?"];
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

  if (briefing.verdict?.kind === "mixed") {
    return {
      clearAnswer: briefing.verdict.chat,
      known: [briefing.verdict.verdict, ...briefing.hechoLines.slice(0, 3)].filter(Boolean).join(" "),
      missing: "Todavía falta la respuesta de las oficinas que hoy no contestaron.",
      nextStep: briefing.verdict.nextStep,
    };
  }

  if (briefing.instituteSilence || briefingHasInstituteFailure(briefing)) {
    const silence = briefing.verdict?.kind === "silent"
      ? briefing.verdict
      : buildInstituteSilencePresentation([
          ...listFailedOfficialSources(briefing.officialCheck?.checks),
          ...listFailedOfficialSourcesFromAnchor(briefing.chatAnchor),
        ]);
    return {
      clearAnswer: silence.chat,
      known: "Tu recibo ya está leído.",
      missing: OFFICIAL_FAILED_MISSING,
      nextStep: silence.nextStep,
    };
  }

  const statuses = briefing.statusLines.join(". ");
  return {
    clearAnswer: statuses ? `${statuses}. Pulsa ${OFFICIAL_CHECK_BUTTON}.` : WORKER_CHAT_NO_CONSULTA_EMPTY,
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
