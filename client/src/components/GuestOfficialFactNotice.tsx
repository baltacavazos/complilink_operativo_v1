import { Bell } from "lucide-react";

import { isWorkerIdentifierLine } from "@/components/WorkerOfficialResult";
import { GUEST_OFFICIAL_FACT_CLOSED_TAB_LIMIT, listGuestVisibleOfficialFacts } from "@shared/guestOfficialFact";
import type { OfficialCheckSummary } from "@shared/officialCheckCopy";
import { OFFICIAL_FACT_ARRIVED_NOTICE } from "@shared/officialCheckCopy";
import {
  hasUsableOfficialFact,
  OFFICIAL_RESULT_NOTIFICATION_COPY,
} from "@shared/officialResultNotification";

function GuestFactLines({
  testId,
  sourceLabel,
  lines,
}: {
  testId: string;
  sourceLabel: string;
  lines: string[];
}) {
  if (!lines.length) return null;
  return (
    <div className="mt-3">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-teal-900">{sourceLabel}</p>
      <ul data-testid={testId} className="mt-1 space-y-1 text-sm leading-6 text-slate-900">
        {lines.map((line, index) => (
          <li key={`${sourceLabel}-${index}`}>{line}</li>
        ))}
      </ul>
    </div>
  );
}

function formatArrivedAt(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export function GuestOfficialFactNotice({
  summary,
  arrivedAt,
  waiting,
}: {
  summary?: OfficialCheckSummary | null;
  arrivedAt?: string | null;
  waiting?: boolean;
}) {
  if (hasUsableOfficialFact(summary)) {
    const visible = listGuestVisibleOfficialFacts(summary);
    const imssLines = visible.imss.filter((line) => !isWorkerIdentifierLine(line));
    const infonavitLines = visible.infonavit.filter((line) => !isWorkerIdentifierLine(line));
    const when = formatArrivedAt(arrivedAt);
    return (
      <section
        data-testid="official-result-inbox"
        role="status"
        className="mb-4 rounded-[1.5rem] border border-teal-200 bg-teal-50 px-4 py-4 text-left shadow-sm"
      >
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-full bg-white p-2 text-teal-800 shadow-sm">
            <Bell className="h-4 w-4" strokeWidth={1.9} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-teal-800">Bandeja</p>
            <p className="mt-1 text-base font-semibold text-slate-950">{OFFICIAL_RESULT_NOTIFICATION_COPY.title}</p>
            <p className="mt-1 text-sm leading-6 text-slate-800">
              {OFFICIAL_FACT_ARRIVED_NOTICE} {OFFICIAL_RESULT_NOTIFICATION_COPY.body}{" "}
              {OFFICIAL_RESULT_NOTIFICATION_COPY.disclaimer}
            </p>
            <GuestFactLines testId="guest-official-imss-fact" sourceLabel="IMSS" lines={imssLines} />
            <GuestFactLines testId="guest-official-infonavit-fact" sourceLabel="Infonavit" lines={infonavitLines} />
            {when ? <p className="mt-2 text-xs font-medium text-teal-900">{when}</p> : null}
          </div>
        </div>
      </section>
    );
  }

  if (!waiting) return null;

  return (
    <p data-testid="guest-official-fact-limit" className="mt-2 text-sm leading-6 text-[#161616]">
      {GUEST_OFFICIAL_FACT_CLOSED_TAB_LIMIT}
    </p>
  );
}
