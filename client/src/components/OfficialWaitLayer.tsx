import { OFFICIAL_WAIT_STILL_TRYING } from "@shared/officialCheckCopy";

export function OfficialWaitLayer({ status }: { status: string }) {
  const consulting = status === "consultando";
  const chip = consulting ? "Pendiente" : "Sin dato hoy";
  return (
    <div data-testid="official-wait-layer" className="mt-3 space-y-2">
      <span
        data-testid="official-wait-state"
        data-state={consulting ? "pendiente" : "sin-dato"}
        className="ap-state-pill"
      >
        {chip}
      </span>
      <p className="text-base leading-6 text-[#161616]">{OFFICIAL_WAIT_STILL_TRYING}</p>
    </div>
  );
}
