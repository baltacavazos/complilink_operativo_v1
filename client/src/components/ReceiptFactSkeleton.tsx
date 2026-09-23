import {
  isPlaceholderSatLegalName,
  LABOR_REVIEW_READY,
  RECEIPT_RECEIVED_ACK,
  RECEIPT_VALIDATION_CORRECTION,
} from "@shared/officialCheckCopy";

export type ReceiptAck = "received" | "failed" | null;

export type ReceiptFactSlots = {
  emisor: string | null;
  monto: string | null;
  fecha: string | null;
  estatus: string | null;
};

const RECEIPT_FACT_ROWS = [
  ["Emisor", "emisor"],
  ["Monto", "monto"],
  ["Fecha", "fecha"],
  ["Estatus", "estatus"],
] as const;

export function buildReceiptFactSlots(params: {
  employer?: string | null;
  employerRfc?: string | null;
  payment?: string | null;
  period?: string | null;
  estatus?: string | null;
}): ReceiptFactSlots {
  const employer = params.employer?.trim() || null;
  return {
    emisor: employer && !isPlaceholderSatLegalName(employer, params.employerRfc) ? employer : null,
    monto: params.payment?.trim() || null,
    fecha: params.period?.trim() || null,
    estatus: params.estatus?.trim() || null,
  };
}

/** Cuatro huecos grises. Se llenan con hechos. No giran. */
export function ReceiptFactSkeleton({ slots }: { slots: ReceiptFactSlots }) {
  return (
    <dl data-testid="receipt-fact-skeleton" className="mt-3 space-y-3">
      {RECEIPT_FACT_ROWS.map(([label, key]) => {
        const value = slots[key];
        return (
          <div key={label} className="grid grid-cols-[5.5rem_minmax(0,1fr)] items-center gap-3">
            <dt className="text-sm font-semibold text-[#111111]">{label}</dt>
            <dd className="min-w-0 text-sm font-medium leading-6 text-[#161616]">
              {value ? (
                <span>{value}</span>
              ) : (
                <span
                  data-placeholder="true"
                  className="block h-3 w-4/5 rounded-full bg-[#d9d9d9]"
                  aria-hidden="true"
                />
              )}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

export function ReceiptArrival({
  ack,
  slots,
  satFacts,
  laborReady,
  showSkeleton = true,
}: {
  ack: ReceiptAck;
  slots: ReceiptFactSlots;
  satFacts: string[];
  laborReady: boolean;
  showSkeleton?: boolean;
}) {
  if (!showSkeleton && satFacts.length === 0 && !laborReady) return null;
  return (
    <div className="text-left">
      {showSkeleton && ack === "received" ? (
        <p data-testid="receipt-received" className="text-base font-semibold text-[#111111]">
          {RECEIPT_RECEIVED_ACK}
        </p>
      ) : null}
      {showSkeleton && ack === "failed" ? (
        <p data-testid="receipt-correction" className="text-base font-semibold text-[#111111]">
          {RECEIPT_VALIDATION_CORRECTION}
        </p>
      ) : null}
      {showSkeleton ? <ReceiptFactSkeleton slots={slots} /> : null}
      {satFacts.length > 0 ? (
        <ul data-testid="sat-live-facts" className="mt-3 space-y-1 text-sm leading-6 text-[#161616]">
          {satFacts.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      ) : null}
      {laborReady ? (
        <p data-testid="labor-review-ready" className="mt-3 text-sm font-semibold text-[#111111]">
          {LABOR_REVIEW_READY}
        </p>
      ) : null}
    </div>
  );
}
