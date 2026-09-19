import {
  shouldAttachOfficialDigest,
  DOF_LAST_GOOD_SEED,
  SCJN_API_BASE,
  SCJN_HARVEST_SEED,
  SIDOF_TITLE_SEARCH_BASE,
  emptyOfficialDigest,
  selectOfficialDigest,
  toDofCitation,
  toScjnCitation,
  type OfficialDigestCitation,
  type OfficialDigestFreshness,
  type OfficialDigestQuery,
  type OfficialDigestResult,
  type OfficialDofSeedEntry,
  type OfficialHarvestEntry,
} from "@shared/officialDigest";

const LIVE_TIMEOUT_MS = 3500;
const SIDOF_SEARCHES = [
  "subcontratación",
  "Ley Federal del Trabajo",
  "jornada laboral",
  "Ley del Seguro Social",
  "Instituto del Fondo Nacional de la Vivienda",
  "tiempo extraordinario",
  "horas extra",
] as const;
const SIDOF_NOTE_URLS = [
  (id: string) => `https://sidof.segob.gob.mx/dof/sidof/notas/${id}`,
  (id: string) => `https://sidof.segob.gob.mx/dof/sidof/nota/${id}`,
];

const LABOR_TITLE_RE =
  /ley federal del trabajo|seguro social|infonavit|subcontrat|jornada laboral|registro de prestadoras|repse|personas trabajadoras/i;
const REJECT_TITLE_RE = /repsesentantes|convocatoria para que las organizaciones obreras/i;

type SidofNote = {
  codNota?: unknown;
  titulo?: unknown;
  fecha?: unknown;
};

function asText(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(Math.trunc(value));
  }
  if (typeof value !== "string") return null;
  const next = value.replace(/\s+/g, " ").trim();
  return next.length > 0 ? next : null;
}

function looksBlockedBody(body: string): boolean {
  return /incapsula|_Incapsula_Resource|pardon our interruption|access denied/i.test(body);
}

async function fetchText(url: string): Promise<{ ok: boolean; status: number; body: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LIVE_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json,text/plain;q=0.9,*/*;q=0.8",
        "User-Agent": "AuditaPatron-Asesor/1.0",
      },
      signal: controller.signal,
    });
    const body = await response.text();
    return { ok: response.ok, status: response.status, body };
  } catch {
    return { ok: false, status: 0, body: "" };
  } finally {
    clearTimeout(timer);
  }
}

function parseJson(body: string): unknown | null {
  const trimmed = body.trim();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
}

function harvestFromLiveTesis(id: string, payload: unknown): OfficialHarvestEntry | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const record = payload as Record<string, unknown>;
  const officialId =
    asText(record.registroDigital) ??
    asText(record.ius) ??
    asText(record.id) ??
    asText(record.officialId) ??
    id;
  if (officialId !== id) return null;
  const title =
    asText(record.rubro) ??
    asText(record.titulo) ??
    asText(record.title) ??
    asText(record.encabezado);
  if (!title) return null;
  const tesis = asText(record.tesis) ?? asText(record.clave) ?? asText(record.tesisKey);
  const url = asText(record.url) ?? `https://sjf2.scjn.gob.mx/detalle/tesis/${officialId}`;
  return {
    title,
    officialId,
    tesis,
    url,
    publishedAt: asText(record.fechaPublicacion) ?? asText(record.publishedAt),
    matchedTopics: ["Laboral"],
  };
}

async function fetchLiveScjn(id: string): Promise<OfficialHarvestEntry | null> {
  const result = await fetchText(`${SCJN_API_BASE}${id}`);
  if (!result.ok || looksBlockedBody(result.body)) return null;
  const parsed = parseJson(result.body);
  return parsed ? harvestFromLiveTesis(id, parsed) : null;
}

function extractOfficialIds(payload: unknown): string[] {
  const ids: string[] = [];
  const push = (value: unknown) => {
    if (typeof value === "number" && Number.isFinite(value)) {
      ids.push(String(Math.trunc(value)));
      return;
    }
    if (typeof value === "string" && /^\d+$/.test(value.trim())) {
      ids.push(value.trim());
    }
  };
  if (Array.isArray(payload)) {
    for (const item of payload) {
      if (item && typeof item === "object") {
        const record = item as Record<string, unknown>;
        push(record.registroDigital ?? record.ius ?? record.id ?? record.officialId);
      } else {
        push(item);
      }
    }
    return [...new Set(ids)];
  }
  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    const nested = record.ids ?? record.data ?? record.tesis ?? record.results;
    if (nested) return extractOfficialIds(nested);
    push(record.count);
  }
  return [...new Set(ids)];
}

async function probeBicentenarioCatalog(): Promise<{ alive: boolean; ids: string[] }> {
  const [countResult, idsResult] = await Promise.all([
    fetchText(`${SCJN_API_BASE}count`),
    fetchText(`${SCJN_API_BASE}ids`),
  ]);
  const countJson = countResult.ok && !looksBlockedBody(countResult.body) ? parseJson(countResult.body) : null;
  const ids =
    idsResult.ok && !looksBlockedBody(idsResult.body) ? extractOfficialIds(parseJson(idsResult.body)) : [];
  return { alive: countJson != null || ids.length > 0, ids };
}

function sidofPayloadToNotes(payload: unknown): SidofNote[] {
  if (!payload || typeof payload !== "object") return [];
  if (Array.isArray(payload)) {
    return payload.filter((item): item is SidofNote => Boolean(item) && typeof item === "object");
  }
  const record = payload as { Notas?: unknown; nota?: unknown };
  if (Array.isArray(record.Notas)) {
    return record.Notas.filter((item): item is SidofNote => Boolean(item) && typeof item === "object");
  }
  if (record.nota && typeof record.nota === "object") {
    return [record.nota as SidofNote];
  }
  if ("codNota" in record || "titulo" in record) {
    return [record as SidofNote];
  }
  return [];
}

function sidofNoteToSeed(note: SidofNote): OfficialDofSeedEntry | null {
  const officialId = asText(note.codNota);
  const title = asText(note.titulo);
  const publishedAt = asText(note.fecha);
  if (!officialId || !title || !publishedAt) return null;
  if (REJECT_TITLE_RE.test(title) || !LABOR_TITLE_RE.test(title)) return null;
  const topics: string[] = [];
  if (/subcontrat|repse/i.test(title)) topics.push("subcontratacion", "repse", "reforma laboral");
  if (/ley federal del trabajo|jornada/i.test(title)) topics.push("lft", "jornada", "reforma laboral");
  if (/seguro social|imss/i.test(title)) topics.push("imss");
  if (/infonavit|vivienda para los trabajadores/i.test(title)) topics.push("infonavit", "vivienda");
  if (topics.length === 0) topics.push("lft");
  return { title, officialId, publishedAt, matchedTopics: topics };
}

async function fetchLiveSidof(query: string): Promise<OfficialDofSeedEntry[]> {
  const url = `${SIDOF_TITLE_SEARCH_BASE}${encodeURIComponent(query)}/1/8/fecha/desc`;
  const result = await fetchText(url);
  if (!result.ok || looksBlockedBody(result.body)) return [];
  const parsed = parseJson(result.body);
  return sidofPayloadToNotes(parsed)
    .map((item) => sidofNoteToSeed(item))
    .filter((item): item is OfficialDofSeedEntry => Boolean(item));
}

async function fetchLiveSidofNote(entry: OfficialDofSeedEntry): Promise<OfficialDofSeedEntry | null> {
  for (const buildUrl of SIDOF_NOTE_URLS) {
    const result = await fetchText(buildUrl(entry.officialId));
    if (!result.ok || looksBlockedBody(result.body)) continue;
    const parsed = parseJson(result.body);
    const match = sidofPayloadToNotes(parsed)
      .map((item) => sidofNoteToSeed(item))
      .find((item) => item?.officialId === entry.officialId);
    if (match) return match;
  }
  return null;
}

function uniqueCitations(items: OfficialDigestCitation[]): OfficialDigestCitation[] {
  const next = new Map<string, OfficialDigestCitation>();
  for (const item of items) {
    if (!/^\d+$/.test(item.officialId)) continue;
    const key = `${item.source}:${item.officialId}`;
    const prev = next.get(key);
    if (!prev || (prev.freshness !== "live" && item.freshness === "live")) {
      next.set(key, item);
    }
  }
  return [...next.values()];
}

export async function collectLiveOfficialCitations(): Promise<{
  citations: OfficialDigestCitation[];
  liveBlocked: boolean;
  liveAttempted: boolean;
}> {
  const catalog = await probeBicentenarioCatalog();
  const scjnResults = await Promise.allSettled(
    SCJN_HARVEST_SEED.map((entry) => fetchLiveScjn(entry.officialId)),
  );
  const sidofSearchResults = await Promise.allSettled(
    SIDOF_SEARCHES.map((query) => fetchLiveSidof(query)),
  );
  const sidofSeedResults = await Promise.allSettled(
    DOF_LAST_GOOD_SEED.map((entry) => fetchLiveSidofNote(entry)),
  );

  const liveScjn: OfficialDigestCitation[] = [];
  let scjnLiveHits = 0;
  scjnResults.forEach((result, index) => {
    const seed = SCJN_HARVEST_SEED[index];
    if (!seed) return;
    if (result.status === "fulfilled" && result.value) {
      scjnLiveHits += 1;
      liveScjn.push(
        toScjnCitation({ ...seed, ...result.value, officialId: seed.officialId }, "live"),
      );
    }
  });

  const liveDof: OfficialDigestCitation[] = [];
  let sidofLiveHits = 0;
  for (const result of sidofSearchResults) {
    if (result.status !== "fulfilled") continue;
    if (result.value.length > 0) sidofLiveHits += 1;
    for (const entry of result.value) {
      liveDof.push(toDofCitation(entry, "live"));
    }
  }
  for (const result of sidofSeedResults) {
    if (result.status !== "fulfilled" || !result.value) continue;
    sidofLiveHits += 1;
    liveDof.push(toDofCitation(result.value, "live"));
  }

  const liveBlocked = scjnLiveHits === 0 && sidofLiveHits === 0 && !catalog.alive;
  const citations = liveBlocked
    ? []
    : uniqueCitations([
        ...liveScjn,
        ...SCJN_HARVEST_SEED.filter(
          (entry) => !liveScjn.some((item) => item.officialId === entry.officialId),
        ).map((entry) => toScjnCitation(entry, "last_good")),
        ...liveDof,
        ...DOF_LAST_GOOD_SEED.filter(
          (entry) => !liveDof.some((item) => item.officialId === entry.officialId),
        ).map((entry) => toDofCitation(entry, "last_good")),
      ]);

  return {
    citations,
    liveBlocked,
    liveAttempted: true,
  };
}

export async function resolveOfficialDigest(
  query: OfficialDigestQuery,
  options?: { live?: boolean },
): Promise<OfficialDigestResult> {
  if (!shouldAttachOfficialDigest(query.prompt)) {
    return {
      citations: [],
      freshness: "last_good",
      liveAttempted: false,
      liveBlocked: false,
      honestyNote: null,
    };
  }

  const allowLive = options?.live !== false;
  if (!allowLive) {
    return selectOfficialDigest(query, {
      freshness: "last_good",
      liveAttempted: false,
      liveBlocked: false,
    });
  }

  const live = await collectLiveOfficialCitations();
  if (live.liveBlocked) {
    return selectOfficialDigest(query, {
      freshness: "last_good",
      liveAttempted: true,
      liveBlocked: true,
    });
  }

  const freshness: OfficialDigestFreshness = live.citations.some((item) => item.freshness === "live")
    ? "live"
    : "last_good";
  return selectOfficialDigest(query, {
    candidates: live.citations.length > 0 ? live.citations : undefined,
    freshness,
    liveAttempted: true,
    liveBlocked: false,
  });
}

export function resolveOfficialDigestFromSeed(query: OfficialDigestQuery): OfficialDigestResult {
  return selectOfficialDigest(query, {
    freshness: "last_good",
    liveAttempted: false,
    liveBlocked: false,
  });
}

export { emptyOfficialDigest, selectOfficialDigest };
