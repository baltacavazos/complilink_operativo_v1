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
  answeredOfficialSourceLine,
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
  isPlaceholderSatLegalName,
  isUnusableSatLegalNameLine,
  readInstitutePayFacts,
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
  silentOfficialSourceLine,
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
  sdi?: string | null;
  employerName?: string | null;
  folio?: string | null;
  /** Folio fiscal del CFDI. En pantalla se dice «folio fiscal», no la sigla. */
  uuid?: string | null;
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
    return silentOfficialSourceLine(params.sourceLabel, Boolean(params.maintenance));
  }
  if (params.status === "pendiente") return `${params.sourceLabel} — esperando hoy`;
  if (params.status === "vivo") return answeredOfficialSourceLine(params.sourceLabel, params.checkedAt);
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
    return silentOfficialSourceLine(sourceLabel(source.fuente), maintenance);
  }
  if (status === "pendiente") return `${sourceLabel(source.fuente)} — esperando hoy`;
  if (status === "vivo") return answeredOfficialSourceLine(sourceLabel(source.fuente), source.fecha ?? fallbackDate);
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

function satLegalNameFromHechos(hechoLines: string[]): string | null {
  for (const line of hechoLines) {
    const match = line.match(/nombre en el sat(?:\s*\([^)]*\))?\s*[:：-]\s*(.+)$/i);
    if (!match) continue;
    const name = match[1].replace(/\.+$/g, "").trim();
    if (name && !isPlaceholderSatLegalName(name)) return name;
  }
  return null;
}

export function buildWorkerPocketLead(
  facts: OfficialBriefingFacts,
  hechoLines: string[] = [],
): { lead: string[]; receiptData: string[] } {
  const lead: string[] = [];
  const employer = facts.employerName?.trim() || "";
  if (employer && !isPlaceholderSatLegalName(employer, facts.employerRfc)) {
    lead.push(`Tu patrón en el recibo: ${employer}`);
  }
  const satName = satLegalNameFromHechos(hechoLines);
  if (satName && satName.toLocaleLowerCase("es-MX") !== employer.toLocaleLowerCase("es-MX")) {
    lead.push(`Nombre en el SAT: ${satName}`);
  }
  const amount = facts.netAmount || facts.perceptions;
  if (amount && facts.period) {
    lead.push(`Te pagaron: ${amount} · del ${facts.period}`);
  } else if (amount) {
    lead.push(`Te pagaron: ${amount}`);
  } else if (facts.period) {
    lead.push(`Periodo de este recibo: ${facts.period}`);
  }
  if (lead.length < 3 && facts.deductions) {
    lead.push(`Descuentos en este recibo: ${facts.deductions}`);
  }
  const satConfirmedRfc = hechoLines.some((line) =>
    /SAT confirmó el RFC|RFC coincide con el SAT/i.test(line),
  );
  if (satConfirmedRfc && lead.length < 3) {
    lead.push("Tu RFC coincide con el SAT");
  }
  const receiptData = [
    facts.workerRfc ? `RFC: ${facts.workerRfc}` : null,
    facts.curp ? `CURP: ${facts.curp}` : null,
    facts.nss ? `NSS: ${facts.nss}` : null,
    facts.employerRfc ? `RFC del patrón: ${facts.employerRfc}` : null,
  ].filter((item): item is string => Boolean(item));
  return { lead: lead.slice(0, 3), receiptData };
}

export function listReceiptFactLines(facts: OfficialBriefingFacts): string[] {
  return [
    facts.period ? `periodo ${facts.period}` : null,
    facts.netAmount ? `neto ${facts.netAmount}` : null,
    facts.perceptions ? `Lo que te pagaron (bruto visible): ${facts.perceptions}` : null,
    facts.deductions ? `Descuentos: ${facts.deductions}` : null,
    facts.salary ? `sueldo ${facts.salary}` : null,
    facts.sdi ? `salario diario integrado ${displayReceiptAmount(facts.sdi)}` : null,
    facts.employerName ? `patrón ${facts.employerName}` : null,
    facts.folio ? `folio ${facts.folio}` : null,
    facts.uuid ? `folio fiscal ${facts.uuid}` : null,
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
  return briefing.statusLines.some((line) =>
    /sin respuesta hoy|no contestó|: Falló|Hoy no pudimos consultar/i.test(line),
  );
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

function moneyCents(value: string): number | null {
  const cleaned = value.replace(/[^\d.,-]/g, "");
  if (!cleaned) return null;
  const normalized =
    cleaned.includes(",") && cleaned.includes(".")
      ? cleaned.replace(/,/g, "")
      : /,\d{1,2}$/.test(cleaned)
        ? cleaned.replace(/\./g, "").replace(",", ".")
        : cleaned.replace(/,/g, "");
  const amount = Number(normalized);
  if (!Number.isFinite(amount)) return null;
  return Math.round(amount * 100);
}

function foldPartyName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function partyNamesMatch(left: string, right: string) {
  const a = foldPartyName(left);
  const b = foldPartyName(right);
  if (!a || !b) return false;
  if (a === b) return true;
  const short = a.length <= b.length ? a : b;
  const long = a.length <= b.length ? b : a;
  return short.length >= 8 && long.includes(short);
}

type ReceiptInstituteVerdict = {
  resultado: ReciboVsOficialResultado;
  nextStep: string;
};

function institutePayFromCheck(check?: OfficialCheckSummary | null) {
  const attached = check?.institutePay;
  if (attached && (attached.salary || attached.employer || attached.employerRfc)) return attached;
  return readInstitutePayFacts(check ?? null);
}

/** Un solo punto al final. «Persona física.» no se vuelve «Persona física..». */
function closeOfficialSentence(text: string): string {
  const body = text.replace(/\s+/g, " ").trim().replace(/\.+$/g, "");
  return body ? `${body}.` : "";
}

function receiptInstituteNextStep(diffs: Array<"sueldo" | "patron">, compared: boolean): string {
  if (!compared) return "Revisa que el recibo traiga sueldo y patrón, y vuelve a consultar.";
  if (diffs.length === 0) return "Guarda este resultado con la fecha.";
  if (diffs.includes("sueldo") && diffs.includes("patron")) {
    return "Anota sueldo y patrón del recibo junto a lo que el IMSS tiene registrado, y pide aclaración por escrito.";
  }
  if (diffs.includes("sueldo")) {
    return "Anota el sueldo del recibo y el que el IMSS tiene registrado, y pide aclaración por escrito a patrón o RH.";
  }
  return "Anota el patrón del recibo y el que el IMSS tiene registrado, y pide aclaración por escrito.";
}

/**
 * Compara el recibo con lo que sí contestó SAT, IMSS o Infonavit.
 * No inventa certificado, ni iguala un descuento del recibo con un saldo.
 */
export function buildReceiptVsConfirmedLines(params: {
  facts: OfficialBriefingFacts;
  officialCheck?: OfficialCheckSummary | null;
}): { lines: string[]; verdict: ReceiptInstituteVerdict | null } {
  const outcomes = readOfficialSourceOutcomes(params.officialCheck ?? null);
  const lines: string[] = [];
  const sat = outcomes.find((item) => item.source === "sat" && item.status === "vivo");
  if (sat) {
    const hechos = sat.hechos
      .map((item) => humanizeOfficialHecho(item))
      .filter((item) => item.length > 0 && !isUnusableSatLegalNameLine(item, params.facts.workerRfc));
    const joined = hechos.join(" ");
    const confirmedRfc = joined.toUpperCase().match(/\b([A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3})\b/)?.[1] ?? null;
    const receiptRfc = params.facts.workerRfc?.trim().toUpperCase() || null;
    const confirmedBySentence = /confirm[oó] el rfc/i.test(joined);
    const rfcToCompare = confirmedRfc ?? (confirmedBySentence ? receiptRfc : null);
    const regimen = joined.match(/r[eé]gimen en SAT:\s*([^.]+)/i)?.[1]?.trim() ?? null;
    const satNameRaw = joined.match(/raz[oó]n social en SAT:\s*([^.]+)/i)?.[1]?.trim() ?? null;
    const satName = satNameRaw && !isPlaceholderSatLegalName(satNameRaw, receiptRfc) ? satNameRaw : null;
    if (receiptRfc && rfcToCompare) {
      lines.push(
        receiptRfc === rfcToCompare
          ? `Tu recibo muestra el RFC ${receiptRfc}. El SAT confirmó el mismo RFC.`
          : `Tu recibo muestra el RFC ${receiptRfc}. El SAT confirmó ${rfcToCompare}.`,
      );
    } else if (regimen || satName) {
      const bits = [
        satName ? `el nombre ${satName}` : null,
        regimen ? `el régimen ${regimen}` : null,
      ].filter(Boolean);
      lines.push(`El SAT contestó con ${bits.join(" y ")}.`);
    } else if (receiptRfc && joined && !/certificado/i.test(joined)) {
      lines.push(`Tu recibo muestra el RFC ${receiptRfc}. El SAT confirmó: ${closeOfficialSentence(joined)}`);
    } else if (joined && !/certificado/i.test(joined)) {
      lines.push(`El SAT confirmó: ${closeOfficialSentence(joined)}`);
    } else if (receiptRfc) {
      lines.push(`Tu recibo muestra el RFC ${receiptRfc}. El SAT contestó, pero no trajo un dato para comparar.`);
    }
  }

  const institutePay = institutePayFromCheck(params.officialCheck);
  let verdict: ReceiptInstituteVerdict | null = null;
  if (institutePay && (institutePay.salary || institutePay.employer || institutePay.employerRfc)) {
    const diffs: Array<"sueldo" | "patron"> = [];
    let compared = false;
    const detail: string[] = [];
    const receiptMoney = params.facts.salary || params.facts.sdi || null;
    if (institutePay.salary && receiptMoney) {
      compared = true;
      const officialCents = moneyCents(institutePay.salary);
      const receiptCents = moneyCents(receiptMoney);
      if (officialCents != null && receiptCents != null && officialCents !== receiptCents) diffs.push("sueldo");
      detail.push(
        `En tu recibo se lee ${displayReceiptAmount(receiptMoney)}. El IMSS tiene registrado ${displayReceiptAmount(institutePay.salary)}.`,
      );
    } else if (institutePay.salary) {
      detail.push(`El IMSS tiene registrado un salario de ${displayReceiptAmount(institutePay.salary)}. En el recibo no se leyó un sueldo para comparar.`);
    }

    const receiptRfc = params.facts.employerRfc?.trim().toUpperCase() || null;
    const receiptName = params.facts.employerName?.trim() || null;
    const officialRfc = institutePay.employerRfc?.trim().toUpperCase() || null;
    const officialName = institutePay.employer?.trim() || null;
    if ((officialRfc || officialName) && (receiptRfc || receiptName)) {
      compared = true;
      const rfcDiffers = Boolean(officialRfc && receiptRfc && officialRfc !== receiptRfc);
      const nameDiffers = Boolean(officialName && receiptName && !partyNamesMatch(officialName, receiptName));
      const rfcAgrees = Boolean(officialRfc && receiptRfc && officialRfc === receiptRfc);
      if (rfcDiffers || (nameDiffers && !rfcAgrees)) diffs.push("patron");
      if (receiptName && officialName) {
        detail.push(`En tu recibo el patrón es ${receiptName}. El IMSS tiene registrado a ${officialName}.`);
      } else if (receiptRfc && officialRfc) {
        detail.push(`En tu recibo el RFC del patrón es ${receiptRfc}. El IMSS tiene registrado el RFC ${officialRfc}.`);
      } else if (officialName) {
        detail.push(`El IMSS tiene registrado a ${officialName}.`);
      } else if (officialRfc) {
        detail.push(`El IMSS tiene registrado el RFC ${officialRfc}.`);
      }
    } else if (officialName || officialRfc) {
      detail.push(
        officialName
          ? `El IMSS tiene registrado a ${officialName}. En el recibo no se leyó el patrón para comparar.`
          : `El IMSS tiene registrado el RFC ${officialRfc}. En el recibo no se leyó el RFC del patrón para comparar.`,
      );
    }
    if (institutePay.days) detail.push(`El reporte trae ${institutePay.days} días cotizados.`);

    const resultado: ReciboVsOficialResultado = !compared ? "no_se_pudo" : diffs.length > 0 ? "hay_diferencia" : "bien";
    const nextStep = receiptInstituteNextStep(diffs, compared);
    if (compared) verdict = { resultado, nextStep };
    lines.push(...detail);
  }

  const infonavit = outcomes.find((item) => item.source === "infonavit");
  const infonavitText = (infonavit?.hechos ?? []).join(" ");
  const housingBalance = infonavitText.match(/saldo de subcuenta de vivienda:\s*(\$\s?\d[\d,]*(?:\.\d{2})?)/i)?.[1]?.replace(/\s+/g, "") ?? null;
  const creditBalance = infonavitText.match(/saldo del cr[eé]dito reportado:\s*(\$\s?\d[\d,]*(?:\.\d{2})?)/i)?.[1]?.replace(/\s+/g, "") ?? null;
  const reportedBalance = housingBalance ?? creditBalance;
  if (reportedBalance) {
    const kind = housingBalance ? "subcuenta de vivienda" : "crédito";
    lines.push(`Infonavit reportó un saldo de ${kind} de ${reportedBalance}. No es el descuento de tu recibo.`);
  }

  return { lines: lines.slice(0, 5), verdict };
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
  const receiptComparison = buildReceiptVsConfirmedLines({ facts, officialCheck: reconciled });
  let comparison = selectReceiptOfficialComparison({
    officialCheck: reconciled,
    facts,
    reciboVsOficial,
    hasDifferenceSignal: params.hasDifferenceSignal,
  });
  if (receiptComparison.verdict && receiptComparison.verdict.resultado !== "no_se_pudo") {
    const copy = buildReceiptOfficialComparisonCopy(receiptComparison.verdict.resultado);
    comparison = {
      seen: receiptComparison.verdict.resultado,
      seenLine: copy.seenLine,
      nextStep: receiptComparison.verdict.nextStep,
      nextStepLine: formatOfficialNext(receiptComparison.verdict.nextStep),
      hasOfficialConsulta: true,
    };
  }
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
    comparisonLines: receiptComparison.lines,
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
    /:\s*Falló|— sin respuesta hoy|no contestó|Hoy no pudimos consultar/i.test(line),
  );
  if (failedLines.length > 0) {
    const sat = failedLines.find((line) => /\bSAT\b/.test(line));
    const infonavit = failedLines.find((line) => /\bInfonavit\b/.test(line));
    if (sat || infonavit) {
      next = next.replace(/SAT\/Infonavit:\s*Faltan datos(?:\s*·\s*\d{2}\/\d{2}\/\d{4})?/gi, [sat, infonavit].filter(Boolean).join(". "));
    }
    for (const line of failedLines) {
      const source =
        line.match(/consultar\s+(IMSS|SAT|Infonavit)\b/i)?.[1] ??
        line.match(/^(?:Hoy\s+)?(IMSS|SAT|Infonavit)/)?.[1];
      if (!source) continue;
      const canonical = /^imss$/i.test(source) ? "IMSS" : /^sat$/i.test(source) ? "SAT" : "Infonavit";
      next = next.replace(STALE_SOURCE_STATUS_RE(canonical), line.trim());
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
    const statuses = briefing.statusLines.join(". ");
    return {
      clearAnswer: `${briefing.comparison.seenLine} ${statuses}. ${receipt} Eso no significa que tu patrón esté al corriente.`.replace(/\s+/g, " ").trim(),
      known: [briefing.verdict.verdict, statuses, receipt].filter(Boolean).join(" "),
      missing: "Todavía falta la respuesta de las oficinas que hoy no contestaron.",
      nextStep: briefing.verdict.nextStep,
    };
  }

  if (briefing.verdict?.kind === "settled") {
    const statuses = briefing.statusLines.join(". ");
    return {
      clearAnswer: `${briefing.comparison.seenLine} ${briefing.verdict.verdict} ${statuses}. ${receipt} Eso no significa que tu patrón esté al corriente.`.replace(/\s+/g, " ").trim(),
      known: [briefing.verdict.verdict, statuses, receipt].filter(Boolean).join(" "),
      missing:
        briefing.comparison.seen === "hay_diferencia"
          ? "Hay una diferencia entre el recibo y lo consultado."
          : "La consulta no confirma que el pago sea el correcto.",
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
    known: [statuses, ...briefing.hechoLines.slice(0, 3)].filter(Boolean).join(" ") || "Hay una consulta, pero sin una respuesta de las oficinas.",
    missing: briefing.missingIdentityDetail ?? "Todavía no hay una respuesta de IMSS, SAT o Infonavit.",
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
