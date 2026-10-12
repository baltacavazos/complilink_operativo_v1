import { useEffect, useRef, useState } from "react";

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

export function receiptReadElapsed(startedAt: number, now = Date.now()) {
  return Math.max(0, now - startedAt);
}

export function ReceiptReadWaitCard({
  onTryAnother,
  startedAt,
}: {
  onTryAnother: () => void;
  startedAt: number;
}) {
  const rootRef = useRef<HTMLElement>(null);
  const [elapsedMs, setElapsedMs] = useState(() => receiptReadElapsed(startedAt));

  useEffect(() => {
    const timer = window.setInterval(() => {
      setElapsedMs(receiptReadElapsed(startedAt));
    }, 500);
    return () => window.clearInterval(timer);
  }, [startedAt]);

  const message = receiptReadWaitMessage(elapsedMs);
  const late = elapsedMs > 45_000;

  useEffect(() => {
    rootRef.current?.scrollIntoView({ block: "start", inline: "nearest", behavior: "auto" });
  }, [message]);

  return (
    <section
      ref={rootRef}
      id="receipt-read-wait"
      data-testid="receipt-read-wait"
      aria-live={RECEIPT_READ_WAIT_ARIA_LIVE}
      className="ap-read-wait sticky top-2 z-40 mb-3 w-full scroll-mt-3 rounded-2xl border-2 border-[#111111] px-4 py-4 text-left"
      style={{ backgroundColor: "#fffdf6", color: "#111111", fontSize: "17px" }}
    >
      <p data-testid="receipt-read-steps" className="font-semibold leading-6">
        Subido ✓ · Leyendo · Resultado
      </p>
      <div
        className="ap-read-wait-track mt-3 h-1.5 overflow-hidden rounded-full"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Leyendo tu recibo"
      >
        <div className="ap-read-wait-bar h-full rounded-full" />
      </div>
      <p data-testid="receipt-read-message" className="mt-3 font-medium leading-6">
        {message}
      </p>
      {late ? (
        <button
          type="button"
          data-testid="receipt-read-try-another"
          className="mt-3 inline-flex min-h-12 items-center rounded-full border-2 border-[#111111] bg-white px-4 font-semibold text-[#111111]"
          onClick={onTryAnother}
        >
          Probar con otra foto
        </button>
      ) : null}
    </section>
  );
}
