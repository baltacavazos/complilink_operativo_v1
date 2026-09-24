import { useEffect } from "react";

import { trpc } from "@/lib/trpc";
import {
  guestOfficialFactStillWaiting,
  officialChecksMatch,
} from "@shared/guestOfficialFact";
import { pickPromptOfficialCheck, type OfficialCheckSummary } from "@shared/officialCheckCopy";

const GUEST_OFFICIAL_FACT_POLL_MS = 4_000;

export function useGuestOfficialFact(params: {
  guestPreviewToken?: string | null;
  enabled: boolean;
  localCheck?: OfficialCheckSummary | null;
}) {
  const token = params.guestPreviewToken?.trim() ?? "";
  const localCheck = params.localCheck ?? null;
  const waiting = guestOfficialFactStillWaiting(localCheck);
  const query = trpc.cases.guestOfficialFact.useQuery(
    { guestPreviewToken: token },
    {
      enabled: params.enabled && token.length >= 40,
      refetchOnWindowFocus: true,
      refetchInterval: (current) => {
        const remote = current.state.data?.officialCheck ?? null;
        if (current.state.data?.awaiting) return GUEST_OFFICIAL_FACT_POLL_MS;
        return guestOfficialFactStillWaiting(remote) || guestOfficialFactStillWaiting(localCheck)
          ? GUEST_OFFICIAL_FACT_POLL_MS
          : false;
      },
    },
  );

  const { refetch } = query;
  useEffect(() => {
    if (!params.enabled || !waiting) return;
    void refetch();
  }, [params.enabled, waiting, localCheck?.checkedAt, localCheck?.overallStatus, refetch]);

  return query;
}

export function mergeGuestOfficialCheck(
  current: OfficialCheckSummary | null | undefined,
  incoming: OfficialCheckSummary | null | undefined,
): OfficialCheckSummary | null {
  const next = pickPromptOfficialCheck({
    consentGranted: true,
    candidates: [incoming, current],
  });
  if (officialChecksMatch(next, current ?? null)) return current ?? null;
  return next;
}
