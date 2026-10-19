import { useRef, useState } from "react";
import {
  IMSS_CONSTANCIA_WHILE_WAITING,
  OFFICIAL_DOCUMENT_FALLBACK_LEAD,
  OFFICIAL_GUIDE_INTRO,
  OFFICIAL_NO_PASSWORD,
  OFFICIAL_PAGE_DOWN,
  OFFICIAL_UPLOAD_LABEL,
  OFFICIAL_VERIFIED_LABEL,
  OFFICIAL_WORKER_KINDS,
  OFFICIAL_WORKER_PAGES,
  type OfficialWorkerKind,
  type OfficialWorkerReading,
} from "@shared/officialWorkerDocument";
import { Button } from "@/components/ui/button";
import { readWebFileAsDataUrl } from "@/lib/platformDocumentInput";
import { trpc } from "@/lib/trpc";

export type OfficialWorkerUploadResult = OfficialWorkerReading & {
  readingId: string;
  advisorAnswer: string;
};

type OfficialDocumentGuideProps = {
  offerUpload?: boolean;
  /** El SAT ya contestó y el IMSS sigue pendiente. El botón abre la constancia del IMSS. */
  imssWhileWaiting?: boolean;
  expectedNss?: string | null;
  expectedCurp?: string | null;
  expectedRfc?: string | null;
  reading?: OfficialWorkerUploadResult | null;
  onReading?: (reading: OfficialWorkerUploadResult) => void;
};

function isPdfFile(file: File): boolean {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}

export function OfficialDocumentGuide({
  offerUpload = false,
  imssWhileWaiting = false,
  expectedNss,
  expectedCurp,
  expectedRfc,
  reading,
  onReading,
}: OfficialDocumentGuideProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const health = trpc.cases.officialSourceHealth.useQuery(undefined, {
    staleTime: 60_000,
    retry: false,
    refetchOnWindowFocus: false,
    enabled: offerUpload,
  });
  const mutation = trpc.cases.readOfficialWorkerDocument.useMutation();
  const [kind, setKind] = useState<OfficialWorkerKind>("imss");
  const [localNotice, setLocalNotice] = useState<string | null>(null);
  const [localReading, setLocalReading] = useState<OfficialWorkerUploadResult | null>(null);
  const page = OFFICIAL_WORKER_PAGES[kind];
  const constanciaPage = imssWhileWaiting ? OFFICIAL_WORKER_PAGES.imss : page;
  const sourceHealth = health.data?.sources.find((item) => item.kind === kind);
  const pageDown = sourceHealth ? !sourceHealth.up : false;
  const activeReading = reading ?? localReading;
  const shown = !activeReading || (offerUpload && activeReading.kind !== kind) ? null : activeReading;

  async function onFile(file: File | undefined) {
    if (!file || !isPdfFile(file)) {
      setLocalNotice("Falta un dato. Sube el PDF que te llegó.");
      return;
    }
    const dataUrl = await readWebFileAsDataUrl(file);
    const base64Content = dataUrl.split(",")[1] ?? "";
    if (!base64Content) {
      setLocalNotice("Falta un dato. No pudimos leer ese archivo.");
      return;
    }
    try {
      const next = await mutation.mutateAsync({
        kind,
        fileName: file.name,
        base64Content,
        expectedNss: expectedNss ?? undefined,
        expectedCurp: expectedCurp ?? undefined,
        expectedRfc: expectedRfc ?? undefined,
      });
      setLocalNotice(null);
      setLocalReading(next);
      onReading?.(next);
    } catch {
      setLocalNotice("No pudimos confirmar. Prueba otra vez con el PDF.");
    }
  }

  if (!offerUpload && !activeReading) return null;

  const verified = shown?.verdict === "cumple";

  return (
    <section
      data-testid="official-document-guide"
      data-fact-origin="document"
      className="mt-4 flex w-full flex-col gap-3 rounded-[1.35rem] border border-[#d7efe8] bg-[#f4fbf8] px-4 py-4 text-left text-[#161616]"
    >
      {offerUpload ? (
        <>
          <h2 className="text-xl font-semibold leading-7">
            {imssWhileWaiting ? IMSS_CONSTANCIA_WHILE_WAITING : OFFICIAL_DOCUMENT_FALLBACK_LEAD}
          </h2>
          <p className="text-base leading-6">
            {imssWhileWaiting
              ? "El IMSS está tardando. Entra a su página, pide tu constancia y súbela. Aquí no escribas tu clave."
              : OFFICIAL_GUIDE_INTRO}
          </p>
          <a
            href={constanciaPage.url}
            target="_blank"
            rel="noopener noreferrer"
            data-testid="official-guide-open"
            className="inline-flex min-h-14 items-center justify-center rounded-full bg-[#111111] px-4 py-3 text-center text-lg font-semibold text-white"
          >
            {imssWhileWaiting ? "Pide tu constancia del IMSS y súbela" : "Pide tu constancia aquí"}
          </a>
          <div className="flex flex-wrap gap-2">
            {OFFICIAL_WORKER_KINDS.map((item) => (
              <button
                key={item}
                type="button"
                data-testid={`official-guide-${item}`}
                className={`min-h-11 rounded-full px-3 py-2 text-sm font-semibold ${
                  item === kind ? "bg-[#0f766e] text-white" : "bg-white text-[#161616]"
                }`}
                onClick={() => setKind(item)}
              >
                {OFFICIAL_WORKER_PAGES[item].title}
              </button>
            ))}
          </div>
          <p className="text-base leading-6">{page.help}</p>
          <p className="text-base leading-6">{OFFICIAL_NO_PASSWORD}</p>
          {pageDown ? (
            <p data-testid="official-guide-page-down" className="text-base leading-6">
              {OFFICIAL_PAGE_DOWN}
            </p>
          ) : null}
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf,.pdf"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              void onFile(file);
            }}
          />
          <Button
            type="button"
            data-testid="official-guide-upload"
            className="h-auto min-h-14 w-full whitespace-normal rounded-full bg-[#0f766e] px-4 py-3 text-lg font-semibold text-white hover:bg-[#0d6b64]"
            disabled={mutation.isPending}
            onClick={() => inputRef.current?.click()}
          >
            {mutation.isPending ? "Leyendo tu PDF…" : OFFICIAL_UPLOAD_LABEL}
          </Button>
        </>
      ) : null}
      {shown ? (
        <div data-testid="official-guide-result" data-fuente={shown.fuente} data-verdict={shown.verdict}>
          <p className="text-2xl font-semibold">{verified ? OFFICIAL_VERIFIED_LABEL : shown.verdictLabel}</p>
          <ul className="mt-2 space-y-1 text-lg leading-7">
            {shown.lines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <p className="mt-2 text-base leading-6">{shown.notice}</p>
          <p data-testid="official-guide-advisor" className="mt-3 text-lg leading-7">
            {shown.advisorAnswer}
          </p>
        </div>
      ) : null}
      {localNotice ? <p className="text-base leading-6">{localNotice}</p> : null}
    </section>
  );
}
