import { useEffect, useState } from "react";
import { IMSS_RECORD_NOT_FOUND_ACTION } from "@shared/officialCheckCopy";
import { Button } from "@/components/ui/button";

export function ImssIdentityCorrection({
  pending = false,
  initialNss = "",
  initialCurp = "",
  onSubmit,
}: {
  pending?: boolean;
  initialNss?: string;
  initialCurp?: string;
  onSubmit: (value: { nss: string; curp: string }) => void;
}) {
  const [nss, setNss] = useState(initialNss);
  const [curp, setCurp] = useState(initialCurp);
  const [nssTouched, setNssTouched] = useState(false);
  const [curpTouched, setCurpTouched] = useState(false);
  const ready = Boolean(nss.trim() || curp.trim());

  useEffect(() => {
    if (!nssTouched) setNss(initialNss);
  }, [initialNss, nssTouched]);

  useEffect(() => {
    if (!curpTouched) setCurp(initialCurp);
  }, [initialCurp, curpTouched]);

  return (
    <form
      data-testid="imss-identity-correction"
      className="mt-3 space-y-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (!ready || pending) return;
        onSubmit({ nss: nss.trim(), curp: curp.trim() });
      }}
    >
      <label className="block text-sm font-semibold text-[#111111]">
        NSS
        <input
          data-testid="imss-correct-nss"
          className="mt-1 h-11 w-full rounded-xl border border-[#d7d7d7] bg-white px-3 text-base font-normal"
          inputMode="numeric"
          autoComplete="off"
          maxLength={11}
          placeholder="11 números"
          value={nss}
          onChange={(event) => {
            setNssTouched(true);
            setNss(event.target.value);
          }}
        />
      </label>
      <label className="block text-sm font-semibold text-[#111111]">
        CURP
        <input
          data-testid="imss-correct-curp"
          className="mt-1 h-11 w-full rounded-xl border border-[#d7d7d7] bg-white px-3 text-base font-normal uppercase"
          autoComplete="off"
          maxLength={18}
          placeholder="18 letras y números"
          value={curp}
          onChange={(event) => {
            setCurpTouched(true);
            setCurp(event.target.value);
          }}
        />
      </label>
      <Button
        type="submit"
        data-testid="imss-correct-submit"
        className="ap-btn-on-dark h-11 w-full rounded-full bg-[#111111] text-base font-semibold text-white hover:bg-[#222222]"
        disabled={pending || !ready}
      >
        {IMSS_RECORD_NOT_FOUND_ACTION}
      </Button>
    </form>
  );
}
