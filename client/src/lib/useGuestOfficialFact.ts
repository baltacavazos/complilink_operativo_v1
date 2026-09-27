import { useEffect, useRef, useState } from "react";
import type { inferRouterOutputs } from "@trpc/server";

import { trpc } from "@/lib/trpc";
import {
  guestOfficialFactStillWaiting,
  officialChecksMatch,
} from "@shared/guestOfficialFact";
import {
  pickPromptOfficialCheck,
  type OfficialCheckSummary,
} from "@shared/officialCheckCopy";
import type { AppRouter } from "../../../server/routers";

const GUEST_OFFICIAL_FACT_POLL_MS = 4_000;

type GuestOfficialFactData =
  inferRouterOutputs<AppRouter>["cases"]["guestOfficialFact"];

/**
 * Same cadence as the old query refetchInterval.
 * `awaiting` keeps the poll alive even when the local check would otherwise stop.
 */
export function guestOfficialFactPollDelay(params: {
  awaiting?: boolean;
  remote?: OfficialCheckSummary | null;
  local?: OfficialCheckSummary | null;
}): number | false {
  if (params.awaiting) return GUEST_OFFICIAL_FACT_POLL_MS;
  const stillWaiting =
    guestOfficialFactStillWaiting(params.remote) ||
    guestOfficialFactStillWaiting(params.local);
  return stillWaiting ? GUEST_OFFICIAL_FACT_POLL_MS : false;
}

export function useGuestOfficialFact(params: {
  guestPreviewToken?: string | null;
  enabled: boolean;
  localCheck?: OfficialCheckSummary | null;
}) {
  const token = params.guestPreviewToken?.trim() ?? "";
  const localCheck = params.localCheck ?? null;
  const enabled = params.enabled && token.length >= 40;
  const waiting = guestOfficialFactStillWaiting(localCheck);
  const utils = trpc.useUtils();
  const [data, setData] = useState<GuestOfficialFactData | undefined>(
    undefined
  );
  const [trackedToken, setTrackedToken] = useState(token);
  if (token !== trackedToken) {
    setTrackedToken(token);
    setData(undefined);
  }

  const dataRef = useRef(data);
  dataRef.current = data;
  const localCheckRef = useRef(localCheck);
  localCheckRef.current = localCheck;
  const clientRef = useRef(utils.client);
  clientRef.current = utils.client;
  const pollNowRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let requestSeq = 0;

    const clearTimer = () => {
      if (timer === undefined) return;
      clearTimeout(timer);
      timer = undefined;
    };

    const schedule = (result: GuestOfficialFactData | undefined) => {
      clearTimer();
      if (cancelled) return;
      const delay = guestOfficialFactPollDelay({
        awaiting: result?.awaiting,
        remote: result?.officialCheck ?? null,
        local: localCheckRef.current,
      });
      if (delay === false) return;
      timer = setTimeout(() => {
        void run();
      }, delay);
    };

    const run = async () => {
      const seq = ++requestSeq;
      clearTimer();
      try {
        const result = await clientRef.current.cases.guestOfficialFact.mutate({
          guestPreviewToken: token,
        });
        if (cancelled || seq !== requestSeq) return;
        setData(result);
        dataRef.current = result;
        schedule(result);
      } catch {
        if (cancelled || seq !== requestSeq) return;
        schedule(dataRef.current);
      }
    };

    pollNowRef.current = () => {
      void run();
    };

    const onFocus = () => {
      if (
        typeof document !== "undefined" &&
        document.visibilityState === "hidden"
      )
        return;
      void run();
    };

    void run();
    if (typeof window !== "undefined") {
      window.addEventListener("focus", onFocus);
    }
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", onFocus);
    }

    return () => {
      cancelled = true;
      pollNowRef.current = null;
      clearTimer();
      if (typeof window !== "undefined") {
        window.removeEventListener("focus", onFocus);
      }
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", onFocus);
      }
    };
  }, [enabled, token]);

  useEffect(() => {
    if (!enabled || !waiting) return;
    pollNowRef.current?.();
  }, [enabled, waiting, localCheck?.checkedAt, localCheck?.overallStatus]);

  return { data };
}

export function mergeGuestOfficialCheck(
  current: OfficialCheckSummary | null | undefined,
  incoming: OfficialCheckSummary | null | undefined
): OfficialCheckSummary | null {
  const next = pickPromptOfficialCheck({
    consentGranted: true,
    candidates: [incoming, current],
  });
  if (officialChecksMatch(next, current ?? null)) return current ?? null;
  return next;
}
