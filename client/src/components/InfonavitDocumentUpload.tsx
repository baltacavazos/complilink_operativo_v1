import { useRef, useState } from "react";
import {
  INFONAVIT_DOCUMENT_CTA,
  INFONAVIT_DOCUMENT_READING_LABEL,
  INFONAVIT_DOCUMENT_UNREADABLE,
  INFONAVIT_DOCUMENT_UPLOAD_LABEL,
  INFONAVIT_MICUENTA_URL,
  type InfonavitDocumentReading,
} from "@shared/infonavitMiCuentaDocument";
import { Button } from "@/components/ui/button";
import { readWebFileAsDataUrl } from "@/lib/platformDocumentInput";
import { trpc } from "@/lib/trpc";

function isPdfFile(file: File): boolean {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}

export function InfonavitDocumentUpload() {
  const inputRef = useRef<HTMLInputElement>(null);
  const mutation = trpc.cases.readInfonavitMiCuentaPdf.useMutation();
  const [reading, setReading] = useState<InfonavitDocumentReading | null>(null);
  const [localNotice, setLocalNotice] = useState<string | null>(null);

  async function onFile(file: File | undefined) {
    if (!file) return;
    if (!isPdfFile(file)) {
      setReading(null);
      setLocalNotice(INFONAVIT_DOCUMENT_UNREADABLE);
      return;
    }
    const dataUrl = await readWebFileAsDataUrl(file);
    const base64Content = dataUrl.split(",")[1] ?? "";
    if (!base64Content) {
      setReading(null);
      setLocalNotice(INFONAVIT_DOCUMENT_UNREADABLE);
      return;
    }
    try {
      const next = await mutation.mutateAsync({
        fileName: file.name,
        base64Content,
      });
      setLocalNotice(null);
      setReading(next);
    } catch {
      setReading(null);
      setLocalNotice(INFONAVIT_DOCUMENT_UNREADABLE);
    }
  }

  const notice = reading?.readable ? null : (localNotice ?? (reading ? reading.notice : null));

  return (
    <section
      data-testid="infonavit-document-offer"
      data-fact-origin="document"
      data-fact-source="user_upload"
      className="mt-4 rounded-[1.35rem] border border-[#e4e4e4] bg-white px-4 py-4 text-left"
    >
      <p className="text-[0.98rem] leading-6 text-[#161616]">{INFONAVIT_DOCUMENT_CTA}</p>
      <a
        href={INFONAVIT_MICUENTA_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2 inline-block text-sm font-semibold text-[#111111] underline decoration-[#161616]/40 underline-offset-4"
      >
        micuenta.infonavit.org.mx
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
        data-testid="infonavit-document-upload"
        className="ap-btn-on-dark mt-4 h-11 rounded-full bg-[#111111] px-4 text-white hover:bg-[#222222]"
        disabled={mutation.isPending}
        onClick={() => inputRef.current?.click()}
      >
        {mutation.isPending ? INFONAVIT_DOCUMENT_READING_LABEL : INFONAVIT_DOCUMENT_UPLOAD_LABEL}
      </Button>
      {reading?.readable ? (
        <div className="mt-4" data-testid="infonavit-document-facts" data-fact-origin={reading.origin}>
          <ul className="space-y-1 text-sm leading-6 text-[#161616]">
            {reading.lines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <p className="mt-3 text-sm leading-6 text-[#161616]">{reading.originLine}</p>
          {reading.shield ? <p className="mt-1 text-sm leading-6 text-[#161616]">{reading.shield}</p> : null}
        </div>
      ) : null}
      {notice ? (
        <p data-testid="infonavit-document-unread" className="mt-4 text-sm leading-6 text-[#161616]">
          {notice}
        </p>
      ) : null}
    </section>
  );
}
