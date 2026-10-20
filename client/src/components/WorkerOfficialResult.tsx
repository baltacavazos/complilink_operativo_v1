import { useRef, type ReactNode } from "react";
import { INSTITUTE_SILENCE_RETRY, INSTITUTE_SILENCE_SMALL, POCKET_CTA_MISMATCH, POCKET_CTA_SAVE, type InstituteSilencePresentation } from "@shared/officialCheckCopy";
import { Button } from "@/components/ui/button";
import { ImssIdentityCorrection } from "@/components/ImssIdentityCorrection";

type WorkerOfficialResultProps = {
  presentation: InstituteSilencePresentation;
  onRetry: () => void;
  onCorrectIdentity?: (value: { nss: string; curp: string }) => void;
  initialNss?: string;
  initialCurp?: string;
  onAsk: () => void;
  onDone?: () => void;
  retryPending?: boolean;
  paperRead?: string | null;
  comparisonLines?: string[];
  pocketLead?: string[];
  receiptData?: string[];
  /** Oferta de PDF justo después del fallo, antes del detalle cerrado. */
  failureOffer?: ReactNode;
};

const WORKER_IDENTIFIER_RE = /\b(RFC|CURP|NSS|registro patronal)\b/i;

/** Identificadores de registro. El nombre en el SAT se queda en las líneas de bolsillo. */
export function isWorkerIdentifierLine(line: string) {
  if (/nombre en el sat/i.test(line)) return false;
  if (/coincide con el SAT/i.test(line)) return false;
  if (/^El SAT contestó/i.test(line)) return false;
  if (/no encontramos registro/i.test(line)) return false;
  return WORKER_IDENTIFIER_RE.test(line);
}

export function WorkerRegistrationFold({ lines }: { lines: string[] }) {
  const unique = [...new Set(lines.map((line) => line.trim()).filter(Boolean))];
  if (!unique.length) return null;
  return (
    <details className="mt-3">
      <summary className="cursor-pointer text-sm font-semibold text-[#111111]">Ver datos de registro</summary>
      <ul data-testid="official-check-registration" className="mt-2 space-y-1 text-sm leading-6 text-[#161616]">
        {unique.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </details>
  );
}

/**
 * Primera pantalla: un veredicto, tres líneas, «Ver detalle» cerrado y un solo botón.
 * SAT, RFC, certificados y NSS no salen hasta abrir el detalle.
 */
export function WorkerOfficialResult({
  presentation,
  onRetry,
  onCorrectIdentity,
  initialNss = "",
  initialCurp = "",
  onAsk,
  onDone,
  retryPending = false,
  paperRead,
  comparisonLines = [],
  pocketLead = [],
  receiptData = [],
  failureOffer = null,
}: WorkerOfficialResultProps) {
  const detailRef = useRef<HTMLDetailsElement>(null);
  const showWaitLayer = Boolean(presentation.stillWaiting) || (retryPending && presentation.retryLabel === INSTITUTE_SILENCE_RETRY);
  const lines = [
    { label: "Qué pasó", text: presentation.whatHappened },
    { label: "Qué significa", text: presentation.meaning },
    { label: "Qué hacer", text: presentation.nextStep },
  ];
  const visibleSources = presentation.sourceLines.filter((line) => !isWorkerIdentifierLine(line));
  const hiddenSources = presentation.sourceLines.filter((line) => isWorkerIdentifierLine(line));
  const chip = presentation.correctImss
    ? { state: "revisa", label: "Revisa tus datos" }
    : showWaitLayer
      ? { state: "en-consulta", label: "En consulta" }
      : { state: "listo", label: "Listo" };
  const companions = presentation.companionCards ?? [];

  return (
    <>
    <section
      data-testid="official-check-card"
      data-worker-result="true"
      className="ap-official-card ap-light-surface ap-surface-mint ap-result-enter w-full rounded-[1.35rem] border text-left"
    >
      <span
        data-testid={showWaitLayer && !presentation.correctImss ? "official-wait-state" : "result-status-chip"}
        data-state={chip.state}
        className="ap-state-pill"
      >
        {chip.label}
      </span>
      <h2
        data-testid="five-second-verdict-seen"
        className="ap-official-title"
      >
        <span data-testid="official-check-headline">{presentation.verdict}</span>
      </h2>
      {pocketLead.length ? (
        <ul data-testid="official-check-pocket" className="mt-2 space-y-0.5 text-sm leading-5 text-[#161616]">
          {pocketLead.slice(0, 3).map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      ) : null}
      <div data-testid="official-check-silence">
        <div data-testid="official-check-detail" className="ap-official-lines">
          {lines.map((line) => (
            <p key={line.label} className="text-sm leading-5 text-[#161616]">
              <span className="font-semibold text-[#111111]">{line.label}. </span>
              {line.text}
            </p>
          ))}
        </div>
      </div>
      {presentation.smallPrint && presentation.smallPrint !== INSTITUTE_SILENCE_SMALL ? (
        <p className="mt-3 text-sm leading-5 text-[#161616]">{presentation.smallPrint}</p>
      ) : null}
      {companions.length ? null : failureOffer}
      <details className="ap-result-detail mt-2 rounded-[1rem] border border-[#e4e4e4] px-3 py-2" ref={detailRef}>
        <summary className="cursor-pointer text-sm font-semibold text-[#111111]">Ver detalle</summary>
        {visibleSources.length ? (
          <ul data-testid="official-check-sources" className="mt-2 space-y-1 text-sm leading-6 text-[#161616]">
            {visibleSources.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        ) : null}
        <WorkerRegistrationFold lines={[...receiptData, ...hiddenSources]} />
        {paperRead ? (
          <p className="mt-3 text-sm leading-6 text-[#161616]">{paperRead}</p>
        ) : null}
        {comparisonLines.length ? (
          <ul data-testid="official-check-comparison" className="mt-3 space-y-1 text-sm leading-6 text-[#161616]">
            {comparisonLines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        ) : null}
      </details>
      {presentation.correctImss && onCorrectIdentity ? (
        <ImssIdentityCorrection
          pending={retryPending}
          initialNss={initialNss}
          initialCurp={initialCurp}
          onSubmit={onCorrectIdentity}
        />
      ) : showWaitLayer ? null : (
        <Button
          type="button"
          data-testid="official-check-cta"
          className="ap-btn-on-dark mt-3 h-11 w-full rounded-full bg-[#111111] text-base font-semibold text-white hover:bg-[#222222]"
          disabled={retryPending}
          onClick={() => {
            if (presentation.retryLabel === POCKET_CTA_MISMATCH) {
              const node = detailRef.current;
              if (node) {
                node.open = true;
                node.scrollIntoView({ block: "nearest" });
              }
              return;
            }
            if (presentation.retryLabel === POCKET_CTA_SAVE) {
              onDone?.();
              return;
            }
            onRetry();
          }}
        >
          {presentation.retryLabel}
        </Button>
      )}
      <Button
        type="button"
        variant="link"
        data-testid="official-check-chat-cta"
        className="ap-ask-link"
        onClick={onAsk}
      >
        {presentation.askLabel}
      </Button>
    </section>
    {companions.map((card) => (
      <section
        key={card.office}
        data-testid="infonavit-result-card"
        className="ap-companion-card ap-light-surface w-full text-left"
      >
        <h2 className="ap-official-title">
          {card.title}
        </h2>
        <div className="ap-official-lines">
          <p className="text-sm leading-5 text-[#161616]">
            <span className="font-semibold text-[#111111]">Qué pasó. </span>
            {card.whatHappened}
          </p>
          <p className="text-sm leading-5 text-[#161616]">
            <span className="font-semibold text-[#111111]">Qué significa. </span>
            {card.meaning}
          </p>
          <p className="text-sm leading-5 text-[#161616]">
            <span className="font-semibold text-[#111111]">Qué hacer. </span>
            {card.nextStep}
          </p>
        </div>
        {card.office === "infonavit" ? failureOffer : null}
      </section>
    ))}
    </>
  );
}
