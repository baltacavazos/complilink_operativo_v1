import { useRef, useState } from "react";
import {
  OFFICIAL_FALLBACK_LABEL,
  OFFICIAL_GUIDE_INTRO,
  OFFICIAL_NO_PASSWORD,
  OFFICIAL_PAGE_DOWN,
  OFFICIAL_UPLOAD_LABEL,
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
  expectedNss?: string | null;
  expectedCurp?: string | null;
  expectedRfc?: string | null;
  reading?: OfficialWorkerUploadResult | null;
  onReading?: (reading: OfficialWorkerUploadResult) => void;
  onNeedFallback?: () => void;
  fallbackActive?: boolean;
};

function isPdfFile(file: File): boolean {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}

export function OfficialDocumentGuide({
  expectedNss,
  expectedCurp,
  expectedRfc,
  reading,
  onReading,
  onNeedFallback,
  fallbackActive = false,
}: OfficialDocumentGuideProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const health = trpc.cases.officialSourceHealth.useQuery(undefined, {
    staleTime: 60_000,
    retry: false,
    refetchOnWindowFocus: false,
  });
  const mutation = trpc.cases.readOfficialWorkerDocument.useMutation();
  const [kind, setKind] = useState<OfficialWorkerKind>("imss");
  const [localNotice, setLocalNotice] = useState<string | null>(null);
  const [localReading, setLocalReading] = useState<OfficialWorkerUploadResult | null>(null);
  const page = OFFICIAL_WORKER_PAGES[kind];
  const sourceHealth = health.data?.sources.find((item) => item.kind === kind);
  const pageDown = sourceHealth ? !sourceHealth.up : false;

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

  const activeReading = reading ?? localReading;
  const shown = activeReading?.kind === kind ? activeReading : null;

  return (
    <section
      data-testid="official-document-guide"
      data-fact-origin="document"
      className="mt-4 flex w-full flex-col gap-4 rounded-[1.35rem] border border-[#d7efe8] bg-[#f4fbf8] px-4 py-4 text-left text-[#161616]"
    >
      <h2 className="text-2xl font-semibold leading-8">{page.title}</h2>
      <p className="text-lg leading-7">{OFFICIAL_GUIDE_INTRO}</p>
      <div className="grid gap-2">
        {OFFICIAL_WORKER_KINDS.map((item) => (
          <Button
            key={item}
            type="button"
            data-testid={`official-guide-${item}`}
            className={`h-auto min-h-14 w-full whitespace-normal rounded-2xl px-4 py-3 text-left text-lg font-semibold leading-6 ${
              item === kind ? "bg-[#0f766e] text-white hover:bg-[#0d6b64]" : "bg-white text-[#161616] hover:bg-[#e7f6f2]"
            }`}
            onClick={() => setKind(item)}
          >
            {OFFICIAL_WORKER_PAGES[item].title}
          </Button>
        ))}
      </div>
      <p className="text-lg leading-7">{page.help}</p>
      <p className="text-base leading-6">{OFFICIAL_NO_PASSWORD}</p>
      {pageDown ? (
        <p data-testid="official-guide-page-down" className="text-base leading-6">
          {OFFICIAL_PAGE_DOWN}
        </p>
      ) : null}
      <a
        href={page.url}
        target="_blank"
        rel="noopener noreferrer"
        data-testid="official-guide-open"
        className="inline-flex min-h-14 items-center justify-center rounded-full bg-[#111111] px-4 py-3 text-center text-lg font-semibold text-white"
      >
        Abrir la página oficial
      </a>
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
      {shown ? (
        <div data-testid="official-guide-result" data-fuente={shown.fuente} data-verdict={shown.verdict}>
          <p className="text-sm font-semibold uppercase tracking-wide">Fuente oficial</p>
          <p className="mt-1 text-2xl font-semibold">{shown.verdictLabel}</p>
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
      <Button
        type="button"
        data-testid="official-guide-fallback"
        className="h-auto min-h-12 w-full whitespace-normal rounded-full bg-white px-4 py-3 text-base font-semibold text-[#161616] hover:bg-[#e7f6f2]"
        onClick={() => onNeedFallback?.()}
      >
        {OFFICIAL_FALLBACK_LABEL}
      </Button>
      {fallbackActive ? (
        <p data-testid="official-guide-respaldo" className="text-base leading-6">
          Respaldo. Esta consulta no es tu papel oficial. No decimos que cumple.
        </p>
      ) : null}
    </section>
  );
}
