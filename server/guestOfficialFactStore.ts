import type { OfficialCheckSummary } from "@shared/officialCheckCopy";
import { hasUsableOfficialFact } from "@shared/officialResultNotification";

/**
 * Memoria del hecho oficial para una consulta guest.
 *
 * La sesión se ata al trace y al guestPreviewId que ya viajan en el token
 * firmado de OfficialCheck. No crea usuario ni expediente.
 *
 * Límite: esta memoria vive en el proceso. Si la persona cierra la pestaña,
 * sessionStorage bota el token y no hay correo (el aviso por email exige cuenta).
 * Si se queda en /auditar o en Home, o recarga esa misma pestaña, el token sigue
 * y esta memoria devuelve el hecho.
 */
const GUEST_OFFICIAL_FACT_TTL_MS = 45 * 60 * 1000;

type GuestOfficialSession = {
  guestPreviewId: string;
  traceId: string;
  createdAtMs: number;
  officialCheck: OfficialCheckSummary | null;
  arrivedAt: string | null;
};

const sessionsByAlias = new Map<string, GuestOfficialSession>();
const stashedByAlias = new Map<string, { officialCheck: OfficialCheckSummary; arrivedAt: string; storedAtMs: number }>();

function aliasKeys(ids: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const keys: string[] = [];
  for (const id of ids) {
    const trimmed = typeof id === "string" ? id.trim() : "";
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    keys.push(trimmed);
  }
  return keys;
}

function sessionAliases(session: Pick<GuestOfficialSession, "guestPreviewId" | "traceId">): string[] {
  return aliasKeys([
    session.traceId,
    session.guestPreviewId,
    `guest-official:${session.guestPreviewId}`,
  ]);
}

function bind(session: GuestOfficialSession) {
  for (const alias of sessionAliases(session)) {
    sessionsByAlias.set(alias, session);
  }
}

function drop(session: GuestOfficialSession) {
  for (const alias of sessionAliases(session)) {
    if (sessionsByAlias.get(alias) === session) sessionsByAlias.delete(alias);
  }
}

function expired(createdAtMs: number, nowMs: number) {
  return nowMs - createdAtMs >= GUEST_OFFICIAL_FACT_TTL_MS;
}

function findSession(ids: Array<string | null | undefined>): GuestOfficialSession | null {
  for (const alias of aliasKeys(ids)) {
    const session = sessionsByAlias.get(alias);
    if (session) return session;
  }
  return null;
}

function sourceRank(check: OfficialCheckSummary["checks"][number]): number {
  const live = check.status === "vivo" || check.honesty === "live";
  const facts = (check.hechos ?? []).some((item) => item.trim().length > 0);
  if (live && facts) return 3;
  if (live) return 2;
  if (check.status === "pendiente" || check.honesty === "pending") return 1;
  return 0;
}

function mergeChecks(
  current: OfficialCheckSummary["checks"],
  incoming: OfficialCheckSummary["checks"],
): OfficialCheckSummary["checks"] {
  const merged = new Map(current.map((check) => [check.source, check]));
  for (const check of incoming) {
    const previous = merged.get(check.source);
    if (!previous || sourceRank(check) >= sourceRank(previous)) merged.set(check.source, check);
  }
  return [...merged.values()];
}

/**
 * Un reintento del IMSS no borra el SAT que ya contestó, ni un pendiente vacío
 * pisa un hecho que ya llegó.
 */
function preferOfficialCheck(
  current: OfficialCheckSummary | null,
  incoming: OfficialCheckSummary | null,
): OfficialCheckSummary | null {
  if (!incoming) return current;
  if (!current) return incoming;
  const checks = mergeChecks(current.checks ?? [], incoming.checks ?? []);
  const anyLive = checks.some((check) => check.status === "vivo" || check.honesty === "live");
  const anyPending = checks.some((check) => check.status === "pendiente" || check.honesty === "pending");
  const overallStatus = anyLive ? "vivo" : anyPending ? "pendiente" : incoming.overallStatus;
  return {
    ...incoming,
    checks,
    overallStatus,
    checkedAt: incoming.checkedAt ?? current.checkedAt,
    chatAnchor: incoming.chatAnchor ?? current.chatAnchor,
    identity: {
      nss: Boolean(incoming.identity?.nss || current.identity?.nss),
      curp: Boolean(incoming.identity?.curp || current.identity?.curp),
      rfc: Boolean(incoming.identity?.rfc || current.identity?.rfc),
    },
  };
}

function takeStashed(ids: Array<string | null | undefined>, nowMs: number) {
  let found: { officialCheck: OfficialCheckSummary; arrivedAt: string } | null = null;
  for (const alias of aliasKeys(ids)) {
    const stashed = stashedByAlias.get(alias);
    if (!stashed) continue;
    stashedByAlias.delete(alias);
    if (expired(stashed.storedAtMs, nowMs)) continue;
    if (!found || hasUsableOfficialFact(stashed.officialCheck)) {
      found = { officialCheck: stashed.officialCheck, arrivedAt: stashed.arrivedAt };
    }
  }
  return found;
}

export function resetGuestOfficialFactStoreForTests() {
  sessionsByAlias.clear();
  stashedByAlias.clear();
}

export function rememberGuestOfficialSession(params: {
  guestPreviewId: string;
  traceId: string;
  officialCheck: OfficialCheckSummary | null;
  nowMs?: number;
}): GuestOfficialSession {
  const nowMs = params.nowMs ?? Date.now();
  const existing = findSession([params.traceId, params.guestPreviewId, `guest-official:${params.guestPreviewId}`]);
  if (existing && expired(existing.createdAtMs, nowMs)) {
    drop(existing);
  }
  const live = existing && !expired(existing.createdAtMs, nowMs) ? existing : null;
  const stashed = takeStashed([params.traceId, params.guestPreviewId, `guest-official:${params.guestPreviewId}`], nowMs);
  const officialCheck = preferOfficialCheck(
    preferOfficialCheck(live?.officialCheck ?? null, params.officialCheck),
    stashed?.officialCheck ?? null,
  );
  const session: GuestOfficialSession = {
    guestPreviewId: params.guestPreviewId,
    traceId: params.traceId,
    createdAtMs: live?.createdAtMs ?? nowMs,
    officialCheck,
    arrivedAt: hasUsableOfficialFact(officialCheck)
      ? live?.arrivedAt ?? stashed?.arrivedAt ?? new Date(nowMs).toISOString()
      : live?.arrivedAt ?? null,
  };
  bind(session);
  return session;
}

export function persistGuestOfficialFact(params: {
  lookupIds: Array<string | null | undefined>;
  officialCheck: OfficialCheckSummary | null;
  arrivedAt: string;
  nowMs?: number;
}): GuestOfficialSession | null {
  if (!params.officialCheck) return null;
  const nowMs = params.nowMs ?? Date.now();
  const session = findSession(params.lookupIds);
  if (!session || expired(session.createdAtMs, nowMs)) {
    if (session && expired(session.createdAtMs, nowMs)) drop(session);
    for (const alias of aliasKeys(params.lookupIds)) {
      const previous = stashedByAlias.get(alias);
      const officialCheck =
        preferOfficialCheck(previous?.officialCheck ?? null, params.officialCheck) ?? params.officialCheck;
      stashedByAlias.set(alias, {
        officialCheck,
        arrivedAt: hasUsableOfficialFact(officialCheck) ? params.arrivedAt : previous?.arrivedAt ?? params.arrivedAt,
        storedAtMs: previous?.storedAtMs ?? nowMs,
      });
    }
    return null;
  }

  session.officialCheck = preferOfficialCheck(session.officialCheck, params.officialCheck);
  if (hasUsableOfficialFact(session.officialCheck)) {
    session.arrivedAt = params.arrivedAt;
  }
  bind(session);
  return session;
}

export function readGuestOfficialFact(params: {
  guestPreviewId: string;
  traceId: string;
  nowMs?: number;
}): GuestOfficialSession | null {
  const nowMs = params.nowMs ?? Date.now();
  const session = findSession([params.traceId, params.guestPreviewId, `guest-official:${params.guestPreviewId}`]);
  if (!session) return null;
  if (expired(session.createdAtMs, nowMs)) {
    drop(session);
    return null;
  }
  if (session.guestPreviewId !== params.guestPreviewId && session.traceId !== params.traceId) return null;
  return session;
}
