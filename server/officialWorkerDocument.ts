import { randomBytes } from "node:crypto";
import {
  OFFICIAL_PAGE_DOWN,
  OFFICIAL_WORKER_KINDS,
  OFFICIAL_WORKER_PAGES,
  buildOfficialWorkerAdvisorAnswer,
  officialVerificationHostAllowed,
  pickVerificationUrl,
  readOfficialWorkerDocumentText,
  type ExpectedWorkerIdentity,
  type OfficialWorkerKind,
  type OfficialWorkerReading,
  type OnlineVerification,
} from "@shared/officialWorkerDocument";
import { extractPdfPlainText } from "./pdfTextExtraction";

const READING_TTL_MS = 2 * 60 * 60 * 1000;
const READING_MAX = 400;
const HEALTH_TTL_MS = 45_000;
const FETCH_TIMEOUT_MS = 8_000;
const CAPTCHA_RE = /captcha|recaptcha|hcaptcha|no soy un robot/i;
const EDIT_RE = /\/JavaScript|\/JS\b|\/Launch\b|\/EmbeddedFile\b/i;
const OFFICE_PRODUCER_RE = /\/Producer\s*\(([^)]{0,80})\)/i;

type StoredReading = {
  reading: OfficialWorkerReading;
  expiresAt: number;
};

const readings = new Map<string, StoredReading>();
let healthCache: { at: number; value: OfficialSourceHealth } | null = null;

export type OfficialSourceHealthItem = {
  kind: OfficialWorkerKind;
  up: boolean;
  url: string;
  detail: string;
};

export type OfficialSourceHealth = {
  checkedAt: string;
  sources: OfficialSourceHealthItem[];
};

export type OfficialWorkerReadingResult = OfficialWorkerReading & {
  readingId: string;
  advisorAnswer: string;
};

export function clearOfficialWorkerDocumentState() {
  readings.clear();
  healthCache = null;
}

export function inspectPdfEditSigns(binary: Buffer): { suspicious: boolean; reasons: string[] } {
  const raw = binary.toString("latin1");
  const reasons: string[] = [];
  if (EDIT_RE.test(raw)) reasons.push("El PDF trae una acción automática.");
  const producer = raw.match(OFFICE_PRODUCER_RE)?.[1] ?? "";
  if (/microsoft word|libreoffice|canva|ilovepdf|photoshop/i.test(producer)) {
    reasons.push("El PDF parece editado en un programa de oficina.");
  }
  return { suspicious: reasons.length > 0, reasons };
}

export function rememberOfficialWorkerReading(reading: OfficialWorkerReading): string {
  const now = Date.now();
  const expired: string[] = [];
  readings.forEach((stored, id) => {
    if (stored.expiresAt <= now) expired.push(id);
  });
  expired.forEach((id) => readings.delete(id));
  while (readings.size >= READING_MAX) {
    const oldest = readings.keys().next().value;
    if (!oldest) break;
    readings.delete(oldest);
  }
  const readingId = randomBytes(16).toString("hex");
  readings.set(readingId, { reading, expiresAt: now + READING_TTL_MS });
  return readingId;
}

export function readRememberedOfficialWorkerReading(readingId: string | null | undefined): OfficialWorkerReading | null {
  if (!readingId || !/^[a-f0-9]{32}$/.test(readingId)) return null;
  const stored = readings.get(readingId);
  if (!stored) return null;
  if (stored.expiresAt <= Date.now()) {
    readings.delete(readingId);
    return null;
  }
  return stored.reading;
}

async function fetchText(url: string, fetchImpl: typeof fetch, timeoutMs: number): Promise<{ ok: boolean; status: number; text: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: { accept: "text/html,application/pdf;q=0.9,*/*;q=0.8" },
    });
    const text = (await response.text()).slice(0, 200_000);
    return { ok: response.ok, status: response.status, text };
  } finally {
    clearTimeout(timer);
  }
}

export async function verifyOfficialDocumentOnline(params: {
  kind: OfficialWorkerKind;
  url: string | null;
  needles: string[];
  fetchImpl?: typeof fetch;
}): Promise<OnlineVerification> {
  const needles = params.needles.map((item) => item.trim().toUpperCase()).filter((item) => item.length >= 10);
  if (!params.url || needles.length === 0) return "not_attempted";
  if (!officialVerificationHostAllowed(params.url, params.kind)) return "not_attempted";
  try {
    const page = await fetchText(params.url, params.fetchImpl ?? fetch, FETCH_TIMEOUT_MS);
    if (CAPTCHA_RE.test(page.text)) return "captcha";
    const haystack = page.text.toUpperCase();
    if (needles.every((needle) => haystack.includes(needle))) return "matched";
    if (/rfc|curp|nss|constancia|v[aá]lid/i.test(page.text)) return "mismatch";
    return "unavailable";
  } catch {
    return "unavailable";
  }
}

function needlesFor(reading: Pick<OfficialWorkerReading, "kind" | "nss" | "curp" | "rfc">): string[] {
  if (reading.kind === "sat") return reading.rfc ? [reading.rfc] : [];
  if (reading.kind === "imss") return [reading.nss, reading.curp].filter((item): item is string => Boolean(item));
  return [reading.nss, reading.curp].filter((item): item is string => Boolean(item));
}

export async function readOfficialWorkerPdf(params: {
  kind: OfficialWorkerKind;
  binary: Buffer;
  expected?: ExpectedWorkerIdentity | null;
  fetchImpl?: typeof fetch;
}): Promise<OfficialWorkerReadingResult> {
  const edit = inspectPdfEditSigns(params.binary);
  const looksPdf = params.binary.byteLength >= 5 && params.binary.subarray(0, 5).equals(Buffer.from("%PDF-"));
  const text = looksPdf ? await extractPdfPlainText(params.binary) : "";
  const binaryUrls = params.binary.toString("latin1");
  const verificationUrl = pickVerificationUrl(`${text}\n${binaryUrls}`, params.kind);
  const draft = readOfficialWorkerDocumentText({
    kind: params.kind,
    text,
    expected: params.expected,
    online: "not_attempted",
    editSuspicious: edit.suspicious,
    verificationUrl,
  });
  const online = await verifyOfficialDocumentOnline({
    kind: params.kind,
    url: draft.verificationUrl,
    needles: needlesFor(draft),
    fetchImpl: params.fetchImpl,
  });
  const reading = readOfficialWorkerDocumentText({
    kind: params.kind,
    text,
    expected: params.expected,
    online,
    editSuspicious: edit.suspicious,
    verificationUrl: draft.verificationUrl,
  });
  const readingId = rememberOfficialWorkerReading(reading);
  return {
    ...reading,
    readingId,
    advisorAnswer: buildOfficialWorkerAdvisorAnswer(reading),
  };
}

async function probeOfficialPage(
  kind: OfficialWorkerKind,
  fetchImpl: typeof fetch,
): Promise<OfficialSourceHealthItem> {
  const url = OFFICIAL_WORKER_PAGES[kind].url;
  try {
    const page = await fetchText(url, fetchImpl, 6_000);
    const up = page.status >= 200 && page.status < 400 && !CAPTCHA_RE.test(page.text);
    return {
      kind,
      up,
      url,
      detail: up ? "La página oficial responde." : OFFICIAL_PAGE_DOWN,
    };
  } catch {
    return { kind, up: false, url, detail: OFFICIAL_PAGE_DOWN };
  }
}

export async function checkOfficialSourceHealth(params?: {
  fetchImpl?: typeof fetch;
  nowMs?: number;
  bypassCache?: boolean;
}): Promise<OfficialSourceHealth> {
  const nowMs = params?.nowMs ?? Date.now();
  if (!params?.bypassCache && healthCache && nowMs - healthCache.at < HEALTH_TTL_MS) {
    return healthCache.value;
  }
  const fetchImpl = params?.fetchImpl ?? fetch;
  const sources = await Promise.all(OFFICIAL_WORKER_KINDS.map((kind) => probeOfficialPage(kind, fetchImpl)));
  const value = { checkedAt: new Date(nowMs).toISOString(), sources };
  healthCache = { at: nowMs, value };
  return value;
}
