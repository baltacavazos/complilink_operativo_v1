import { useEffect, useState } from "react";

export const RECEIPT_READ_WAIT_COPY = {
  start: "Estamos leyendo tu recibo. Tarda como medio minuto. No cierres esta pantalla.",
  middle: "Ya casi. Estamos buscando cuánto te pagaron y tus descuentos.",
  photo: "Un poquito más. Las fotos tardan más que los PDF.",
  late: "Está tardando más de lo normal. Puedes esperar o probar con otra foto.",
} as const;

export const RECEIPT_READ_WAIT_ARIA_LIVE = "polite" as const;

export function receiptReadWaitMessage(elapsedMs: number) {
  if (elapsedMs < 8_000) return RECEIPT_READ_WAIT_COPY.start;
  if (elapsedMs < 20_000) return RECEIPT_READ_WAIT_COPY.middle;
  if (elapsedMs <= 45_000) return RECEIPT_READ_WAIT_COPY.photo;
  return RECEIPT_READ_WAIT_COPY.late;
}

export function ReceiptReadWaitCard({ onTryAnother }: { onTryAnother: () => void }) {
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    const started = Date.now();
    const timer = window.setInterval(() => {
      setElapsedMs(Date.now() - started);
    }, 500);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    document.getElementById("receipt-read-wait")?.scrollIntoView({ block: "nearest" });
  }, []);

  const message = receiptReadWaitMessage(elapsedMs);
  const late = elapsedMs > 45_000;

  return (
    <section
      id="receipt-read-wait"
      data-testid="receipt-read-wait"
      aria-live={RECEIPT_READ_WAIT_ARIA_LIVE}
      className="mb-3 w-full rounded-2xl border-2 border-[#111111] bg-[#fffdf6] px-4 py-4 text-left text-[#111111]"
    >
      <p data-testid="receipt-read-steps" className="text-base font-semibold leading-6 text-[#111111]">
        Subido ✓ · Leyendo · Resultado
      </p>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#e7e0cc]" aria-hidden="true">
        <div className="h-full w-1/3 animate-pulse rounded-full bg-[#111111]" />
      </div>
      <p data-testid="receipt-read-message" className="mt-3 text-base font-medium leading-6 text-[#111111]">
        {message}
      </p>
      {late ? (
        <button
          type="button"
          data-testid="receipt-read-try-another"
          className="mt-3 inline-flex min-h-12 items-center rounded-full border-2 border-[#111111] bg-white px-4 text-base font-semibold text-[#111111]"
          onClick={onTryAnother}
        >
          Probar con otra foto
        </button>
      ) : null}
    </section>
  );
}
