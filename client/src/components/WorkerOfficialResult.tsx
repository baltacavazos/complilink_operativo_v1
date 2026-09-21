import type { InstituteSilencePresentation } from "@shared/officialCheckCopy";
import { Button } from "@/components/ui/button";

type WorkerOfficialResultProps = {
  presentation: InstituteSilencePresentation;
  onRetry: () => void;
  onAsk: () => void;
  onUploadAnother?: () => void;
  retryPending?: boolean;
  paperRead?: string | null;
};

/**
 * Primera pantalla del resultado: un veredicto, tres líneas y un solo botón.
 * SAT, RFC, certificados y NSS quedan detrás de «Ver detalle».
 */
export function WorkerOfficialResult({
  presentation,
  onRetry,
  onAsk,
  onUploadAnother,
  retryPending = false,
  paperRead,
}: WorkerOfficialResultProps) {
  const lines = [
    { label: "Qué pasó", text: presentation.whatHappened },
    { label: "Qué significa", text: presentation.meaning },
    { label: "Qué hacer", text: presentation.nextStep },
  ];

  return (
    <section
      data-testid="official-check-card"
      data-worker-result="true"
      className="ap-light-surface ap-surface-mint w-full rounded-[1.6rem] border px-4 py-5 text-left sm:px-6 sm:py-6"
    >
      <h2
        data-testid="five-second-verdict-seen"
        className="text-[1.7rem] font-semibold leading-[1.12] tracking-[-0.04em] text-[#111111] sm:text-[2.05rem]"
      >
        {presentation.verdict}
      </h2>
      <p data-testid="official-check-headline" className="sr-only">
        {presentation.verdict}
      </p>
      <div data-testid="official-check-silence" className="mt-4 space-y-3">
        {lines.map((line) => (
          <p key={line.label} className="text-[0.98rem] leading-6 text-[#161616]">
            <span className="font-semibold text-[#111111]">{line.label}. </span>
            {line.text}
          </p>
        ))}
      </div>
      <p data-testid="official-check-detail" className="sr-only">
        {lines.map((line) => `${line.label}. ${line.text}`).join(" ")}
      </p>
      <Button
        type="button"
        data-testid="official-check-cta"
        className="ap-btn-on-dark mt-5 h-12 w-full rounded-full bg-[#111111] text-base font-semibold text-white hover:bg-[#222222]"
        disabled={retryPending}
        onClick={onRetry}
      >
        {presentation.retryLabel}
      </Button>
      <button
        type="button"
        data-testid="official-check-chat-cta"
        className="mt-3 block text-sm font-semibold text-[#161616] underline decoration-[#161616]/35 underline-offset-4"
        onClick={onAsk}
      >
        {presentation.askLabel}
      </button>
      {onUploadAnother ? (
        <button
          type="button"
          data-testid="worker-upload-another"
          className="mt-2 block text-sm text-[#222222] underline decoration-[#222222]/25 underline-offset-4"
          onClick={onUploadAnother}
        >
          Subir otro recibo
        </button>
      ) : null}
      <details className="mt-4 rounded-[1rem] border border-[#e4e4e4] bg-white px-3 py-3">
        <summary className="cursor-pointer text-sm font-semibold text-[#161616]">Ver detalle</summary>
        {presentation.sourceLines.length ? (
          <ul data-testid="official-check-sources" className="mt-2 space-y-1 text-sm leading-6 text-[#161616]">
            {presentation.sourceLines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        ) : null}
        {paperRead ? (
          <p className="mt-3 text-sm leading-6 text-[#161616]">{paperRead}</p>
        ) : null}
      </details>
    </section>
  );
}
