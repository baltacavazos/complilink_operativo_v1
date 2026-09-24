import { OFFICIAL_WAIT_STILL_TRYING } from "@shared/officialCheckCopy";

export function OfficialWaitLayer({ status }: { status: string }) {
  const state = status === "consultando" ? "Consultando" : "Pendiente";
  return (
    <p data-testid="official-wait-layer" className="mt-3 text-base leading-6 text-[#161616]">
      <span data-testid="official-wait-state" className="font-semibold">
        {state}.{" "}
      </span>
      {OFFICIAL_WAIT_STILL_TRYING}
    </p>
  );
}
